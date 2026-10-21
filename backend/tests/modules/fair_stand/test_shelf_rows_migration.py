"""0072 raf kartı/varyant geçişi mevcut ölçüleri korur ve tekrar çalışabilir."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import text

from app.modules.fair_stand.infrastructure.seed_catalog import seed_fair_stand_catalog


def _migration():
    path = Path(__file__).resolve().parents[3] / "alembic/versions/0072_shelf_rows.py"
    spec = spec_from_file_location("shelf_rows_migration", path)
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_upgrade_creates_width_families_preserves_edits_and_downgrade_restores_catalog(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    connection = db_session.connection()
    # 0071 benzeri kaynak: aile tablosu/kartlar/sıralı ürünler henüz yok.
    connection.execute(text("DELETE FROM fair_stand_items WHERE item_key LIKE 'shelf_row_%'"))
    connection.execute(text("DROP TABLE fair_stand_item_width_variants"))
    connection.execute(text("UPDATE fair_stand_items SET catalog_visible=true WHERE item_key IN ('shelf_100','shelf_150','shelf_200')"))
    connection.execute(text("UPDATE fair_stand_item_scene_dimensions SET height_cm=3 WHERE item_key='shelf_150_self'"))
    connection.execute(text("UPDATE fair_stand_item_dimensions SET height_cm=6.8 WHERE item_key='shelf_100_self'"))
    migration = _migration()
    with Operations.context(MigrationContext.configure(connection)):
        migration.upgrade()
        migration.upgrade()
    assert connection.execute(text("SELECT count(*) FROM fair_stand_item_width_variants")).scalar_one() == 9
    assert connection.execute(text("SELECT count(*) FROM fair_stand_items WHERE item_type='shelf' AND catalog_visible=true")).scalar_one() == 3
    assert connection.execute(text("SELECT count(*) FROM fair_stand_items WHERE item_key LIKE 'shelf_row_%'")).scalar_one() == 9
    assert float(connection.execute(text("SELECT height_cm FROM fair_stand_item_scene_dimensions WHERE item_key='shelf_150_self'")).scalar_one()) == 3
    assert float(connection.execute(text("SELECT height_cm FROM fair_stand_item_dimensions WHERE item_key='shelf_100_self'")).scalar_one()) == 6.8
    assert connection.execute(text("SELECT quantity FROM fair_stand_item_components WHERE parent_item_key='shelf_row_2_150' AND child_item_key='shelf_150'")).scalar_one() == 2
    assert connection.execute(text("SELECT count(*) FROM fair_stand_item_components WHERE parent_item_key='shelf_row_2_150'")).scalar_one() == 1
    with Operations.context(MigrationContext.configure(connection)):
        migration.downgrade()
    assert connection.execute(text("SELECT count(*) FROM fair_stand_items WHERE item_key LIKE 'shelf_row_%'")).scalar_one() == 0
    assert connection.execute(text("SELECT count(*) FROM fair_stand_items WHERE item_type='shelf' AND catalog_visible=true")).scalar_one() == 3
    assert connection.execute(text("SELECT count(*) FROM fair_stand_item_components WHERE parent_item_key='shelf_150'")).scalar_one() == 2
