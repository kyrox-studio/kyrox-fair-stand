"""0090: halı varsayılan rengi antrasit; seed aynı son durumu taşır."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import text

from app.modules.fair_stand.infrastructure.seed_catalog import seed_fair_stand_catalog


def _migration():
    path = Path(__file__).resolve().parents[3] / "alembic/versions/0090_carpet_anthracite.py"
    spec = spec_from_file_location("migration_0090_carpet_anthracite", path)
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _carpet_color(connection):
    return connection.execute(
        text("SELECT default_color FROM fair_stand_items WHERE item_key = 'hali'")
    ).scalar_one()


def test_seed_matches_upgrade(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    assert _carpet_color(db_session.connection()) == 0x383E42


def test_downgrade_then_upgrade_round_trips(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    connection = db_session.connection()
    migration = _migration()
    with Operations.context(MigrationContext.configure(connection)):
        migration.downgrade()
        downgraded = _carpet_color(connection)
        migration.upgrade()
    assert downgraded == 0x8B8F94
    assert _carpet_color(connection) == 0x383E42
