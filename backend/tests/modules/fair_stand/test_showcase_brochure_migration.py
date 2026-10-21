"""0074: ayaklı vitrin ve broşürlük satırları; tekrar çalışır, downgrade yalnız bunları siler."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import text

from app.modules.fair_stand.infrastructure.seed_catalog import seed_fair_stand_catalog

_KEYS = ("floor_showcase_100", "brochure_stand")
_TYPES = ("floor-showcase", "brochure-stand")


def _migration():
    path = Path(__file__).resolve().parents[3] / "alembic/versions/0074_showcase_brochure.py"
    spec = spec_from_file_location("showcase_brochure_migration", path)
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _count(connection, sql: str) -> int:
    return connection.execute(text(sql)).scalar_one()


def test_upgrade_adds_both_items_once_and_downgrade_removes_only_them(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    connection = db_session.connection()
    # 0073 benzeri kaynak: iki öğe ve türleri henüz yok.
    for key in _KEYS:
        connection.execute(text("DELETE FROM fair_stand_item_dimensions WHERE item_key = :k"), {"k": key})
        connection.execute(text("DELETE FROM fair_stand_items WHERE item_key = :k"), {"k": key})
    for type_key in _TYPES:
        connection.execute(
            text(
                "DELETE FROM fair_stand_item_type_scene_behavior WHERE item_type_id = "
                "(SELECT id FROM fair_stand_item_type WHERE key = :k)"
            ),
            {"k": type_key},
        )
        connection.execute(text("DELETE FROM fair_stand_item_type WHERE key = :k"), {"k": type_key})
    for markup in ('<div class="module-drag-floor-showcase"></div>', '<div class="module-drag-brochure-stand"></div>'):
        connection.execute(text("DELETE FROM fair_stand_catalog_preview_kinds WHERE markup = :m"), {"m": markup})
    items_before = _count(connection, "SELECT count(*) FROM fair_stand_items")
    previews_before = _count(connection, "SELECT count(*) FROM fair_stand_catalog_preview_kinds")

    migration = _migration()
    with Operations.context(MigrationContext.configure(connection)):
        migration.upgrade()
        migration.upgrade()

    assert _count(connection, "SELECT count(*) FROM fair_stand_items") == items_before + 2
    assert _count(connection, "SELECT count(*) FROM fair_stand_catalog_preview_kinds") == previews_before + 2
    row = connection.execute(
        text(
            "SELECT i.unit, i.catalog_visible, d.width_cm, d.depth_cm, d.height_cm, b.placement, b.collision, "
            "b.move_snap_cm FROM fair_stand_items i "
            "JOIN fair_stand_item_dimensions d ON d.item_key = i.item_key "
            "JOIN fair_stand_item_type t ON t.key = i.item_type "
            "JOIN fair_stand_item_type_scene_behavior b ON b.item_type_id = t.id "
            "WHERE i.item_key = 'floor_showcase_100'"
        )
    ).one()
    assert row[0] == "adet" and bool(row[1]) is True
    assert [float(row[2]), float(row[3]), float(row[4])] == [100, 40, 100]
    assert (row[5], row[6], row[7]) == ("free", "footprint", 10)
    brochure = connection.execute(
        text("SELECT width_cm, depth_cm, height_cm FROM fair_stand_item_dimensions WHERE item_key = 'brochure_stand'")
    ).one()
    assert [float(value) for value in brochure] == [30, 30, 150]

    with Operations.context(MigrationContext.configure(connection)):
        migration.downgrade()
    assert _count(connection, "SELECT count(*) FROM fair_stand_items") == items_before
    assert _count(connection, "SELECT count(*) FROM fair_stand_catalog_preview_kinds") == previews_before
    assert _count(connection, "SELECT count(*) FROM fair_stand_item_type WHERE key IN ('floor-showcase', 'brochure-stand')") == 0
