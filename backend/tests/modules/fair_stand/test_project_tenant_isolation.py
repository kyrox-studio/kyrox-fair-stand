"""Project tenant isolation: organization ABC owns a project and an asset; XYZ cannot touch them.

TENANT_ISOLATION_SYSTEM_TEST_STANDARD baseline for projects, revisions, customer
assignment, assets and export: own-organization success, foreign direct IDs,
cross-linked asset IDs, and the trusted organization context.
"""

from __future__ import annotations

import io
from uuid import uuid4

import pytest
from PIL import Image

CUSTOMER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
PROJECTS = "/api/v1/fair-stand/projects"


def _png_bytes() -> bytes:
    image = Image.new("RGB", (32, 32), color=(20, 120, 200))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.fixture
def asset_root(tmp_path, monkeypatch):
    monkeypatch.setenv("FAIR_STAND_PROJECT_ASSET_ROOT", str(tmp_path))
    from app.core.config import get_settings

    get_settings.cache_clear()
    return tmp_path


@pytest.fixture
def foreign_headers(auth_headers):
    return {**auth_headers, "X-Organization-Id": str(uuid4())}


def _create_project(client, headers, name="ABC Stand"):
    created = client.post(
        PROJECTS,
        headers=headers,
        json={"name": name, "customerId": CUSTOMER_ID, "payload": {"stand": {}, "modules": []}},
    )
    assert created.status_code == 201, created.text
    return created.json()["id"]


def _upload_asset(client, headers, project_id, asset_id):
    uploaded = client.post(
        f"{PROJECTS}/{project_id}/assets",
        headers=headers,
        files={"file": ("logo.png", _png_bytes(), "image/png")},
        data={"asset_id": asset_id, "name": "logo.png"},
    )
    return uploaded


def test_foreign_organization_cannot_read_or_list_project(client, auth_headers, foreign_headers, asset_root):
    project_id = _create_project(client, auth_headers)

    assert client.get(f"{PROJECTS}/{project_id}", headers=auth_headers).status_code == 200
    assert client.get(f"{PROJECTS}/{project_id}", headers=foreign_headers).status_code == 404

    foreign_list = client.get(PROJECTS, headers=foreign_headers)
    assert foreign_list.status_code == 200
    assert all(project["id"] != project_id for project in foreign_list.json()["projects"])


def test_foreign_organization_cannot_update_reassign_or_delete_project(
    client, auth_headers, foreign_headers, asset_root
):
    project_id = _create_project(client, auth_headers)

    # PUT upserts a missing id for its caller; an id owned by another organization is not
    # treated as missing and is never overwritten.
    foreign_put = client.put(
        f"{PROJECTS}/{project_id}",
        headers=foreign_headers,
        json={"name": "Hijacked", "payload": {"stand": {}, "modules": []}},
    )
    assert foreign_put.status_code == 404

    foreign_customer = client.patch(
        f"{PROJECTS}/{project_id}/customer",
        headers=foreign_headers,
        json={"customerId": str(uuid4())},
    )
    assert foreign_customer.status_code == 404

    assert client.delete(f"{PROJECTS}/{project_id}", headers=foreign_headers).status_code == 404

    own = client.get(f"{PROJECTS}/{project_id}", headers=auth_headers)
    assert own.status_code == 200
    assert own.json()["name"] == "ABC Stand"
    assert own.json()["customerId"] == CUSTOMER_ID


def test_foreign_organization_cannot_reach_assets_or_export(
    client, auth_headers, foreign_headers, asset_root
):
    project_id = _create_project(client, auth_headers)
    asset_id = str(uuid4())
    assert _upload_asset(client, auth_headers, project_id, asset_id).status_code == 201

    asset_url = f"{PROJECTS}/{project_id}/assets/{asset_id}"
    assert client.get(asset_url, headers=foreign_headers).status_code == 404
    assert client.delete(asset_url, headers=foreign_headers).status_code == 404
    assert _upload_asset(client, foreign_headers, project_id, str(uuid4())).status_code == 404
    assert client.get(f"{PROJECTS}/{project_id}/export", headers=foreign_headers).status_code == 404

    # The asset and the export are still there for the owning organization.
    assert client.get(asset_url, headers=auth_headers).status_code == 200
    assert client.get(f"{PROJECTS}/{project_id}/export", headers=auth_headers).status_code == 200


def test_foreign_organization_cannot_hijack_asset_id_through_own_project(
    client, auth_headers, foreign_headers, asset_root
):
    abc_project = _create_project(client, auth_headers)
    asset_id = str(uuid4())
    assert _upload_asset(client, auth_headers, abc_project, asset_id).status_code == 201

    # XYZ uploads into its own project with ABC's asset id (cross-linked reference).
    xyz_project = _create_project(client, foreign_headers, name="XYZ Stand")
    hijack = _upload_asset(client, foreign_headers, xyz_project, asset_id)
    assert hijack.status_code == 404
    assert client.get(f"{PROJECTS}/{xyz_project}/assets/{asset_id}", headers=foreign_headers).status_code == 404

    assert client.get(f"{PROJECTS}/{abc_project}/assets/{asset_id}", headers=auth_headers).status_code == 200


def test_organization_comes_from_trusted_context_not_body(client, auth_headers, asset_root):
    rejected = client.post(
        PROJECTS,
        headers=auth_headers,
        json={
            "name": "Spoof",
            "customerId": CUSTOMER_ID,
            "organization_id": str(uuid4()),
            "payload": {"stand": {}, "modules": []},
        },
    )
    assert rejected.status_code == 422

    missing_context = {key: value for key, value in auth_headers.items() if key != "X-Organization-Id"}
    assert client.get(PROJECTS, headers=missing_context).status_code == 422
