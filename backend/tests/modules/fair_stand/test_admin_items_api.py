from uuid import UUID

from app.integrations.kyrox_core.ports import AuthorizationPort
from app.modules.fair_stand.api.dependencies import (
    PERMISSION_ITEMS_CREATE,
    PERMISSION_ITEMS_READ,
    PERMISSION_ITEMS_UPDATE,
    get_authorization_adapter,
)
from app.modules.fair_stand.infrastructure.seed_catalog import seed_fair_stand_catalog


class SelectiveAuthorization(AuthorizationPort):
    def __init__(self, *, allowed: set[str] | None = None, denied: set[str] | None = None) -> None:
        self._allowed = allowed
        self._denied = denied or set()

    def check_permission(
        self,
        *,
        organization_id: UUID,
        user_id: UUID,
        permission_code: str,
        access_token: str,
    ) -> bool:
        _ = (organization_id, user_id, access_token)
        if permission_code in self._denied:
            return False
        if self._allowed is None:
            return True
        return permission_code in self._allowed


def _allow(client, codes: set[str]):
    client.app.dependency_overrides[get_authorization_adapter] = lambda: SelectiveAuthorization(
        allowed=codes
    )


def test_admin_item_records_list_and_get(client, db_session, auth_headers):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    _allow(client, {PERMISSION_ITEMS_READ})
    listed = client.get("/api/v1/fair-stand/admin/item-records", headers=auth_headers)
    assert listed.status_code == 200
    body = listed.json()
    assert "items" in body
    assert body["pagination"]["page"] == 1
    assert body["pagination"]["pageSize"] == 25
    assert body["pagination"]["totalItems"] >= 90
    assert len(body["items"]) == 25
    assert body["sorting"]["field"] == "itemKey"
    detail = client.get("/api/v1/fair-stand/admin/item-records/wall_200_350", headers=auth_headers)
    assert detail.status_code == 200
    detail_body = detail.json()
    assert detail_body["itemKey"] == "wall_200_350"
    assert detail_body["dimensions"] is not None
    assert isinstance(detail_body["components"], list)
    assert isinstance(detail_body["assets"], list)
    if detail_body["components"]:
        component = detail_body["components"][0]
        assert "childItemKey" in component
        assert "childName" in component
        assert "childType" in component
        assert component["childName"]
        assert component["childType"]


