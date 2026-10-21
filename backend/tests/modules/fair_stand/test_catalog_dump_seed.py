from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.modules.fair_stand.infrastructure import models as _models  # noqa: F401
from app.modules.fair_stand.infrastructure.catalog_dump_seed import seed_catalog_if_empty
from app.modules.fair_stand.infrastructure.seed_catalog import seed_fair_stand_catalog


def _sqlite_engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _fk(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    return engine


def test_dump_seed_fills_empty_database_once():
    engine = _sqlite_engine()
    with engine.begin() as bind:
        seed_catalog_if_empty(bind)
        items = bind.execute(text("SELECT COUNT(*) FROM fair_stand_items")).scalar()
        categories = bind.execute(text("SELECT COUNT(*) FROM fair_stand_categories")).scalar()
        previews = bind.execute(text("SELECT COUNT(*) FROM fair_stand_catalog_preview_kinds")).scalar()
        components = bind.execute(text("SELECT COUNT(*) FROM fair_stand_item_components")).scalar()
        assert items == 96
        assert categories == 7
        assert previews == 28
        assert components == 184
        seed_catalog_if_empty(bind)
        assert bind.execute(text("SELECT COUNT(*) FROM fair_stand_items")).scalar() == 96


def test_dump_seed_skips_when_canonical_seed_already_present():
    engine = _sqlite_engine()
    with Session(engine) as session:
        seed_fair_stand_catalog(session)
        session.commit()
    with engine.begin() as bind:
        seed_catalog_if_empty(bind)
        assert bind.execute(text("SELECT COUNT(*) FROM fair_stand_items")).scalar() == 130
        assert bind.execute(text("SELECT COUNT(*) FROM fair_stand_categories")).scalar() == 6
        assert bind.execute(
            text("SELECT COUNT(*) FROM fair_stand_categories WHERE catalog_name = 'asdadasdasdasd'")
        ).scalar() == 0
