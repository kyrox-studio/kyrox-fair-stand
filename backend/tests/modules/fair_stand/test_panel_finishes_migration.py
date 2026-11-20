"""0100 panel tipi Item'larını (`panel-finish`) ve meşe dokusunu ekler; ürün değildir."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

from alembic.operations import Operations
from alembic.runtime.migration import MigrationContext
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.modules.fair_stand.infrastructure import models as _fair_stand_models  # noqa: F401
from app.modules.fair_stand.infrastructure.seed_catalog import seed_fair_stand_catalog

_KEYS = ("panel_finish_default", "panel_finish_antrasit", "panel_finish_siyah", "panel_finish_mese")


def _load_migration():
    path = Path(__file__).resolve().parents[3] / "alembic" / "versions" / "0100_panel_finishes.py"
    spec = spec_from_file_location("fair_stand_0100_panel_finishes", path)
    assert spec is not None and spec.loader is not None
    migration = module_from_spec(spec)
    spec.loader.exec_module(migration)
    return migration


def _run(connection, migration, step: str) -> None:
    context = MigrationContext.configure(connection)
    with Operations.context(context):
        getattr(migration, step)()
    connection.commit()


def test_panel_finishes_are_added_once_with_colors_and_oak_texture():
    migration = _load_migration()
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    with Session(engine) as session:
        seed_fair_stand_catalog(session)
        session.commit()
    with engine.connect() as connection:
        # Migration öncesi durum: tipler ve kayıtlar yok.
        for key in _KEYS:
            for table in ("fair_stand_item_assets", "fair_stand_item_dimensions", "fair_stand_items"):
                connection.execute(text(f"DELETE FROM {table} WHERE item_key = :k"), {"k": key})
        connection.execute(text("DELETE FROM fair_stand_item_type WHERE key = 'panel-finish'"))
        connection.commit()
        before = connection.execute(text("SELECT COUNT(*) FROM fair_stand_items")).scalar_one()

        _run(connection, migration, "upgrade")
        _run(connection, migration, "upgrade")

        rows = {
            row.item_key: row
            for row in connection.execute(
                text(
                    "SELECT item_key, name, item_type, catalog_visible, is_render, paintable, default_color "
                    "FROM fair_stand_items WHERE item_type = 'panel-finish'"
                )
            )
        }
        assert set(rows) == set(_KEYS)
        for row in rows.values():
            assert bool(row.catalog_visible) is False
            assert bool(row.is_render) is False
            assert not row.paintable
        assert rows["panel_finish_default"].name == "Varsayılan"
        # Varsayılan renksizdir: panel kendi katalog rengiyle çizilir.
        assert rows["panel_finish_default"].default_color is None
        assert rows["panel_finish_antrasit"].default_color == 0x383E42  # RAL 7016
        assert rows["panel_finish_siyah"].default_color == 0x1C1C1E
        assert rows["panel_finish_mese"].name == "Meşe"

        texture = connection.execute(
            text(
                "SELECT asset_role, relative_path, is_active FROM fair_stand_item_assets "
                "WHERE item_key = 'panel_finish_mese'"
            )
        ).all()
        assert [(row.asset_role, row.relative_path, bool(row.is_active)) for row in texture] == [
            ("texture", "textures/panel/mese.jpg", True)
        ]
        tile = connection.execute(
            text("SELECT width_cm, height_cm FROM fair_stand_item_dimensions WHERE item_key = 'panel_finish_mese'")
        ).one()
        assert (float(tile.width_cm), float(tile.height_cm)) == (141.0, 100.0)
        assert (Path(__file__).resolve().parents[4] / "public" / "textures" / "panel" / "mese.jpg").is_file()
        assert connection.execute(text("SELECT COUNT(*) FROM fair_stand_items")).scalar_one() == before + 4

        _run(connection, migration, "downgrade")
        assert connection.execute(text("SELECT COUNT(*) FROM fair_stand_items")).scalar_one() == before
        assert connection.execute(
            text("SELECT COUNT(*) FROM fair_stand_item_assets WHERE item_key = 'panel_finish_mese'")
        ).scalar_one() == 0
        assert connection.execute(
            text("SELECT COUNT(*) FROM fair_stand_item_type WHERE key = 'panel-finish'")
        ).scalar_one() == 0
