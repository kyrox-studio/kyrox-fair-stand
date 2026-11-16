"""0098 karolaj'dan kopyalanan gizli yarım karo ve demir kalemlerini ekler."""

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

_KEYS = ("karolaj_yarim", "profile_karolaj_100", "profile_karolaj_50")


def _load_migration():
    path = Path(__file__).resolve().parents[3] / "alembic" / "versions" / "0098_karolaj_parts.py"
    spec = spec_from_file_location("fair_stand_0098_karolaj_parts", path)
    assert spec is not None and spec.loader is not None
    migration = module_from_spec(spec)
    spec.loader.exec_module(migration)
    return migration


def _run(connection, migration, step: str) -> None:
    context = MigrationContext.configure(connection)
    with Operations.context(context):
        getattr(migration, step)()
    connection.commit()


def test_karolaj_parts_are_copied_once_and_downgrade_removes_them():
    migration = _load_migration()
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    with Session(engine) as session:
        seed_fair_stand_catalog(session)
        session.commit()
    with engine.connect() as connection:
        # Migration öncesi durum: kalemler ve tip yok.
        for key in _KEYS:
            connection.execute(text("DELETE FROM fair_stand_items WHERE item_key = :k"), {"k": key})
        connection.execute(text("DELETE FROM fair_stand_item_type WHERE key = 'floor-piece'"))
        connection.commit()
        before = connection.execute(text("SELECT COUNT(*) FROM fair_stand_items")).scalar_one()

        _run(connection, migration, "upgrade")
        _run(connection, migration, "upgrade")

        rows = {
            row.item_key: row
            for row in connection.execute(
                text(
                    "SELECT i.item_key, i.name, i.item_type, i.unit, i.catalog_visible, i.is_render, "
                    "i.paintable, i.default_color, d.width_cm, d.depth_cm FROM fair_stand_items i "
                    "JOIN fair_stand_item_dimensions d ON d.item_key = i.item_key "
                    "WHERE i.item_key IN ('karolaj_yarim', 'profile_karolaj_100', 'profile_karolaj_50')"
                )
            )
        }
        source_color = connection.execute(
            text("SELECT default_color FROM fair_stand_items WHERE item_key = 'karolaj'")
        ).scalar_one()
        assert set(rows) == set(_KEYS)
        for row in rows.values():
            assert row.item_type == "floor-piece"
            assert row.unit == "adet"
            assert bool(row.catalog_visible) is False
            assert bool(row.is_render) is False
        half = rows["karolaj_yarim"]
        assert half.name == "Karolaj Yarım"
        assert half.default_color == source_color
        assert (float(half.width_cm), float(half.depth_cm)) == (50.0, 100.0)
        assert rows["profile_karolaj_100"].name == "Profil 1 m"
        assert rows["profile_karolaj_50"].name == "Profil 0.5 m"
        assert float(rows["profile_karolaj_100"].width_cm) == 100.0
        assert float(rows["profile_karolaj_50"].width_cm) == 50.0
        for key in ("profile_karolaj_100", "profile_karolaj_50"):
            assert not rows[key].paintable
            assert rows[key].default_color is None
        assert connection.execute(text("SELECT COUNT(*) FROM fair_stand_items")).scalar_one() == before + 3
        type_id = connection.execute(
            text("SELECT id FROM fair_stand_item_type WHERE key = 'floor-piece'")
        ).scalar_one()
        assert connection.execute(
            text("SELECT COUNT(*) FROM fair_stand_item_type_scene_behavior WHERE item_type_id = :id"),
            {"id": type_id},
        ).scalar_one() == 0

        _run(connection, migration, "downgrade")
        assert connection.execute(text("SELECT COUNT(*) FROM fair_stand_items")).scalar_one() == before
        assert connection.execute(
            text("SELECT COUNT(*) FROM fair_stand_item_type WHERE key = 'floor-piece'")
        ).scalar_one() == 0
