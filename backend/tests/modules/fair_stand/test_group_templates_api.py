"""Organization group templates (sahne editörü Faz 5)."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import select

from app.integrations.kyrox_core.ports import AuthorizationPort
from app.modules.fair_stand.api.dependencies import (
    PERMISSION_PROJECTS_CREATE,
    PERMISSION_PROJECTS_DELETE,
    PERMISSION_PROJECTS_READ,
    PERMISSION_PROJECTS_UPDATE,
    get_authorization_adapter,
)
from app.modules.fair_stand.infrastructure.models import (
    FairStandGroupTemplateModel,
    FairStandItemModel,
    FairStandItemTypeModel,
)

BASE = "/api/v1/fair-stand/group-templates"


class SelectiveAuthorization(AuthorizationPort):
    def __init__(self, allowed: set[str]) -> None:
        self.allowed = allowed

    def check_permission(self, **kwargs) -> bool:
        return kwargs.get("permission_code") in self.allowed


def _allow(client, codes: set[str]) -> None:
    client.app.dependency_overrides[get_authorization_adapter] = lambda: SelectiveAuthorization(codes)


def _item(db_session, item_key: str) -> None:
    now = datetime.now(tz=UTC)
    if db_session.scalar(select(FairStandItemTypeModel).where(FairStandItemTypeModel.key == "panel")) is None:
        db_session.add(FairStandItemTypeModel(key="panel", display_name="Panel", is_active=True, created_at=now, updated_at=now))
        db_session.flush()
    db_session.add(
        FairStandItemModel(
            item_key=item_key,
            name=f"Name {item_key}",
            item_type="panel",
            catalog_visible=False,
            default_opacity=Decimal("1"),
            default_z_cm=Decimal("0"),
            is_render=False,
            accepts_color=False,
            accepts_image=False,
            accepts_lightbox=False,
            accepts_glass=False,
            accepts_mesh=False,
            is_cost_enabled=False,
            is_active=True,
            created_at=now,
            updated_at=now,
        )
    )
    db_session.flush()


def _member(item_key: str, x: float = 0, **extra) -> dict:
    return {
        "itemKey": item_key,
        "type": "flat-panel",
        "widthCm": 100,
        "heightCm": 350,
        "placement": {"xCm": x, "yCm": 0, "zCm": 0, "rotationZDeg": 0},
        **extra,
    }


def _payload(*members: dict) -> dict:
    return {"version": 1, "members": list(members)}


def test_create_list_get_rename_delete_within_organization(client, db_session, auth_headers):
    _item(db_session, "wall_100_350")
    _item(db_session, "tv_55")
    created = client.post(
        BASE,
        headers=auth_headers,
        json={"name": "  Raflı   TV'li duvar ", "payload": _payload(_member("wall_100_350"), _member("tv_55", 10))},
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["name"] == "Raflı TV'li duvar"
    assert body["memberCount"] == 2
    assert body["organizationId"] == auth_headers["X-Organization-Id"]
    template_id = body["id"]

    listed = client.get(BASE, headers=auth_headers).json()["templates"]
    assert [item["id"] for item in listed] == [template_id]
    assert "payload" not in listed[0]

    detail = client.get(f"{BASE}/{template_id}", headers=auth_headers)
    assert detail.status_code == 200
    assert detail.json()["payload"]["members"][1]["itemKey"] == "tv_55"

    renamed = client.patch(f"{BASE}/{template_id}", headers=auth_headers, json={"name": "Sağ duvar"})
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Sağ duvar"

    deleted = client.delete(f"{BASE}/{template_id}", headers=auth_headers)
    assert deleted.status_code == 204
    assert client.get(BASE, headers=auth_headers).json()["templates"] == []


def test_other_organization_cannot_see_or_change_a_template(client, db_session, auth_headers):
    _item(db_session, "wall_100_350")
    created = client.post(
        BASE,
        headers=auth_headers,
        json={"name": "Gizli", "payload": _payload(_member("wall_100_350"), _member("wall_100_350", 100))},
    ).json()
    foreign = {**auth_headers, "X-Organization-Id": str(uuid4())}
    assert client.get(BASE, headers=foreign).json()["templates"] == []
    assert client.get(f"{BASE}/{created['id']}", headers=foreign).status_code == 404
    assert client.patch(f"{BASE}/{created['id']}", headers=foreign, json={"name": "x"}).status_code == 404
    assert client.delete(f"{BASE}/{created['id']}", headers=foreign).status_code == 404
    # The original organization still has it, unchanged.
    row = db_session.scalar(select(FairStandGroupTemplateModel).where(FairStandGroupTemplateModel.id == UUID(created["id"])))
    assert row is not None and row.name == "Gizli"


def test_organization_comes_from_auth_not_body(client, db_session, auth_headers):
    _item(db_session, "wall_100_350")
    response = client.post(
        BASE,
        headers=auth_headers,
        json={
            "name": "x",
            "organizationId": str(uuid4()),
            "payload": _payload(_member("wall_100_350"), _member("wall_100_350", 100)),
        },
    )
    assert response.status_code == 422


def test_permissions_follow_project_permissions(client, db_session, auth_headers):
    _item(db_session, "wall_100_350")
    payload = _payload(_member("wall_100_350"), _member("wall_100_350", 100))

    _allow(client, {PERMISSION_PROJECTS_READ})
    assert client.get(BASE, headers=auth_headers).status_code == 200
    assert client.post(BASE, headers=auth_headers, json={"name": "x", "payload": payload}).status_code == 403

    _allow(client, {PERMISSION_PROJECTS_UPDATE})
    created = client.post(BASE, headers=auth_headers, json={"name": "x", "payload": payload})
    assert created.status_code == 201
    template_id = created.json()["id"]
    assert client.get(BASE, headers=auth_headers).status_code == 403
    assert client.delete(f"{BASE}/{template_id}", headers=auth_headers).status_code == 403

    _allow(client, {PERMISSION_PROJECTS_CREATE})
    assert client.patch(f"{BASE}/{template_id}", headers=auth_headers, json={"name": "y"}).status_code == 200

    _allow(client, {PERMISSION_PROJECTS_DELETE})
    assert client.delete(f"{BASE}/{template_id}", headers=auth_headers).status_code == 204


def test_payload_validation(client, db_session, auth_headers):
    _item(db_session, "wall_100_350")

    def post(payload, name="x"):
        return client.post(BASE, headers=auth_headers, json={"name": name, "payload": payload})

    assert post(_payload(_member("wall_100_350"))).status_code == 422  # fewer than 2 parts
    assert post({"version": 2, "members": [_member("wall_100_350"), _member("wall_100_350")]}).status_code == 422
    assert post(_payload(_member("wall_100_350"), _member("missing_item"))).status_code == 422
    assert post(_payload(_member("wall_100_350"), _member("wall_100_350", id="m-1"))).status_code == 422
    assert post(_payload(_member("wall_100_350"), _member("wall_100_350", group={"id": "g"}))).status_code == 422
    with_image = _member("wall_100_350", strips=[{"imageAssetId": "asset-1"}])
    assert post(_payload(_member("wall_100_350"), with_image)).status_code == 422
    bad_place = _member("wall_100_350")
    bad_place["placement"]["xCm"] = "left"
    assert post(_payload(_member("wall_100_350"), bad_place)).status_code == 422
    assert post(_payload(_member("wall_100_350"), _member("wall_100_350")), name="   ").status_code == 422
    assert post(_payload(*[_member("wall_100_350", index) for index in range(201)])).status_code == 422
    # Cleared image references are fine.
    cleared = _member("wall_100_350", strips=[{"imageAssetId": None, "color": "#ffffff"}])
    assert post(_payload(_member("wall_100_350"), cleared)).status_code == 201
