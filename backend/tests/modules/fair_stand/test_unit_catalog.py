"""fair_stand_units catalog and the item unit foreign key."""

from datetime import UTC, datetime
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.pool import StaticPool

from app.modules.fair_stand.infrastructure.models import FairStandUnitModel
from app.modules.fair_stand.infrastructure.seed_catalog import seed_fair_stand_catalog


def _now():
    return datetime.now(tz=UTC)


def _unit(**overrides) -> FairStandUnitModel:
    now = _now()
    values = {
        "unit_key": "m2",
        "name": "Metrekare",
        "symbol": "m2",
        "created_at": now,
        "updated_at": now,
    }
    values.update(overrides)
    return FairStandUnitModel(**values)


def test_unit_catalog_revision_is_single_head():
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    script = ScriptDirectory.from_config(Config("alembic.ini"))
    assert script.get_heads() == ["0085_showcase_body_color"]
    revision = script.get_revision("0085_showcase_body_color")
    assert revision.down_revision == "0084_illuminated_foam_card"
    revision = script.get_revision("0083_banko_base_cards")
    assert revision.down_revision == "0082_panel_separator_cards"
    revision = script.get_revision("0082_panel_separator_cards")
    assert revision.down_revision == "0081_profile_346_5"
    revision = script.get_revision("0081_profile_346_5")
    assert revision.down_revision == "0080_item_length_parts"
    revision = script.get_revision("0080_item_length_parts")
    assert revision.down_revision == "0079_wall_short_cards"
    revision = script.get_revision("0079_wall_short_cards")
    assert revision.down_revision == "0078_profile_lengths"
    revision = script.get_revision("0078_profile_lengths")
    assert revision.down_revision == "0077_upright_render"
    revision = script.get_revision("0077_upright_render")
    assert revision.down_revision == "0076_vertical_move"
    revision = script.get_revision("0076_vertical_move")
    assert revision.down_revision == "0075_glass_bar_table"
    revision = script.get_revision("0075_glass_bar_table")
    assert revision.down_revision == "0074_showcase_brochure"
    revision = script.get_revision("0074_showcase_brochure")
    assert revision.down_revision == "0073_move_snap_10cm"
    revision = script.get_revision("0073_move_snap_10cm")
    assert revision.down_revision == "0072_shelf_rows"
    revision = script.get_revision("0072_shelf_rows")
    assert revision.down_revision == "0071_separator_50_band_recipe"
    revision = script.get_revision("0071_separator_50_band_recipe")
    assert revision.down_revision == "0070_separator_band_recipe"
    revision = script.get_revision("0070_separator_band_recipe")
    assert revision.down_revision == "0069_door_showcase_band_recipe"
    revision = script.get_revision("0069_door_showcase_band_recipe")
    assert revision.down_revision == "0068_wall_band_recipe"
    revision = script.get_revision("0068_wall_band_recipe")
    assert revision.down_revision == "0067_group_templates"
    revision = script.get_revision("0067_group_templates")
    assert revision.down_revision == "0066_metal_separator_area"
    revision = script.get_revision("0066_metal_separator_area")
    assert revision.down_revision == "0065_metal_separator"
    revision = script.get_revision("0065_metal_separator")
    assert revision.down_revision == "0064_tulle_fabric"
    revision = script.get_revision("0064_tulle_fabric")
    assert revision.down_revision == "0063_cost_item_manual"
    revision = script.get_revision("0063_cost_item_manual")
    assert revision.down_revision == "0062_cost_items"
    revision = script.get_revision("0062_cost_items")
    assert revision.down_revision == "0061_drop_foam_logo_item"
    revision = script.get_revision("0061_drop_foam_logo_item")
    assert revision.down_revision == "0060_item_prices"
    revision = script.get_revision("0060_item_prices")
    assert revision.down_revision == "0059_elektrik_panosu_item"
    revision = script.get_revision("0059_elektrik_panosu_item")
    assert revision.down_revision == "0058_item_cost_enabled"
    revision = script.get_revision("0058_item_cost_enabled")
    assert revision.down_revision == "0057_foam_logo_item"
    revision = script.get_revision("0057_foam_logo_item")
    assert revision.down_revision == "0056_mesh_fabric_key"
    revision = script.get_revision("0056_mesh_fabric_key")
    assert revision.down_revision == "0055_item_unit_fk"
    revision = script.get_revision("0055_item_unit_fk")
    assert revision.down_revision == "0054_production_items"
    revision = script.get_revision("0054_production_items")
    assert revision.down_revision == "0053_item_type_scene_behavior"
    split = script.get_revision("0053_item_type_scene_behavior")
    assert split.down_revision == "0052_unit_key"
    revision = script.get_revision("0052_unit_key")
    assert revision.down_revision == "0051_unit_catalog"
    previous = script.get_revision("0051_unit_catalog")
    assert previous.down_revision == "0050_box_block_rotation_45"


