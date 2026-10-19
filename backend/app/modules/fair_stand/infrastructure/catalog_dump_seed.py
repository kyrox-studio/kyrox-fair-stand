"""Load the frozen local fair_stand catalog dump when the target database has no Items."""

from __future__ import annotations

import json
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from uuid import UUID, uuid4

import sqlalchemy as sa
from sqlalchemy import DateTime, Numeric, Uuid, insert

from app.db.base import Base
from app.modules.fair_stand.infrastructure import models as _models  # noqa: F401

DUMP_PATH = Path(__file__).resolve().parents[4] / "alembic" / "data" / "0002_fair_stand_catalog_dump.json"

TABLE_ORDER = (
    "fair_stand_categories",
    "fair_stand_catalog_preview_kinds",
    "fair_stand_items",
    "fair_stand_item_dimensions",
    "fair_stand_item_scene_dimensions",
    "fair_stand_item_strip_occupancy",
    "fair_stand_item_assets",
    "fair_stand_item_components",
    "fair_stand_item_video_walls",
    "fair_stand_item_body_parts",
)

SERIAL_TABLES = (
    "fair_stand_categories",
    "fair_stand_catalog_preview_kinds",
)

_DUMP_UNIT_LABELS = {
    "adet": ("Adet", "adet"),
    "metre_kare": ("Metre Kare", "m2"),
}


def _coerce(column: sa.Column, value: object) -> object:
    if value is None:
        return None
    if isinstance(column.type, DateTime) and isinstance(value, str):
        return datetime.fromisoformat(value)
    if isinstance(column.type, Numeric) and not isinstance(value, Decimal):
        return Decimal(str(value))
    if isinstance(column.type, Uuid) and not isinstance(value, UUID):
        return UUID(str(value))
    return value


def load_catalog_dump() -> dict:
    return json.loads(DUMP_PATH.read_text(encoding="utf-8"))


def _canonical_dump_unit(value: object) -> object:
    if value == "m2":
        return "metre_kare"
    return value


def _ensure_dump_units(session, item_rows: list) -> None:
    from datetime import UTC, datetime

    from app.modules.fair_stand.infrastructure.models import FairStandUnitModel

    needed = {
        str(_canonical_dump_unit(row.get("unit")))
        for row in item_rows
        if row.get("unit")
    }
    unknown = sorted(needed - set(_DUMP_UNIT_LABELS))
    if unknown:
        raise RuntimeError(
            "Catalog dump references unit keys without a known catalog label: " + ", ".join(unknown)
        )
    existing = set(session.scalars(sa.select(FairStandUnitModel.unit_key)).all())
    now = datetime.now(tz=UTC)
    for unit_key in sorted(needed - existing):
        name, symbol = _DUMP_UNIT_LABELS[unit_key]
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


def seed_catalog_if_empty(bind) -> None:
    item_count = bind.execute(sa.text("SELECT COUNT(*) FROM fair_stand_items")).scalar()
    if item_count:
        return

    payload = load_catalog_dump()
    tables = payload["tables"]

    # item_type FK is RESTRICT: catalog rows must exist before fair_stand_items.
    item_rows = tables.get("fair_stand_items") or []
    if item_rows:
        from sqlalchemy.orm import Session

        from app.modules.fair_stand.infrastructure.item_snap_seed import (
            ensure_item_types,
            ensure_snap_catalog,
        )

        session = Session(bind=bind)
        try:
            ensure_snap_catalog(session)
            ensure_item_types(
                session,
                [row.get("item_type") for row in item_rows if row.get("item_type")],
            )
            session.flush()
            _ensure_dump_units(session, item_rows)
            session.flush()
        finally:
            session.close()

    for name in TABLE_ORDER:
        rows = tables.get(name) or []
        if not rows:
            continue
        table = Base.metadata.tables[name]
        coerced = [
            {column.name: _coerce(column, row.get(column.name)) for column in table.columns}
            for row in rows
        ]
        if name == "fair_stand_items":
            for item in coerced:
                item["unit"] = _canonical_dump_unit(item.get("unit"))
                for flag in (
                    "is_render",
                    "accepts_color",
                    "accepts_image",
                    "accepts_lightbox",
                    "accepts_glass",
                    "accepts_mesh",
                    "is_cost_enabled",
                ):
                    if item.get(flag) is None:
                        item[flag] = False
                if item.get("default_z_cm") is None:
                    item["default_z_cm"] = 0
                if item.get("default_opacity") is None:
                    item["default_opacity"] = 1
        if name == "fair_stand_item_components":
            for component in coerced:
                if component.get("per_band") is None:
                    component["per_band"] = 0
                if component.get("height_matched") is None:
                    component["height_matched"] = False
        if name == "fair_stand_item_body_parts":
            for part in coerced:
                if part.get("id") is None:
                    part["id"] = uuid4()
        bind.execute(insert(table), coerced)

    from app.modules.fair_stand.infrastructure.item_rotation_seed import fill_item_rotation_columns

    fill_item_rotation_columns(bind)
    from app.modules.fair_stand.infrastructure.item_default_z_seed import fill_item_default_z_columns

    fill_item_default_z_columns(bind)
    from app.modules.fair_stand.infrastructure.item_snap_seed import fill_item_snap_columns

    fill_item_snap_columns(bind)
    from app.modules.fair_stand.infrastructure.item_scene_pose_seed import fill_item_scene_pose_columns

    fill_item_scene_pose_columns(bind)

    if bind.dialect.name == "postgresql":
        for name in SERIAL_TABLES:
            bind.execute(
                sa.text(
                    f"SELECT setval(pg_get_serial_sequence('{name}', 'id'), "
                    f"COALESCE((SELECT MAX(id) FROM {name}), 1), "
                    f"(SELECT COUNT(*) > 0 FROM {name}))"
                )
            )
