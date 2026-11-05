"""0092: strafor kartı kendi önizlemesine geçer; tekrar çalışır, downgrade düz panele döner."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import text

from app.modules.fair_stand.infrastructure.seed_catalog import seed_fair_stand_catalog


def _migration():
    path = Path(__file__).resolve().parents[3] / "alembic/versions/0092_foam_card_preview.py"
    spec = spec_from_file_location("foam_card_preview_migration", path)
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _preview_of(connection, item_key: str):
    return connection.execute(
        text("SELECT preview_id FROM fair_stand_items WHERE item_key = :k"), {"k": item_key}
    ).scalar_one()


def _foam_rows(connection, markup: str) -> int:
    return connection.execute(
        text("SELECT COUNT(*) FROM fair_stand_catalog_preview_kinds WHERE markup = :m"), {"m": markup}
    ).scalar_one()


def test_upgrade_gives_foam_own_preview_once_and_downgrade_restores_panel(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    connection = db_session.connection()
    migration = _migration()
    # Seed yeni önizlemeyle gelir; 0091 durumu: strafor düz panelde, satır yok.
    panel = _preview_of(connection, "wall_100_350")
    connection.execute(
        text("UPDATE fair_stand_items SET preview_id = :p WHERE item_key = 'illuminated-foam'"), {"p": panel}
    )
    connection.execute(text("DELETE FROM fair_stand_catalog_preview_kinds WHERE markup = :m"), {"m": migration._MARKUP})

    context = MigrationContext.configure(connection)
    with Operations.context(context):
        migration.upgrade()
        migration.upgrade()
    assert _foam_rows(connection, migration._MARKUP) == 1
    assert _preview_of(connection, "illuminated-foam") != panel
    assert _preview_of(connection, "wall_100_350") == panel

    with Operations.context(context):
        migration.downgrade()
    assert _foam_rows(connection, migration._MARKUP) == 0
    assert _preview_of(connection, "illuminated-foam") == panel
