"""0089: parke renkleri ve beton plaka ölçüsü referans ürünlere eşitlenir; seed aynı son durumu taşır."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import text

from app.modules.fair_stand.infrastructure.seed_catalog import seed_fair_stand_catalog


def _migration():
    path = Path(__file__).resolve().parents[3] / "alembic/versions/0089_parquet_reference.py"
    spec = spec_from_file_location("migration_0089_parquet_reference", path)
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _floor_rows(connection):
    return {
        key: (color, float(width), float(depth))
        for key, color, width, depth in connection.execute(
            text(
                "SELECT i.item_key, i.default_color, d.width_cm, d.depth_cm "
                "FROM fair_stand_items i JOIN fair_stand_item_dimensions d USING (item_key) "
                "WHERE i.item_key LIKE 'parke-%'"
            )
        )
    }


def test_seed_matches_upgrade(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    rows = _floor_rows(db_session.connection())
    assert rows["parke-acik"] == (0xC9CAC5, 140.0, 16.0)
    assert rows["parke-sari"] == (0xAD8E76, 140.0, 16.0)
    assert rows["parke-beton"] == (0x6B6762, 120.6, 40.2)


def test_downgrade_then_upgrade_round_trips(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    connection = db_session.connection()
    migration = _migration()
    with Operations.context(MigrationContext.configure(connection)):
        migration.downgrade()
        downgraded = _floor_rows(connection)
        migration.upgrade()
    assert downgraded["parke-acik"][0] == 0xE8DFD1
    assert downgraded["parke-sari"][0] == 0xC4A480
    assert downgraded["parke-beton"] == (0x625F58, 112.0, 28.0)
    assert _floor_rows(connection)["parke-beton"] == (0x6B6762, 120.6, 40.2)
