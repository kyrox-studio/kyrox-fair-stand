"""0073: bütün öğe türlerinde taşıma adımı 10 cm; downgrade önceki adımları geri koyar."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import text

from app.modules.fair_stand.infrastructure.seed_catalog import seed_fair_stand_catalog


def _migration():
    path = Path(__file__).resolve().parents[3] / "alembic/versions/0073_move_snap_10cm.py"
    spec = spec_from_file_location("move_snap_10cm_migration", path)
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _step(connection, key: str) -> int:
    return connection.execute(
        text(
            "SELECT b.move_snap_cm FROM fair_stand_item_type_scene_behavior b "
            "JOIN fair_stand_item_type t ON t.id = b.item_type_id WHERE t.key = :key"
        ),
        {"key": key},
    ).scalar_one()


def test_upgrade_sets_every_step_to_10cm_and_downgrade_restores_previous(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    connection = db_session.connection()
    # 0072 benzeri kaynak: banko 50, LED projektör 20, sofa zaten 10.
    for key, value in (("counter", 50), ("led-floodlight", 20), ("tulle-fabric", 50)):
        connection.execute(
            text(
                "UPDATE fair_stand_item_type_scene_behavior SET move_snap_cm = :value "
                "WHERE item_type_id = (SELECT id FROM fair_stand_item_type WHERE key = :key)"
            ),
            {"key": key, "value": value},
        )
    migration = _migration()
    with Operations.context(MigrationContext.configure(connection)):
        migration.upgrade()
        migration.upgrade()
    assert connection.execute(
        text("SELECT count(*) FROM fair_stand_item_type_scene_behavior WHERE move_snap_cm <> 10")
    ).scalar_one() == 0
    with Operations.context(MigrationContext.configure(connection)):
        migration.downgrade()
    assert _step(connection, "counter") == 50
    assert _step(connection, "led-floodlight") == 20
    assert _step(connection, "tulle-fabric") == 50
    assert _step(connection, "sofa-set-classic") == 10
