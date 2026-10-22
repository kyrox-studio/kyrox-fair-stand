"""0079: uzun profil/dikmenin sıralı parça bölünüşü (yalnız BOM etiketi) ve profile_8."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import inspect, text

from app.modules.fair_stand.infrastructure.seed_catalog import seed_fair_stand_catalog

_EXPECTED = {
    "profile_388": ["upright_346_5", "profile_41_5"],
    "profile_487": ["upright_346_5", "profile_140_5"],
    "upright_396": ["upright_346_5", "upright_49_5"],
    "upright_445_5": ["upright_346_5", "upright_99"],
    "upright_495": ["upright_346_5", "profile_8", "profile_140_5"],
}


def _migration():
    path = Path(__file__).resolve().parents[3] / "alembic/versions/0079_item_length_parts.py"
    spec = spec_from_file_location("item_length_parts_migration", path)
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _run(connection, step):
    with Operations.context(MigrationContext.configure(connection)):
        step()


def _length_cm(connection, item_key):
    row = connection.execute(
        text(
            "SELECT i.item_type, d.width_cm, d.height_cm FROM fair_stand_items i "
            "JOIN fair_stand_item_dimensions d ON d.item_key = i.item_key WHERE i.item_key = :k"
        ),
        {"k": item_key},
    ).one()
    return float(row[2] if row[0] == "upright" else row[1])


def _parts(connection):
    rows = connection.execute(
        text("SELECT item_key, position, part_item_key FROM fair_stand_item_length_parts ORDER BY item_key, position")
    ).all()
    parts = {}
    for item_key, position, part in rows:
        parts.setdefault(item_key, []).append((position, part))
    return {key: [part for _, part in sorted(value)] for key, value in parts.items()}


def test_upgrade_writes_ordered_parts_whose_lengths_sum_to_the_long_item(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    connection = db_session.connection()
    # 0079 öncesi: tablo ve profile_8 yok.
    connection.execute(text("DROP TABLE fair_stand_item_length_parts"))
    connection.execute(text("DELETE FROM fair_stand_item_dimensions WHERE item_key = 'profile_8'"))
    connection.execute(text("DELETE FROM fair_stand_items WHERE item_key = 'profile_8'"))
    before = connection.execute(text("SELECT count(*) FROM fair_stand_items")).scalar_one()

    migration = _migration()
    _run(connection, migration.upgrade)
    _run(connection, migration.upgrade)

    assert connection.execute(text("SELECT count(*) FROM fair_stand_items")).scalar_one() == before + 1
    piece = connection.execute(
        text("SELECT name, item_type, catalog_visible, is_render FROM fair_stand_items WHERE item_key = 'profile_8'")
    ).one()
    assert piece[0] == "Profil 8" and piece[1] == "profile"
    assert bool(piece[2]) is False and bool(piece[3]) is False
    assert _length_cm(connection, "profile_8") == 8

    parts = _parts(connection)
    assert parts == _EXPECTED
    for item_key, item_parts in parts.items():
        assert sum(_length_cm(connection, part) for part in item_parts) == _length_cm(connection, item_key), item_key

    # BOM ve reçete değişmez: uzun parçaların alt Item (components) satırı yoktur.
    assert connection.execute(
        text("SELECT count(*) FROM fair_stand_item_components WHERE parent_item_key IN "
             "('profile_388', 'profile_487', 'upright_396', 'upright_445_5', 'upright_495')")
    ).scalar_one() == 0

    _run(connection, migration.downgrade)
    assert not inspect(connection).has_table("fair_stand_item_length_parts")
    assert connection.execute(text("SELECT 1 FROM fair_stand_items WHERE item_key = 'profile_8'")).first() is None


def test_seed_carries_the_same_length_parts(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    assert _parts(db_session.connection()) == _EXPECTED
