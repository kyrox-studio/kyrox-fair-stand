from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid5, UUID, NAMESPACE_URL

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.modules.fair_stand.application.cycle_validation import assert_acyclic_components
from app.modules.fair_stand.infrastructure.catalog_seed_data import CATALOG_SEED
from app.modules.fair_stand.infrastructure.item_snap_seed import ensure_item_types, ensure_snap_catalog
from app.modules.fair_stand.infrastructure.item_type_behavior_seed import ensure_type_behavior_slices
from app.modules.fair_stand.infrastructure.preview_kind_definitions import all_preview_kind_rows
from app.modules.fair_stand.infrastructure.runtime_settings_seed import ensure_runtime_settings
from app.modules.fair_stand.infrastructure.stand_dimensions_seed import ensure_stand_dimensions
from app.modules.fair_stand.infrastructure.models import (
    FairStandCatalogPreviewKindModel,
    FairStandCategoryModel,
    FairStandItemAssetModel,
    FairStandItemBodyPartModel,
    FairStandItemComponentModel,
    FairStandItemDimensionsModel,
    FairStandItemModel,
    FairStandItemSceneDimensionsModel,
    FairStandItemStripOccupancyModel,
    FairStandItemVideoWallModel,
    FairStandUnitModel,
)

_SEED_UNIT_LABELS = {
    "adet": ("Adet", "adet"),
    "metre_kare": ("Metre Kare", "m2"),
}


def _dec(value: object) -> Decimal | None:
    if value is None:
        return None
    return Decimal(str(value))


def _stable_uuid(*parts: str) -> UUID:
    return uuid5(NAMESPACE_URL, "fair-stand:" + ":".join(parts))


def _clear_catalog(session: Session) -> None:
    session.execute(delete(FairStandItemBodyPartModel))
    session.execute(delete(FairStandItemVideoWallModel))
    session.execute(delete(FairStandItemComponentModel))
    session.execute(delete(FairStandItemAssetModel))
    session.execute(delete(FairStandItemStripOccupancyModel))
    session.execute(delete(FairStandItemSceneDimensionsModel))
    session.execute(delete(FairStandItemDimensionsModel))
    session.execute(delete(FairStandItemModel))
    session.execute(delete(FairStandCategoryModel))
    session.execute(delete(FairStandCatalogPreviewKindModel))


def _ensure_seed_units(session: Session, now: datetime) -> None:
    """Item seed strings must satisfy the unit FK. This does not run in the migration."""
    needed = {row["unit"] for row in CATALOG_SEED["items"] if row.get("unit")}
    unknown = sorted(needed - set(_SEED_UNIT_LABELS))
    if unknown:
        raise RuntimeError(
            "Catalog seed references unit keys without a known catalog label: " + ", ".join(unknown)
        )
    existing = set(session.scalars(select(FairStandUnitModel.unit_key)).all())
    for unit_key in sorted(needed - existing):
        name, symbol = _SEED_UNIT_LABELS[unit_key]
        session.add(
            FairStandUnitModel(
                unit_key=unit_key,
                name=name,
                symbol=symbol,
                is_active=True,
                created_at=now,
                updated_at=now,
            )
        )
    session.flush()


