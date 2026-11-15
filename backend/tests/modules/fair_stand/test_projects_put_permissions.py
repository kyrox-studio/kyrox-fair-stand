from __future__ import annotations

from uuid import uuid4

from app.integrations.kyrox_core.ports import AuthorizationPort
from app.main import app
from app.modules.fair_stand.api.dependencies import (
    PERMISSION_PROJECTS_CREATE,
    PERMISSION_PROJECTS_UPDATE,
    get_authorization_adapter,
)


class SelectiveAuthorization(AuthorizationPort):
    def __init__(self, allowed: set[str]) -> None:
        self.allowed = allowed

    def check_permission(self, **kwargs) -> bool:
        return kwargs.get("permission_code") in self.allowed


def test_put_create_vs_update_permission_split(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setenv("FAIR_STAND_PROJECT_ASSET_ROOT", str(tmp_path))
    from app.core.config import get_settings

    get_settings.cache_clear()

    project_id = str(uuid4())
    create_only = SelectiveAuthorization({PERMISSION_PROJECTS_CREATE})
    update_only = SelectiveAuthorization({PERMISSION_PROJECTS_UPDATE})

    app.dependency_overrides[get_authorization_adapter] = lambda: create_only
    created = client.put(
        f"/api/v1/fair-stand/projects/{project_id}",
        headers=auth_headers,
        json={
            "name": "Yeni",
            "customerId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            "payload": {"stand": None, "modules": []},
        },
    )
    assert created.status_code == 200, created.text

    # create-only cannot update existing
    blocked = client.put(
        f"/api/v1/fair-stand/projects/{project_id}",
        headers=auth_headers,
        json={"name": "Guncelle", "payload": {"stand": None, "modules": []}},
    )
    assert blocked.status_code == 403
    assignments_url = f"/api/v1/fair-stand/projects/{project_id}/assignments"
    fair_id = str(uuid4())
    assert client.patch(assignments_url, headers=auth_headers, json={"fairId": fair_id}).status_code == 403

    app.dependency_overrides[get_authorization_adapter] = lambda: update_only
    updated = client.put(
        f"/api/v1/fair-stand/projects/{project_id}",
        headers=auth_headers,
        json={"name": "Guncelle", "payload": {"stand": None, "modules": []}},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["name"] == "Guncelle"
    assert updated.json()["fairId"] is None
    assert client.patch(assignments_url, headers=auth_headers, json={"fairId": fair_id}).status_code == 403
    update_only.allowed.add("fair_crm.fairs.read")
    assert client.patch(
        assignments_url, headers=auth_headers, json={"fairId": fair_id, "customerId": None},
    ).status_code == 403
    assigned = client.patch(assignments_url, headers=auth_headers, json={"fairId": fair_id})
    assert assigned.status_code == 200, assigned.text
    assert assigned.json()["fairId"] == fair_id
    assert assigned.json()["customerId"] == created.json()["customerId"]

    # update-only cannot create missing
    missing_id = str(uuid4())
    missing = client.put(
        f"/api/v1/fair-stand/projects/{missing_id}",
        headers=auth_headers,
        json={"name": "Yok", "payload": {"stand": None, "modules": []}},
    )
    assert missing.status_code == 403
