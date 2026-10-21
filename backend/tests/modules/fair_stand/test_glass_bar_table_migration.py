"""0075: bar masası cam masa satırından kopyalanır (yalnız ad, sıra, yükseklik farklı)."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import text

from app.modules.fair_stand.infrastructure.seed_catalog import seed_fair_stand_catalog


def _migration():
    path = Path(__file__).resolve().parents[3] / "alembic/versions/0075_glass_bar_table.py"
    spec = spec_from_file_location("glass_bar_table_migration", path)
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_upgrade_copies_glass_table_with_108cm_and_downgrade_removes_it(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    connection = db_session.connection()
    connection.execute(text("DELETE FROM fair_stand_item_dimensions WHERE item_key = 'glass_bar_table'"))
    connection.execute(text("DELETE FROM fair_stand_items WHERE item_key = 'glass_bar_table'"))
    connection.execute(text("UPDATE fair_stand_items SET unit = 'adet', is_cost_enabled = true WHERE item_key = 'glass_table'"))
    before = connection.execute(text("SELECT count(*) FROM fair_stand_items")).scalar_one()
    max_index = connection.execute(
        text(
            "SELECT MAX(catalog_item_index) FROM fair_stand_items WHERE category_id = "
            "(SELECT category_id FROM fair_stand_items WHERE item_key = 'glass_table')"
        )
    ).scalar_one()

    migration = _migration()
    with Operations.context(MigrationContext.configure(connection)):
        migration.upgrade()
        migration.upgrade()

    assert connection.execute(text("SELECT count(*) FROM fair_stand_items")).scalar_one() == before + 1
    row = connection.execute(
        text(
            "SELECT b.name, b.item_type, b.unit, b.is_cost_enabled, b.preview_id = t.preview_id, "
            "b.category_id = t.category_id, b.catalog_item_index FROM fair_stand_items b "
            "JOIN fair_stand_items t ON t.item_key = 'glass_table' WHERE b.item_key = 'glass_bar_table'"
        )
    ).one()
    assert row[0] == "Bar Masası" and row[1] == "table-glass" and row[2] == "adet" and bool(row[3]) is True
    assert bool(row[4]) is True and bool(row[5]) is True and row[6] == max_index + 1
    dims = connection.execute(
        text("SELECT width_cm, depth_cm, height_cm FROM fair_stand_item_dimensions WHERE item_key = 'glass_bar_table'")
    ).one()
    assert [float(value) for value in dims] == [75, 75, 108]

    with Operations.context(MigrationContext.configure(connection)):
        migration.downgrade()
    assert connection.execute(text("SELECT count(*) FROM fair_stand_items")).scalar_one() == before