def test_unit_catalog_table_shape(test_engine):
    inspector = inspect(test_engine)
    columns = {column["name"]: column for column in inspector.get_columns("fair_stand_units")}
    assert set(columns) == {"id", "unit_key", "name", "symbol", "is_active", "created_at", "updated_at"}
    assert "organization_id" not in columns
    for name in ("unit_key", "name", "symbol", "is_active", "created_at", "updated_at"):
        assert columns[name]["nullable"] is False
    assert inspector.get_pk_constraint("fair_stand_units")["constrained_columns"] == ["id"]
    unique = next(
        item
        for item in inspector.get_unique_constraints("fair_stand_units")
        if item["name"] == "uq_fair_stand_units_unit_key"
    )
    assert unique["column_names"] == ["unit_key"]
    assert inspector.get_foreign_keys("fair_stand_units") == []


def test_item_unit_column_references_unit_catalog(test_engine):
    inspector = inspect(test_engine)
    unit = next(column for column in inspector.get_columns("fair_stand_items") if column["name"] == "unit")
    assert unit["nullable"] is True
    fk = next(
        item
        for item in inspector.get_foreign_keys("fair_stand_items")
        if item.get("name") == "fk_fair_stand_items_unit_key"
    )
    assert fk["referred_table"] == "fair_stand_units"
    assert fk["referred_columns"] == ["unit_key"]
    assert fk["constrained_columns"] == ["unit"]
    assert fk["options"]["onupdate"] == "CASCADE"
    assert fk["options"]["ondelete"] == "RESTRICT"


def test_unit_code_name_and_symbol_are_required(test_engine):
    now = _now()
    statements = (
        "INSERT INTO fair_stand_units (name, symbol, created_at, updated_at) VALUES ('Adet', 'ad', :created_at, :updated_at)",
        "INSERT INTO fair_stand_units (unit_key, symbol, created_at, updated_at) VALUES ('piece', 'ad', :created_at, :updated_at)",
        "INSERT INTO fair_stand_units (unit_key, name, created_at, updated_at) VALUES ('piece', 'Adet', :created_at, :updated_at)",
    )
    for statement in statements:
        with test_engine.connect() as connection:
            with pytest.raises(IntegrityError):
                connection.execute(text(statement), {"created_at": now, "updated_at": now})


def test_unit_code_unique(db_session):
    db_session.add(_unit(unit_key="piece", name="Adet", symbol="ad"))
    db_session.flush()
    db_session.add(_unit(unit_key="piece", name="Adet kopya", symbol="adet"))
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_unit_is_active_defaults_true(db_session):
    now = _now()
    db_session.execute(
        text(
            """
            INSERT INTO fair_stand_units (unit_key, name, symbol, created_at, updated_at)
            VALUES ('piece', 'Adet', 'ad', :created_at, :updated_at)
            """
        ),
        {"created_at": now, "updated_at": now},
    )
    db_session.flush()
    active = db_session.execute(
        text("SELECT is_active FROM fair_stand_units WHERE unit_key = 'piece'")
    ).scalar_one()
    assert bool(active) is True