def test_admin_item_records_list_search_filter_and_page(client, db_session, auth_headers):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    _allow(client, {PERMISSION_ITEMS_READ})
    response = client.get(
        "/api/v1/fair-stand/admin/item-records",
        headers=auth_headers,
        params={
            "page": 1,
            "pageSize": 10,
            # 0082: wall_200_350 katalogda gizli; görünür Panel kartı wall_100_350.
            "search": "wall_100_350",
            "status": "active",
            "catalog": "visible",
            "render": "yes",
            "type": "flat-panel",
            "sort_by": "name",
            "sort_order": "asc",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["pagination"]["pageSize"] == 10
    assert body["pagination"]["totalItems"] >= 1
    assert any(item["itemKey"] == "wall_100_350" for item in body["items"])
    assert body["filters"]["status"] == "active"
    assert body["filters"]["catalog"] == "visible"
    assert body["filters"]["render"] == "yes"
    assert body["filters"]["type"] == "flat-panel"
    assert body["sorting"]["field"] == "name"
    assert "flat-panel" in body["filterOptions"]["types"]
    assert isinstance(body["filterOptions"].get("units"), list)
    assert isinstance(body["filterOptions"].get("materials"), list)


def test_item_unit_dropdown_lists_the_unit_catalog_not_only_used_units(client, db_session, auth_headers):
    from datetime import UTC, datetime

    from app.modules.fair_stand.infrastructure.models import FairStandUnitModel

    seed_fair_stand_catalog(db_session)
    now = datetime.now(tz=UTC)
    db_session.add(
        FairStandUnitModel(
            unit_key="sefer",
            name="Sefer",
            symbol="sefer",
            is_active=True,
            created_at=now,
            updated_at=now,
        )
    )
    db_session.add(
        FairStandUnitModel(
            unit_key="kapali_birim",
            name="Kapalı",
            symbol="k",
            is_active=False,
            created_at=now,
            updated_at=now,
        )
    )
    db_session.flush()
    _allow(client, {PERMISSION_ITEMS_READ})
    response = client.get("/api/v1/fair-stand/admin/item-records", headers=auth_headers)
    assert response.status_code == 200
    units = response.json()["filterOptions"]["units"]
    assert "adet" in units
    assert "sefer" in units
    assert "kapali_birim" not in units


def test_admin_item_records_update_dimensions_and_components(client, db_session, auth_headers):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    _allow(client, {PERMISSION_ITEMS_UPDATE})
    response = client.put(
        "/api/v1/fair-stand/admin/item-records/shelf_100",
        headers=auth_headers,
        json={
            "name": "Shelf 100 Updated",
            "dimensions": {"width_cm": 100, "depth_cm": 30, "height_cm": 4},
            "components": [{"child_item_key": "shelf_leg", "quantity": 2}],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Shelf 100 Updated"
    assert body["dimensions"]["widthCm"] == 100
    assert body["components"][0]["childItemKey"] == "shelf_leg"
    assert body["components"][0]["childName"]
    assert body["components"][0]["childType"]


def test_admin_item_records_create_minimal(client, db_session, auth_headers):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    _allow(client, {PERMISSION_ITEMS_CREATE})
    response = client.post(
        "/api/v1/fair-stand/admin/item-records",
        headers=auth_headers,
        json={"item_key": "admin_test_sku", "name": "Admin Test", "item_type": "panel"},
    )
    assert response.status_code == 201
    assert response.json()["itemKey"] == "admin_test_sku"


def test_unknown_unit_is_a_client_error_and_inactive_unit_is_accepted(client, db_session, auth_headers):
    from datetime import UTC, datetime

    from app.modules.fair_stand.infrastructure.models import FairStandUnitModel

    seed_fair_stand_catalog(db_session)
    db_session.flush()
    _allow(client, {PERMISSION_ITEMS_CREATE, PERMISSION_ITEMS_UPDATE})
    unknown = client.post(
        "/api/v1/fair-stand/admin/item-records",
        headers=auth_headers,
        json={
            "item_key": "unknown_unit_sku",
            "name": "Unknown Unit",
            "item_type": "panel",
            "unit": "yok_boyle_bir_birim",
        },
    )
    assert unknown.status_code == 400
    assert "katalogda yok" in unknown.json()["detail"]

    now = datetime.now(tz=UTC)
    db_session.add(
        FairStandUnitModel(
            unit_key="pasif_birim",
            name="Pasif",
            symbol="p",
            is_active=False,
            created_at=now,
            updated_at=now,
        )
    )
    db_session.flush()
    created = client.post(
        "/api/v1/fair-stand/admin/item-records",
        headers=auth_headers,
        json={
            "item_key": "inactive_unit_sku",
            "name": "Inactive Unit",
            "item_type": "panel",
            "unit": "pasif_birim",
        },
    )
    assert created.status_code == 201
    assert created.json()["unit"] == "pasif_birim"


def test_admin_item_records_catalog_visible_requires_triad(client, db_session, auth_headers):
    from sqlalchemy import func, select

    from app.modules.fair_stand.infrastructure.models import (
        FairStandCatalogPreviewKindModel,
        FairStandCategoryModel,
        FairStandItemModel,
    )

    seed_fair_stand_catalog(db_session)
    db_session.flush()
    category_id = db_session.scalars(select(FairStandCategoryModel.id)).first()
    preview_id = db_session.scalars(select(FairStandCatalogPreviewKindModel.id)).first()
    assert category_id is not None and preview_id is not None
    visible_count = db_session.scalar(
        select(func.count())
        .select_from(FairStandItemModel)
        .where(
            FairStandItemModel.category_id == category_id,
            FairStandItemModel.catalog_visible.is_(True),
        )
    )
    next_index = int(visible_count or 0) + 1
    _allow(client, {PERMISSION_ITEMS_CREATE, PERMISSION_ITEMS_UPDATE})

    create = client.post(
        "/api/v1/fair-stand/admin/item-records",
        headers=auth_headers,
        json={
            "item_key": "catalog_visible_gap",
            "name": "Catalog Visible Gap",
            "item_type": "panel",
            "catalog_visible": True,
        },
    )
    assert create.status_code == 400
    assert "kategori" in create.json()["detail"].lower()

    hidden = client.post(
        "/api/v1/fair-stand/admin/item-records",
        headers=auth_headers,
        json={
            "item_key": "catalog_hidden_ok",
            "name": "Catalog Hidden Ok",
            "item_type": "panel",
            "catalog_visible": False,
            "category_id": category_id,
            "catalog_item_index": 991,
            "preview_id": preview_id,
        },
    )
    assert hidden.status_code == 201, hidden.text
    assert hidden.json()["catalogVisible"] is False
    assert hidden.json()["categoryId"] == category_id
    assert hidden.json()["catalogItemIndex"] == 991

    bad_index = client.put(
        "/api/v1/fair-stand/admin/item-records/catalog_hidden_ok",
        headers=auth_headers,
        json={"catalog_visible": True, "catalog_item_index": 0},
    )
    assert bad_index.status_code == 400

    clamped = client.put(
        "/api/v1/fair-stand/admin/item-records/catalog_hidden_ok",
        headers=auth_headers,
        json={"catalog_visible": True, "catalog_item_index": next_index + 50},
    )
    assert clamped.status_code == 200, clamped.text
    assert clamped.json()["catalogItemIndex"] == next_index

    # already visible at end; move to front
    turn_on = client.put(
        "/api/v1/fair-stand/admin/item-records/catalog_hidden_ok",
        headers=auth_headers,
        json={"catalog_item_index": 1},
    )
    assert turn_on.status_code == 200, turn_on.text
    assert turn_on.json()["catalogVisible"] is True
    assert turn_on.json()["categoryId"] == category_id
    assert turn_on.json()["catalogItemIndex"] == 1
    clear_while_visible = client.put(
        "/api/v1/fair-stand/admin/item-records/catalog_hidden_ok",
        headers=auth_headers,
        json={"category_id": None},
    )
    assert clear_while_visible.status_code == 400

    turn_off = client.put(
        "/api/v1/fair-stand/admin/item-records/catalog_hidden_ok",
        headers=auth_headers,
        json={"catalog_visible": False},
    )
    assert turn_off.status_code == 200, turn_off.text
    body = turn_off.json()
    assert body["catalogVisible"] is False
    assert body["categoryId"] == category_id
    assert body["previewId"] == preview_id
    # Stale index may remain; peers must stay contiguous 1..N
    peer_indices = sorted(
        db_session.scalars(
            select(FairStandItemModel.catalog_item_index).where(
                FairStandItemModel.category_id == category_id,
                FairStandItemModel.catalog_visible.is_(True),
            )
        ).all()
    )
    assert peer_indices == list(range(1, len(peer_indices) + 1))


def test_admin_update_hidden_item_skips_catalog_index_contiguous_check(
    client, db_session, auth_headers
):
    """catalog_visible=false güncellemesi, kategorideki 1..N boşluğundan etkilenmemeli."""
    from datetime import UTC, datetime

    from sqlalchemy import select

    from app.modules.fair_stand.infrastructure.models import (
        FairStandCatalogPreviewKindModel,
        FairStandCategoryModel,
        FairStandItemModel,
    )

    seed_fair_stand_catalog(db_session)
    db_session.flush()
    category_id = db_session.scalars(select(FairStandCategoryModel.id)).first()
    preview_id = db_session.scalars(select(FairStandCatalogPreviewKindModel.id)).first()
    assert category_id is not None and preview_id is not None
    now = datetime.now(tz=UTC)

    # Seed a visible peer gap (index 99) — would fail assert_category_order if run.
    gap_item = FairStandItemModel(
        item_key="catalog_gap_peer",
        name="Gap Peer",
        item_type="panel",
        catalog_visible=True,
        category_id=category_id,
        catalog_item_index=99,
        preview_id=preview_id,
        is_render=True,
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    hidden = FairStandItemModel(
        item_key="catalog_hidden_edit",
        name="Hidden Edit",
        item_type="profile",
        catalog_visible=False,
        category_id=category_id,
        catalog_item_index=12,
        preview_id=preview_id,
        is_render=True,
        is_active=True,
        material="alüminyum",
        created_at=now,
        updated_at=now,
    )
    db_session.add_all([gap_item, hidden])
    db_session.flush()
    _allow(client, {PERMISSION_ITEMS_UPDATE})

    updated = client.put(
        "/api/v1/fair-stand/admin/item-records/catalog_hidden_edit",
        headers=auth_headers,
        json={
            "name": "Hidden Edit Updated",
            "catalog_visible": False,
            "category_id": category_id,
            "catalog_item_index": 12,
            "preview_id": preview_id,
            "material": "alüminyum",
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["name"] == "Hidden Edit Updated"
    assert updated.json()["catalogVisible"] is False


def test_admin_item_catalog_index_insert_shifts_peers(client, db_session, auth_headers):
    from sqlalchemy import select

    from app.modules.fair_stand.infrastructure.models import (
        FairStandCatalogPreviewKindModel,
        FairStandCategoryModel,
        FairStandItemModel,
    )

    seed_fair_stand_catalog(db_session)
    db_session.flush()
    category_id = db_session.scalars(select(FairStandCategoryModel.id)).first()
    preview_id = db_session.scalars(select(FairStandCatalogPreviewKindModel.id)).first()
    first = db_session.scalars(
        select(FairStandItemModel).where(
            FairStandItemModel.category_id == category_id,
            FairStandItemModel.catalog_visible.is_(True),
            FairStandItemModel.catalog_item_index == 1,
        )
    ).first()
    assert first is not None and preview_id is not None
    previous_key = first.item_key
    _allow(client, {PERMISSION_ITEMS_CREATE, PERMISSION_ITEMS_UPDATE})

    created = client.post(
        "/api/v1/fair-stand/admin/item-records",
        headers=auth_headers,
        json={
            "item_key": "catalog_insert_front",
            "name": "Catalog Insert Front",
            "item_type": "panel",
            "catalog_visible": True,
            "category_id": category_id,
            "catalog_item_index": 1,
            "preview_id": preview_id,
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["catalogItemIndex"] == 1

    db_session.expire_all()
    previous = db_session.get(FairStandItemModel, previous_key)
    assert previous is not None
    assert previous.catalog_item_index == 2


def test_admin_clone_item_copies_satellites_and_appends_catalog_index(
    client, db_session, auth_headers
):
    from sqlalchemy import func, select

    from app.modules.fair_stand.infrastructure.models import (
        FairStandItemComponentModel,
        FairStandItemModel,
    )

    seed_fair_stand_catalog(db_session)
    db_session.flush()
    _allow(client, {PERMISSION_ITEMS_CREATE, PERMISSION_ITEMS_READ})

    # 0082: kaynak görünür Panel kartı (wall_200_350 katalogda gizli).
    source = client.get(
        "/api/v1/fair-stand/admin/item-records/wall_100_350",
        headers=auth_headers,
    )
    assert source.status_code == 200, source.text
    source_body = source.json()
    assert source_body["catalogVisible"] is True
    category_id = source_body["categoryId"]
    max_index = db_session.scalar(
        select(func.max(FairStandItemModel.catalog_item_index)).where(
            FairStandItemModel.category_id == category_id,
            FairStandItemModel.catalog_visible.is_(True),
        )
    )
    assert max_index is not None

    cloned = client.post(
        "/api/v1/fair-stand/admin/item-records/wall_100_350/clone",
        headers=auth_headers,
        json={"item_key": "wall_100_350_copy", "name": "Wall 100 350 Kopya"},
    )
    assert cloned.status_code == 201, cloned.text
    body = cloned.json()
    assert body["itemKey"] == "wall_100_350_copy"
    assert body["name"] == "Wall 100 350 Kopya"
    assert body["type"] == source_body["type"]
    assert body["catalogVisible"] is True
    assert body["categoryId"] == category_id
    assert body["catalogItemIndex"] == int(max_index) + 1
    assert body["previewId"] == source_body["previewId"]
    assert len(body["components"]) == len(source_body["components"])
    if source_body["components"]:
        assert body["components"][0]["childItemKey"] == source_body["components"][0]["childItemKey"]
        assert body["components"][0]["quantity"] == source_body["components"][0]["quantity"]
    assert len(body["assets"]) == len(source_body["assets"])
    if source_body["assets"]:
        assert body["assets"][0]["relativePath"] == source_body["assets"][0]["relativePath"]

    db_session.expire_all()
    assert db_session.get(FairStandItemModel, "wall_100_350_copy") is not None
    source_comp_count = db_session.scalar(
        select(func.count()).select_from(FairStandItemComponentModel).where(
            FairStandItemComponentModel.parent_item_key == "wall_100_350"
        )
    )
    clone_comp_count = db_session.scalar(
        select(func.count()).select_from(FairStandItemComponentModel).where(
            FairStandItemComponentModel.parent_item_key == "wall_100_350_copy"
        )
    )
    assert clone_comp_count == source_comp_count

    conflict = client.post(
        "/api/v1/fair-stand/admin/item-records/wall_100_350/clone",
        headers=auth_headers,
        json={"item_key": "wall_100_350_copy", "name": "Again"},
    )
    assert conflict.status_code == 409