def seed_fair_stand_catalog(session: Session) -> None:
    _clear_catalog(session)
    now = datetime.now(tz=UTC)
    edges: list[tuple[str, str]] = []

    for definition in all_preview_kind_rows():
        session.add(
            FairStandCatalogPreviewKindModel(
                display_name=str(definition["display_name"]),
                markup=str(definition["markup"]),
                css_code=str(definition["css_code"]),
                sort_index=int(definition["sort_index"]),
                is_active=True,
                created_at=now,
                updated_at=now,
            )
        )

    for category in CATALOG_SEED["categories"]:
        session.add(
            FairStandCategoryModel(
                catalog_name=category["catalog_name"],
                catalog_index=category["catalog_index"],
                is_active=True,
                created_at=now,
                updated_at=now,
            )
        )

    session.flush()
    category_id_by_index = {
        row.catalog_index: row.id
        for row in session.scalars(select(FairStandCategoryModel)).all()
    }
    preview_id_by_sort = {
        row.sort_index: row.id
        for row in session.scalars(select(FairStandCatalogPreviewKindModel)).all()
    }
    snap_ids = ensure_snap_catalog(session)
    ensure_item_types(session, [row["item_type"] for row in CATALOG_SEED["items"]])
    ensure_type_behavior_slices(session)
    _ensure_seed_units(session, now)
    rule_ids = snap_ids["rules"]

    for row in CATALOG_SEED["items"]:
        category_index = row.get("category_index")
        preview_sort = row.get("preview_id")
        requires_code = row.get("snap_requires_rule_code")
        provides_code = row.get("snap_provides_rule_code")
        session.add(
            FairStandItemModel(
                item_key=row["item_key"],
                name=row["name"],
                item_type=row["item_type"],
                unit=row["unit"],
                catalog_visible=row["catalog_visible"],
                category_id=category_id_by_index[category_index] if category_index is not None else None,
                catalog_item_index=row["catalog_item_index"],
                preview_id=preview_id_by_sort[preview_sort] if preview_sort is not None else None,
                material=row["material"],
                default_color=row["default_color"],
                default_opacity=_dec(row.get("default_opacity")) or Decimal("1"),
                preserve_model_scale=row["preserve_model_scale"],
                model_rotation_y_deg=_dec(row["model_rotation_y_deg"]),
                visual_rotation_y_deg=_dec(row["visual_rotation_y_deg"]),
                rotation_step_deg=_dec(row.get("rotation_step_deg")),
                default_rotation_deg=_dec(row.get("default_rotation_deg")),
                side_insert_rotation=row.get("side_insert_rotation"),
                composition_mode=row["composition_mode"],
                paintable=row["paintable"],
                shape=row["shape"],
                variant=row["variant"],
                eye_count=row["eye_count"],
                is_render=bool(row.get("is_render", False)),
                accepts_color=bool(row.get("accepts_color", False)),
                accepts_image=bool(row.get("accepts_image", False)),
                accepts_lightbox=bool(row.get("accepts_lightbox", False)),
                accepts_glass=bool(row.get("accepts_glass", False)),
                accepts_mesh=bool(row.get("accepts_mesh", False)),
                is_cost_enabled=bool(row.get("is_cost_enabled", False)),
                default_z_cm=_dec(row.get("default_z_cm")) or 0,
                snap_target_item_type=row.get("snap_target_item_type"),
                snap_anchor=row.get("snap_anchor"),
                snap_requires_rule_id=rule_ids.get(requires_code) if requires_code else None,
                snap_provides_rule_id=rule_ids.get(provides_code) if provides_code else None,
                is_active=True,
                created_at=now,
                updated_at=now,
            )
        )

    session.flush()

    for row in CATALOG_SEED["items"]:
        item_key = row["item_key"]
        dims = row.get("dimensions")
        if dims:
            session.add(
                FairStandItemDimensionsModel(
                    item_key=item_key,
                    width_cm=_dec(dims["width_cm"]),
                    depth_cm=_dec(dims["depth_cm"]),
                    height_cm=_dec(dims["height_cm"]),
                    mount_height_cm=_dec(dims["mount_height_cm"]),
                    wall_gap_cm=_dec(dims["wall_gap_cm"]),
                )
            )
        scene = row.get("scene_dimensions")
        if scene:
            session.add(
                FairStandItemSceneDimensionsModel(
                    item_key=item_key,
                    width_cm=_dec(scene["width_cm"]),
                    depth_cm=_dec(scene["depth_cm"]),
                    height_cm=_dec(scene["height_cm"]),
                )
            )
        occupancy = row.get("strip_occupancy")
        if occupancy:
            session.add(
                FairStandItemStripOccupancyModel(
                    item_key=item_key,
                    align=occupancy["align"],
                    strip_count=occupancy["strip_count"],
                )
            )
        for asset in row.get("assets") or []:
            session.add(
                FairStandItemAssetModel(
                    id=_stable_uuid("asset", item_key, asset["asset_role"]),
                    item_key=item_key,
                    asset_role=asset["asset_role"],
                    relative_path=asset["relative_path"],
                    is_active=True,
                )
            )
        for component in row.get("components") or []:
            edges.append((item_key, component["child_item_key"]))
            session.add(
                FairStandItemComponentModel(
                    id=_stable_uuid("component", item_key, component["child_item_key"]),
                    parent_item_key=item_key,
                    child_item_key=component["child_item_key"],
                    quantity=_dec(component["quantity"]),
                    per_band=_dec(component.get("per_band") or 0),
                    height_matched=bool(component.get("height_matched")),
                )
            )
        video_wall = row.get("video_wall")
        if video_wall:
            session.add(
                FairStandItemVideoWallModel(
                    parent_item_key=item_key,
                    rows=video_wall["rows"],
                    cols=video_wall["cols"],
                    panel_item_key=video_wall["panel_item_key"],
                )
            )
        for part in row.get("body_parts") or []:
            session.add(
                FairStandItemBodyPartModel(
                    id=_stable_uuid("body_part", item_key, part["body_role"]),
                    parent_item_key=item_key,
                    body_role=part["body_role"],
                    child_item_key=part["child_item_key"],
                )
            )

    assert_acyclic_components(edges)
    ensure_stand_dimensions(session)
    ensure_runtime_settings(session)
    session.flush()
