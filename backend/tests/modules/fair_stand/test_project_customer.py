from __future__ import annotations

from uuid import uuid4

import httpx
import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, text

from app.integrations.crm_references import get_crm_reference_validator, validate_crm_reference
from app.main import app
from app.modules.fair_stand.application.projects import (
    UNASSIGNED_PROJECT_CUSTOMER_ID,
    backfill_unassigned_project_customers,
)

CUSTOMER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
CUSTOMER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"


def test_customer_reference_check_covers_both_create_paths_and_legacy_assignment(client, auth_headers):
    project = _create(client, auth_headers, "Existing").json()
    base = "/api/v1/fair-stand/projects"
    existing = f"{base}/{project['id']}"

    def reject_customer(kind, reference_id):
        assert kind == "customers"
        assert str(reference_id) == CUSTOMER_B
        raise HTTPException(422, "Customer unavailable")

    app.dependency_overrides[get_crm_reference_validator] = lambda: reject_customer
    assert _create(client, auth_headers, "Rejected", CUSTOMER_B).status_code == 422
    assert client.put(f"{base}/{uuid4()}", headers=auth_headers, json={
        "name": "Rejected from editor", "customerId": CUSTOMER_B,
    }).status_code == 422
    assert client.patch(f"{existing}/customer", headers=auth_headers, json={
        "customerId": CUSTOMER_B,
    }).status_code == 422
    saved = client.put(existing, headers=auth_headers, json={"name": "Drawing save", "customerId": CUSTOMER_B})
    assert saved.status_code == 200
    assert saved.json()["customerId"] == CUSTOMER_A


@pytest.mark.parametrize(
    ("kind", "origin", "scope", "deleted", "upstream_status", "expected"),
    [
        ("customers", None, "own", False, 200, 200),
        ("customers", None, "foreign", False, 200, 422),
        ("customers", None, "own", True, 200, 422),
        ("customers", None, "own", False, 404, 422),
        ("fairs", "organization", "own", False, 200, 200),
        ("fairs", "organization", "foreign", False, 200, 422),
        ("fairs", "system", "shared", False, 200, 200),
        ("fairs", "system", "shared", True, 200, 422),
        ("fairs", "organization", "shared", False, 200, 422),
        ("fairs", "system", "shared", False, 503, 503),
    ],
)
def test_assignment_checks_crm_scope_and_deletion(
    client, auth_headers, organization_id, kind, origin, scope, deleted, upstream_status, expected,
):
    project = _create(client, auth_headers, "Scoped assignment").json()
    path = f"/api/v1/fair-stand/projects/{project['id']}"
    target_id = uuid4()
    field = "customerId" if kind == "customers" else "fairId"
    scopes = {"own": str(organization_id), "foreign": str(uuid4()), "shared": None}

    def respond(request: httpx.Request) -> httpx.Response:
        assert request.url.path == f"/api/v1/{kind}/{target_id}"
        return httpx.Response(upstream_status, json={
            "id": str(target_id), "origin": origin, "organization_id": scopes[scope],
            "deleted_at": "2026-11-15T00:00:00Z" if deleted else None,
        })

    with httpx.Client(base_url="http://crm.test", transport=httpx.MockTransport(respond)) as crm:
        app.dependency_overrides[get_crm_reference_validator] = (
            lambda: lambda reference_kind, reference_id:
            validate_crm_reference(crm, reference_kind, reference_id, organization_id)
        )
        result = client.patch(f"{path}/assignments", headers=auth_headers, json={field: str(target_id)})
    assert result.status_code == expected, result.text
    persisted = client.get(path, headers=auth_headers).json()
    assert persisted[field] == (str(target_id) if expected == 200 else project[field])


def test_project_assignments_can_be_saved_independently_and_cleared(client, auth_headers):
    project = _create(client, auth_headers, "Assignments").json()
    path = f"/api/v1/fair-stand/projects/{project['id']}"
    fair_id = str(uuid4())
    assigned = client.patch(f"{path}/assignments", headers=auth_headers,
                            json={"fairId": fair_id, "customerId": CUSTOMER_B})
    assert assigned.status_code == 200, assigned.text
    assert assigned.json()["fairId"] == fair_id
    assert assigned.json()["customerId"] == CUSTOMER_B
    customer_cleared = client.patch(f"{path}/assignments", headers=auth_headers, json={"customerId": None})
    assert customer_cleared.status_code == 200
    assert customer_cleared.json()["fairId"] == fair_id
    assert customer_cleared.json()["customerId"] == str(UNASSIGNED_PROJECT_CUSTOMER_ID)
    fair_cleared = client.patch(f"{path}/assignments", headers=auth_headers, json={"fairId": None})
    assert fair_cleared.status_code == 200
    reloaded = client.get(path, headers=auth_headers).json()
    assert reloaded["fairId"] is None
    assert reloaded["customerId"] == str(UNASSIGNED_PROJECT_CUSTOMER_ID)


