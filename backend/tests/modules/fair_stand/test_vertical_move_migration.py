"""0076: vertical_move ve z_reference öğe kolonları; 0088 dikmeyi açar; zincir seed ile aynı kural."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import text

from app.modules.fair_stand.infrastructure.item_vertical_seed import vertical_fields_for
from app.modules.fair_stand.infrastructure.seed_catalog import seed_fair_stand_catalog


def _migration(name="0076_vertical_move"):
    path = Path(__file__).resolve().parents[3] / f"alembic/versions/{name}.py"
    spec = spec_from_file_location(f"migration_{name}", path)
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_seed_matches_rule():
    assert vertical_fields_for("tv", None) == {"vertical_move": True, "z_reference": "floor"}
    assert vertical_fields_for("profile", None) == {"vertical_move": True, "z_reference": "wall-top"}
    assert vertical_fields_for("flat-panel", "wall-short-2") == {"vertical_move": True, "z_reference": "wall-top"}
    assert vertical_fields_for("flat-panel", None) == {"vertical_move": False, "z_reference": "floor"}
    assert vertical_fields_for("counter", None) == {"vertical_move": False, "z_reference": "floor"}
    assert vertical_fields_for("upright", None) == {"vertical_move": True, "z_reference": "floor"}


def test_upgrade_sets_flags_from_type_and_variant(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    connection = db_session.connection()
    connection.execute(text("UPDATE fair_stand_items SET vertical_move = false, z_reference = 'floor'"))
    migration = _migration()
    upright = _migration("0088_upright_vertical_move")
    with Operations.context(MigrationContext.configure(connection)):
        migration.upgrade()
        migration.upgrade()
        upright.upgrade()
    rows = {
        key: (bool(vertical), reference)
        for key, vertical, reference in connection.execute(
            text("SELECT item_key, vertical_move, z_reference FROM fair_stand_items")
        )
    }
    assert rows["profile_190"] == (True, "wall-top")
    assert rows["wall_100_short_2"] == (True, "wall-top")
    assert rows["wall_100_350"] == (False, "floor")
    assert rows["tv_42"] == (True, "floor")
    assert rows["tulle_fabric"] == (True, "floor")
    assert rows["desk_banko_100"] == (False, "floor")
    assert rows["upright_346_5"] == (True, "floor")
    seeded = {key: vertical_fields_for(item_type, variant) for key, item_type, variant in connection.execute(
        text("SELECT item_key, item_type, variant FROM fair_stand_items")
    )}
    assert all(rows[key] == (fields["vertical_move"], fields["z_reference"]) for key, fields in seeded.items())


def test_upright_downgrade_turns_off_only_uprights(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    connection = db_session.connection()
    with Operations.context(MigrationContext.configure(connection)):
        _migration("0088_upright_vertical_move").downgrade()
    rows = dict(connection.execute(text("SELECT item_key, vertical_move FROM fair_stand_items")).all())
    assert bool(rows["upright_346_5"]) is False
    assert bool(rows["profile_190"]) is True
