"""0099 upright_99'dan kopyalanan Dikme 148,5 ve Dikme 198'i ekler."""

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

_KEYS = ("upright_148_5", "upright_198")


def _load_migration():
    path = Path(__file__).resolve().parents[3] / "alembic" / "versions" / "0099_upright_148_5_198.py"
    spec = spec_from_file_location("fair_stand_0099_upright_148_5_198", path)
    assert spec is not None and spec.loader is not None
    migration = module_from_spec(spec)
    spec.loader.exec_module(migration)
    return migration


def _run(connection, migration, step: str) -> None:
    context = MigrationContext.configure(connection)
    with Operations.context(context):
        getattr(migration, step)()
    connection.commit()


def test_uprights_are_copied_once_with_scene_size_and_booth_type():
    migration = _load_migration()
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    with Session(engine) as session:
        seed_fair_stand_catalog(session)
        session.commit()
    with engine.connect() as connection:
        for key in _KEYS:
            connection.execute(text("DELETE FROM fair_stand_items WHERE item_key = :k"), {"k": key})
        connection.commit()
        before = connection.execute(text("SELECT COUNT(*) FROM fair_stand_items")).scalar_one()

        _run(connection, migration, "upgrade")
        _run(connection, migration, "upgrade")

        rows = {
            row.item_key: row
            for row in connection.execute(
                text(
                    "SELECT i.item_key, i.name, i.item_type, i.variant, i.catalog_visible, d.height_cm, s.height_cm AS scene "
                    "FROM fair_stand_items i JOIN fair_stand_item_dimensions d ON d.item_key = i.item_key "
                    "JOIN fair_stand_item_scene_dimensions s ON s.item_key = i.item_key "
                    "WHERE i.item_key IN ('upright_148_5', 'upright_198')"
                )
            )
        }
        assert set(rows) == set(_KEYS)
        assert rows["upright_148_5"].name == "Dikme 148,5"
        assert (float(rows["upright_148_5"].height_cm), float(rows["upright_148_5"].scene)) == (148.5, 150.0)
        assert rows["upright_198"].name == "Dikme 198"
        assert (float(rows["upright_198"].height_cm), float(rows["upright_198"].scene)) == (198.0, 200.0)
        for row in rows.values():
            assert row.item_type == "upright"
            assert row.variant == "upright"
            assert bool(row.catalog_visible) is False
        booth = connection.execute(
            text("SELECT COUNT(*) FROM fair_stand_item_booth_types WHERE item_key IN ('upright_148_5', 'upright_198')")
        ).scalar_one()
        assert booth == 2
        assert connection.execute(text("SELECT COUNT(*) FROM fair_stand_items")).scalar_one() == before + 2

        _run(connection, migration, "downgrade")
        assert connection.execute(text("SELECT COUNT(*) FROM fair_stand_items")).scalar_one() == before
