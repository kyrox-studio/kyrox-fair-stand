"""Vitrin gövdesi renk yeteneği DB kaydından gelir; görsel yeteneği açılmaz."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import text

from app.modules.fair_stand.infrastructure.seed_catalog import seed_fair_stand_catalog


def test_showcase_body_color_upgrade_downgrade_and_seed(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    connection = db_session.connection()
    keys = ("showcase_side_94_6_30", "showcase_side_143_5_30", "showcase_horizontal_87_4_30")

    def rows():
        return connection.execute(text(
            "SELECT item_key, accepts_color, accepts_image FROM fair_stand_items "
            "WHERE item_key LIKE 'showcase_%' ORDER BY item_key"
        )).all()

    seeded = rows()
    assert all(bool(row.accepts_color) and not row.accepts_image for row in seeded if row.item_key in keys)
    count = connection.execute(text("SELECT count(*) FROM fair_stand_items")).scalar_one()
    path = Path(__file__).resolve().parents[3] / "alembic/versions/0085_showcase_body_color.py"
    spec = spec_from_file_location("showcase_body_color", path)
    migration = module_from_spec(spec)
    spec.loader.exec_module(migration)
    with Operations.context(MigrationContext.configure(connection)):
        migration.downgrade()
        downgraded = rows()
        assert all(not row.accepts_color for row in downgraded if row.item_key in keys)
        assert [row for row in downgraded if row.item_key not in keys] == [row for row in seeded if row.item_key not in keys]
        migration.upgrade()
        migration.upgrade()
    assert rows() == seeded
    assert connection.execute(text("SELECT count(*) FROM fair_stand_items")).scalar_one() == count
