"""Kesit 1: item_type placement/collision/move_snap_cm — gevşetmesiz."""

from __future__ import annotations

from sqlalchemy import select

from app.modules.fair_stand.application.admin_snap_catalog import (
    AdminSnapCatalogService,
    SnapCatalogAdminError,
)
from app.modules.fair_stand.infrastructure.item_type_behavior_seed import (
    TYPE_BEHAVIOR_SLICE1,
    behavior_slice1_for_type,
)
from app.modules.fair_stand.infrastructure.models import FairStandItemTypeModel
from app.modules.fair_stand.infrastructure.seed_catalog import seed_fair_stand_catalog


def test_behavior_slice1_matches_known_types():
    assert behavior_slice1_for_type("flat-panel") == ("wall", "segment", 10)
    assert behavior_slice1_for_type("shelf") == ("wall-overlay", "none", 10)
    assert behavior_slice1_for_type("led-floodlight") == ("top", "none", 10)
    assert behavior_slice1_for_type("upright") == ("free", "footprint", 10)
    assert behavior_slice1_for_type("unknown-type") == ("wall", "segment", 10)


def test_seeded_item_types_match_type_behaviors_slice1(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()

    rows = {
        row.key: row
        for row in db_session.scalars(select(FairStandItemTypeModel)).all()
    }
    missing = sorted(set(TYPE_BEHAVIOR_SLICE1) - set(rows))
    assert missing == [], f"seed eksik tip(ler): {missing}"

    for key, (placement, collision, move_snap_cm) in TYPE_BEHAVIOR_SLICE1.items():
        behavior = rows[key].scene_behavior
        assert behavior is not None, key
        assert behavior.placement == placement, key
        assert behavior.collision == collision, key
        assert int(behavior.move_snap_cm) == move_snap_cm, key


def test_seeded_item_types_match_type_behaviors_slice2(db_session):
    from app.modules.fair_stand.infrastructure.item_type_behavior_seed import TYPE_BEHAVIOR_SLICE2

    seed_fair_stand_catalog(db_session)
    db_session.flush()

    rows = {
        row.key: row
        for row in db_session.scalars(select(FairStandItemTypeModel)).all()
    }
    missing = sorted(set(TYPE_BEHAVIOR_SLICE2) - set(rows))
    assert missing == [], f"seed eksik tip(ler): {missing}"

    for key, (magnetic, allow_side, supports_overlay, capacity) in TYPE_BEHAVIOR_SLICE2.items():
        behavior = rows[key].scene_behavior
        assert behavior is not None, key
        assert behavior.magnetic_snap == magnetic, key
        assert bool(behavior.allow_side_insert) is allow_side, key
        assert bool(behavior.supports_wall_overlay_mount) is supports_overlay, key
        assert behavior.wall_capacity == capacity, key


def test_seeded_item_types_match_type_behaviors_slice3(db_session):
    from decimal import Decimal

    from app.modules.fair_stand.infrastructure.item_type_behavior_seed import TYPE_BEHAVIOR_SLICE3

    seed_fair_stand_catalog(db_session)
    db_session.flush()

    rows = {
        row.key: row
        for row in db_session.scalars(select(FairStandItemTypeModel)).all()
    }
    missing = sorted(set(TYPE_BEHAVIOR_SLICE3) - set(rows))
    assert missing == [], f"seed eksik tip(ler): {missing}"

    for key, expected in TYPE_BEHAVIOR_SLICE3.items():
        (
            endpoint,
            depth,
            contact,
            boundary,
            height,
            overlap,
            ghost_kind,
            ghost_renderer,
            ghost_opacity,
        ) = expected
        row = rows[key]
        behavior = row.scene_behavior
        assert behavior is not None, key
        assert behavior.connection_endpoint == endpoint, key
        assert behavior.collision_depth == depth, key
        assert behavior.endpoint_contact == contact, key
        assert behavior.boundary_snap == boundary, key
        assert behavior.collision_height == height, key
        assert sorted(item.key for item in (row.overlap_types or [])) == sorted(overlap), key
        assert behavior.ghost_kind == ghost_kind, key
        assert behavior.ghost_renderer == ghost_renderer, key
        assert Decimal(str(behavior.ghost_opacity)) == ghost_opacity, key


def test_bootstrap_item_types_expose_placement_slice(client, db_session, auth_headers):
    from app.modules.fair_stand.infrastructure.item_type_behavior_seed import (
        TYPE_BEHAVIOR_SLICE2,
        TYPE_BEHAVIOR_SLICE3,
    )

    seed_fair_stand_catalog(db_session)
    db_session.flush()

    response = client.get("/api/v1/fair-stand/catalog/bootstrap", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    by_key = {row["key"]: row for row in body["itemTypes"]}

    missing = sorted(
        (set(TYPE_BEHAVIOR_SLICE1) | set(TYPE_BEHAVIOR_SLICE2) | set(TYPE_BEHAVIOR_SLICE3))
        - set(by_key)
    )
    assert missing == [], f"bootstrap itemTypes eksik: {missing}"

    for key, (placement, collision, move_snap_cm) in TYPE_BEHAVIOR_SLICE1.items():
        row = by_key[key]
        assert row["placement"] == placement, key
        assert row["collision"] == collision, key
        assert int(row["moveSnapCm"]) == move_snap_cm, key
        assert "move_snap_cm" not in row, key

    for key, (magnetic, allow_side, supports_overlay, capacity) in TYPE_BEHAVIOR_SLICE2.items():
        row = by_key[key]
        assert row["magneticSnap"] == magnetic, key
        assert row["allowSideInsert"] is allow_side, key
        assert row["supportsWallOverlayMount"] is supports_overlay, key
        assert row["wallCapacity"] == capacity, key

    for key, expected in TYPE_BEHAVIOR_SLICE3.items():
        (
            endpoint,
            depth,
            contact,
            boundary,
            height,
            overlap,
            ghost_kind,
            ghost_renderer,
            ghost_opacity,
        ) = expected
        row = by_key[key]
        assert row["connectionEndpoint"] == endpoint, key
        assert row["collisionDepth"] == depth, key
        assert row["endpointContact"] == contact, key
        assert row["boundarySnap"] == boundary, key
        assert row["collisionHeight"] == height, key
        assert row["overlapWithTypes"] == sorted(overlap), key
        assert row["ghost"]["kind"] == ghost_kind, key
        assert row["ghost"]["renderer"] == ghost_renderer, key
        assert float(row["ghost"]["opacity"]) == float(ghost_opacity), key


def test_admin_item_types_list_includes_placement_slice(client, db_session, auth_headers):
    from app.modules.fair_stand.infrastructure.item_type_behavior_seed import (
        TYPE_BEHAVIOR_SLICE2,
        TYPE_BEHAVIOR_SLICE3,
    )

    seed_fair_stand_catalog(db_session)
    db_session.flush()

    response = client.get("/api/v1/fair-stand/admin/item-types", headers=auth_headers)
    assert response.status_code == 200
    by_key = {row["key"]: row for row in response.json()}

    missing = sorted(
        (set(TYPE_BEHAVIOR_SLICE1) | set(TYPE_BEHAVIOR_SLICE2) | set(TYPE_BEHAVIOR_SLICE3))
        - set(by_key)
    )
    assert missing == [], f"admin item-types eksik: {missing}"

    for key, (placement, collision, move_snap_cm) in TYPE_BEHAVIOR_SLICE1.items():
        row = by_key[key]
        assert row["placement"] == placement, key
        assert row["collision"] == collision, key
        assert int(row["moveSnapCm"]) == move_snap_cm, key

    for key, (magnetic, allow_side, supports_overlay, capacity) in TYPE_BEHAVIOR_SLICE2.items():
        row = by_key[key]
        assert row["magneticSnap"] == magnetic, key
        assert row["allowSideInsert"] is allow_side, key
        assert row["supportsWallOverlayMount"] is supports_overlay, key
        assert row["wallCapacity"] == capacity, key

    for key, expected in TYPE_BEHAVIOR_SLICE3.items():
        endpoint, depth, contact, boundary, height, overlap, *_ghost = expected
        row = by_key[key]
        assert row["connectionEndpoint"] == endpoint, key
        assert row["collisionDepth"] == depth, key
        assert row["endpointContact"] == contact, key
        assert row["boundarySnap"] == boundary, key
        assert row["collisionHeight"] == height, key
        assert row["overlapWithTypes"] == sorted(overlap), key
        assert "overlapItemTypeIds" in row, key


def test_item_type_admin_create_update_behavior_fields(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    service = AdminSnapCatalogService(db_session)
    created = service.create_item_type(
        display_name="Test Tip",
        key="test-behavior-type",
        placement="free",
        collision="footprint",
        move_snap_cm=25,
        magnetic_snap="standard",
        allow_side_insert=True,
        supports_wall_overlay_mount=True,
        wall_capacity="include",
        connection_endpoint="logical-fixture",
        collision_depth="wall-backbone",
        endpoint_contact="standard",
        boundary_snap="stand-edge",
        collision_height="full",
        overlap_with_types=["kettle"],
        ghost_kind="silhouette",
        ghost_renderer="module-silhouette",
        ghost_opacity=0.5,
    )
    assert created["placement"] == "free"
    assert created["collision"] == "footprint"
    assert created["moveSnapCm"] == 25
    assert created["connectionEndpoint"] == "logical-fixture"
    assert created["collisionDepth"] == "wall-backbone"
    assert created["overlapWithTypes"] == ["kettle"]
    assert created["overlapItemTypeIds"]
    assert created["ghost"]["opacity"] == 0.5

    updated = service.update_item_type(
        created["id"],
        {
            "placement": "top",
            "collision": "none",
            "move_snap_cm": 20,
            "boundary_snap": "wall-inner-face",
            "overlap_with_types": ["mini-fridge", "kettle"],
        },
    )
    assert updated["placement"] == "top"
    assert updated["collision"] == "none"
    assert updated["moveSnapCm"] == 20
    assert updated["boundarySnap"] == "wall-inner-face"
    assert updated["overlapWithTypes"] == ["kettle", "mini-fridge"]


def test_item_type_create_rejects_unknown_overlap_key(db_session):
    service = AdminSnapCatalogService(db_session)
    try:
        service.create_item_type(
            display_name="Bad Overlap",
            key="bad-overlap-type",
            overlap_with_types=["no-such-type-xyz"],
        )
        raise AssertionError("expected SnapCatalogAdminError")
    except Exception as exc:
        assert "overlap" in str(exc).lower() or "bilinmeyen" in str(exc).lower()


def test_item_type_create_rejects_invalid_placement(db_session):
    service = AdminSnapCatalogService(db_session)
    try:
        service.create_item_type(
            display_name="Bad",
            key="bad-placement-type",
            placement="flying",
        )
        raise AssertionError("expected SnapCatalogAdminError")
    except Exception as exc:
        assert "placement" in str(exc).lower()


def test_item_type_create_rejects_invalid_connection_endpoint(db_session):
    service = AdminSnapCatalogService(db_session)
    try:
        service.create_item_type(
            display_name="Bad",
            key="bad-endpoint-type",
            connection_endpoint="flying",
        )
        raise AssertionError("expected SnapCatalogAdminError")
    except Exception as exc:
        assert "connection_endpoint" in str(exc).lower()


def test_classification_only_type_has_no_behavior_row(db_session):
    service = AdminSnapCatalogService(db_session)
    created = service.create_item_type(display_name="Üretim Test", key="production-test")
    assert "placement" not in created
    assert "moveSnapCm" not in created
    assert "ghost" not in created
    row = db_session.get(FairStandItemTypeModel, created["id"])
    assert row is not None
    assert row.scene_behavior is None


def test_partial_behavior_create_is_rejected(db_session):
    service = AdminSnapCatalogService(db_session)
    try:
        service.create_item_type(
            display_name="Yarım",
            key="partial-type",
            placement="wall",
            collision="segment",
        )
        raise AssertionError("expected SnapCatalogAdminError")
    except SnapCatalogAdminError as exc:
        assert "eksik" in str(exc).lower()


def test_non_scene_type_rejects_snap_rule(db_session):
    service = AdminSnapCatalogService(db_session)
    created = service.create_item_type(display_name="Üretim Test", key="production-test")
    rule_type = service.create_rule_type(display_name="Snap", key="snap-test")
    try:
        service.create_rule(
            rule_type_id=rule_type["id"],
            display_name="Kural",
            key="rule-test",
            item_type_ids=[created["id"]],
        )
        raise AssertionError("expected SnapCatalogAdminError")
    except SnapCatalogAdminError as exc:
        assert exc.status_code == 400
        assert "snap rule" in str(exc).lower()


def test_bootstrap_omits_scene_fields_for_production(client, db_session, auth_headers):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    response = client.get("/api/v1/fair-stand/catalog/bootstrap", headers=auth_headers)
    assert response.status_code == 200
    production = next(row for row in response.json()["itemTypes"] if row["key"] == "production")
    assert production["displayName"] == "Üretim"
    assert production["isActive"] is True
    for field in ("placement", "collision", "moveSnapCm", "ghost", "magneticSnap"):
        assert field not in production
    items = {row["itemKey"]: row for row in response.json()["items"]}
    for item_key, name in (
        ("digital_print", "Dijital Baskı"),
        ("mesh_fabric", "Mesh Baskı"),
        ("lightbox_fabric", "Lightbox Bezi"),
    ):
        item = items[item_key]
        assert item["name"] == name
        assert item["type"] == "production"
        assert item["unit"] == "metre_kare"
        assert item["catalogVisible"] is False
        assert item["isRender"] is False
