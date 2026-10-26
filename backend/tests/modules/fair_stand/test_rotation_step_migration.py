import importlib.util
from pathlib import Path

import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations


def test_rotation_step_migration_preserves_leaf_rows_and_restores_previous_values():
    path = Path(__file__).resolve().parents[3] / "alembic/versions/0087_rotation_step_15.py"
    spec = importlib.util.spec_from_file_location("rotation_step_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    with sa.create_engine("sqlite://").begin() as connection:
        connection.execute(sa.text("CREATE TABLE fair_stand_items (item_key TEXT PRIMARY KEY, rotation_step_deg NUMERIC, default_rotation_deg NUMERIC)"))
        connection.execute(sa.text("INSERT INTO fair_stand_items VALUES ('a',45,270),('b',90,0),('leaf',NULL,NULL)"))
        migration.op = Operations(MigrationContext.configure(connection))
        migration.upgrade()
        assert list(connection.execute(sa.text("SELECT item_key,rotation_step_deg,default_rotation_deg FROM fair_stand_items ORDER BY item_key"))) == [('a',15,270),('b',15,0),('leaf',None,None)]
        connection.execute(sa.text("UPDATE fair_stand_items SET rotation_step_deg=30 WHERE item_key='b'"))
        migration.downgrade()
        assert list(connection.execute(sa.text("SELECT item_key,rotation_step_deg FROM fair_stand_items ORDER BY item_key"))) == [('a',45),('b',30),('leaf',None)]
