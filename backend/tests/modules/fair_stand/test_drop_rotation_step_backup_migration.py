"""0096: 0087 dönüş adımı yedek tablosu kalkar; geri almada 45° ile yeniden kurulur, 0087 downgrade'i çalışır."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import inspect, text

from app.modules.fair_stand.infrastructure.seed_catalog import seed_fair_stand_catalog

_TABLE = "fair_stand_rotation_step_0087_backup"


def _migration(name):
    path = Path(__file__).resolve().parents[3] / f"alembic/versions/{name}.py"
    spec = spec_from_file_location(name, path)
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_upgrade_drops_backup_and_downgrade_keeps_0087_rollback(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    connection = db_session.connection()
    stepped = connection.execute(
        text("SELECT count(*) FROM fair_stand_items WHERE rotation_step_deg IS NOT NULL")
    ).scalar()
    assert stepped > 0
    with Operations.context(MigrationContext.configure(connection)):
        # 0087 sonrası durum: yedek tablo var.
        _migration("0087_rotation_step_15").upgrade()
        assert _TABLE in inspect(connection).get_table_names()
        drop = _migration("0096_drop_rotation_step_backup")
        drop.upgrade()
        assert _TABLE not in inspect(connection).get_table_names()
        drop.upgrade()  # tekrar çalışınca hata vermez
        drop.downgrade()
        assert connection.execute(text(f"SELECT count(*) FROM {_TABLE}")).scalar() == stepped
        _migration("0087_rotation_step_15").downgrade()
    steps = {
        float(row[0])
        for row in connection.execute(
            text("SELECT rotation_step_deg FROM fair_stand_items WHERE rotation_step_deg IS NOT NULL")
        )
    }
    assert steps == {45.0}
    assert _TABLE not in inspect(connection).get_table_names()