def test_catalog_seed_ensures_only_referenced_unit_keys(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    keys = set(db_session.execute(text("SELECT unit_key FROM fair_stand_units")).scalars())
    assert keys == {"adet", "metre_kare"}


def test_unit_catalog_migration_upgrade_and_downgrade():
    from alembic.operations import Operations
    from alembic.runtime.migration import MigrationContext

    path = Path(__file__).resolve().parents[3] / "alembic" / "versions" / "0051_unit_catalog.py"
    spec = spec_from_file_location("fair_stand_0051_unit_catalog", path)
    assert spec is not None and spec.loader is not None
    migration = module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    with engine.connect() as connection:
        context = MigrationContext.configure(connection)
        with Operations.context(context):
            migration.upgrade()
        connection.commit()

        inspector = inspect(connection)
        assert "fair_stand_units" in inspector.get_table_names()
        connection.execute(
            text(
                """
                INSERT INTO fair_stand_units (code, name, symbol, created_at, updated_at)
                VALUES ('m2', 'Metrekare', 'm2', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """
            )
        )
        connection.commit()
        active = connection.execute(
            text("SELECT is_active FROM fair_stand_units WHERE code = 'm2'")
        ).scalar_one()
        assert bool(active) is True

        with pytest.raises(IntegrityError):
            connection.execute(
                text(
                    """
                    INSERT INTO fair_stand_units (code, name, symbol, created_at, updated_at)
                    VALUES ('m2', 'Kopya', 'm²', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """
                )
            )
        connection.rollback()
        with pytest.raises(IntegrityError):
            connection.execute(
                text(
                    """
                    INSERT INTO fair_stand_units (name, symbol, created_at, updated_at)
                    VALUES ('Adet', 'ad', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """
                )
            )
        connection.rollback()

        context = MigrationContext.configure(connection)
        with Operations.context(context):
            migration.downgrade()
        connection.commit()
        assert "fair_stand_units" not in inspect(connection).get_table_names()


def _load_migration(filename: str, module_name: str):
    path = Path(__file__).resolve().parents[3] / "alembic" / "versions" / filename
    spec = spec_from_file_location(module_name, path)
    assert spec is not None and spec.loader is not None
    migration = module_from_spec(spec)
    spec.loader.exec_module(migration)
    return migration


def test_unit_key_migration_renames_code_and_keeps_rows():
    from alembic.operations import Operations
    from alembic.runtime.migration import MigrationContext

    create_units = _load_migration("0051_unit_catalog.py", "fair_stand_0051_unit_catalog_for_0052")
    rename_key = _load_migration("0052_unit_key.py", "fair_stand_0052_unit_key")
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    with engine.connect() as connection:
        context = MigrationContext.configure(connection)
        with Operations.context(context):
            create_units.upgrade()
        connection.execute(
            text(
                """
                INSERT INTO fair_stand_units (code, name, symbol, is_active, created_at, updated_at)
                VALUES ('metrekare', 'Metrekare', 'm²', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """
            )
        )
        connection.commit()

        context = MigrationContext.configure(connection)
        with Operations.context(context):
            rename_key.upgrade()
        connection.commit()

        inspector = inspect(connection)
        names = {column["name"] for column in inspector.get_columns("fair_stand_units")}
        assert "unit_key" in names
        assert "code" not in names
        kept = connection.execute(
            text("SELECT name, symbol, is_active FROM fair_stand_units WHERE unit_key = 'metrekare'")
        ).one()
        assert kept.name == "Metrekare"
        assert kept.symbol == "m²"
        assert bool(kept.is_active) is True
        with pytest.raises(IntegrityError):
            connection.execute(
                text(
                    """
                    INSERT INTO fair_stand_units (unit_key, name, symbol, is_active, created_at, updated_at)
                    VALUES ('metrekare', 'Kopya', 'm2', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """
                )
            )
        connection.rollback()

        context = MigrationContext.configure(connection)
        with Operations.context(context):
            rename_key.downgrade()
        connection.commit()
        names = {column["name"] for column in inspect(connection).get_columns("fair_stand_units")}
        assert "code" in names
        assert "unit_key" not in names
        restored = connection.execute(
            text("SELECT name, symbol FROM fair_stand_units WHERE code = 'metrekare'")
        ).one()
        assert restored.name == "Metrekare"
        assert restored.symbol == "m²"