def test_project_assignments_reject_invalid_ids_and_extra_fields(client, auth_headers):
    project = _create(client, auth_headers, "Assignments").json()
    path = f"/api/v1/fair-stand/projects/{project['id']}"
    for payload in ({"fairId": "invalid"}, {"customerId": "invalid"}, {"name": "Changed"}):
        assert client.patch(f"{path}/assignments", headers=auth_headers, json=payload).status_code == 422
    stored = client.get(path, headers=auth_headers).json()
    assert stored["name"] == "Assignments"
    assert stored["customerId"] == CUSTOMER_A
    assert stored["fairId"] is None


def _create(client, auth_headers, name: str, customer_id: str = CUSTOMER_A):
    return client.post(
        "/api/v1/fair-stand/projects",
        headers=auth_headers,
        json={
            "name": name,
            "customerId": customer_id,
            "payload": {"stand": None, "modules": []},
        },
    )


def test_backfill_writes_temporary_customer_id_onto_existing_rows():
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE fair_stand_projects (
                    id TEXT PRIMARY KEY,
                    customer_id TEXT
                )
                """
            )
        )
        connection.execute(
            text("INSERT INTO fair_stand_projects (id, customer_id) VALUES ('existing', NULL)")
        )
        backfill_unassigned_project_customers(connection)
        stored = connection.execute(
            text("SELECT customer_id FROM fair_stand_projects WHERE id = 'existing'")
        ).scalar_one()
    assert stored == str(UNASSIGNED_PROJECT_CUSTOMER_ID)


def test_project_customer_is_optional_and_drawing_save_keeps_existing_link(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setenv("FAIR_STAND_PROJECT_ASSET_ROOT", str(tmp_path))
    from app.core.config import get_settings

    get_settings.cache_clear()

    missing = client.post(
        "/api/v1/fair-stand/projects",
        headers=auth_headers,
        json={"name": "No Customer", "payload": {"stand": None, "modules": []}},
    )
    assert missing.status_code == 201, missing.text
    assert missing.json()["customerId"] == str(UNASSIGNED_PROJECT_CUSTOMER_ID)
    persisted = client.get(f"/api/v1/fair-stand/projects/{missing.json()['id']}", headers=auth_headers)
    assert persisted.json()["customerId"] == str(UNASSIGNED_PROJECT_CUSTOMER_ID)

    created = _create(client, auth_headers, "Linked")
    assert created.status_code == 201, created.text
    project_id = created.json()["id"]
    assert created.json()["customerId"] == CUSTOMER_A

    drawing_save = client.put(
        f"/api/v1/fair-stand/projects/{project_id}",
        headers=auth_headers,
        json={
            "name": "Linked",
            "customerId": CUSTOMER_B,
            "payload": {"stand": {"standType": "island"}, "modules": []},
        },
    )
    assert drawing_save.status_code == 200, drawing_save.text
    assert drawing_save.json()["customerId"] == CUSTOMER_A
    assert drawing_save.json()["stand"]["standType"] == "island"

    bare_create = client.put(
        f"/api/v1/fair-stand/projects/{uuid4()}",
        headers=auth_headers,
        json={"name": "Bare", "payload": {"stand": None, "modules": []}},
    )
    assert bare_create.status_code == 200, bare_create.text
    assert bare_create.json()["customerId"] == str(UNASSIGNED_PROJECT_CUSTOMER_ID)


def test_customer_filter_and_reassign_stay_inside_the_organization(
    client, auth_headers, tmp_path, monkeypatch
):
    monkeypatch.setenv("FAIR_STAND_PROJECT_ASSET_ROOT", str(tmp_path))
    from app.core.config import get_settings

    get_settings.cache_clear()

    first = _create(client, auth_headers, "A", CUSTOMER_A)
    second = _create(client, auth_headers, "B", CUSTOMER_B)
    assert first.status_code == 201
    assert second.status_code == 201
    project_id = first.json()["id"]

    filtered = client.get(
        "/api/v1/fair-stand/projects",
        headers=auth_headers,
        params={"customerId": CUSTOMER_A},
    )
    assert filtered.status_code == 200
    assert [item["id"] for item in filtered.json()["projects"]] == [project_id]

    cleared = client.patch(
        f"/api/v1/fair-stand/projects/{project_id}/customer",
        headers=auth_headers,
        json={"customerId": None},
    )
    assert cleared.status_code == 422

    moved = client.patch(
        f"/api/v1/fair-stand/projects/{project_id}/customer",
        headers=auth_headers,
        json={"customerId": CUSTOMER_B},
    )
    assert moved.status_code == 200, moved.text
    assert moved.json()["customerId"] == CUSTOMER_B

    foreign = client.patch(
        f"/api/v1/fair-stand/projects/{project_id}/customer",
        headers={**auth_headers, "X-Organization-Id": str(uuid4())},
        json={"customerId": CUSTOMER_A},
    )
    assert foreign.status_code == 404

    still = client.get(f"/api/v1/fair-stand/projects/{project_id}", headers=auth_headers)
    assert still.json()["customerId"] == CUSTOMER_B
