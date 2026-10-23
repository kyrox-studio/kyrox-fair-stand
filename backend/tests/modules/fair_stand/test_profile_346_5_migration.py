"""0081: profile_346_5 normal profil; profile_X_scene kartları ve proje anahtarları normal profile çevrilir."""

import json
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import text

from app.modules.fair_stand.infrastructure.seed_catalog import seed_fair_stand_catalog


def _migration():
    path = Path(__file__).resolve().parents[3] / "alembic/versions/0081_profile_346_5.py"
    spec = spec_from_file_location("profile_346_5_migration", path)
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _run(connection, step):
    with Operations.context(MigrationContext.configure(connection)):
        step()


def _keys(connection):
    return {row[0] for row in connection.execute(text("SELECT item_key FROM fair_stand_items"))}


def _dims(connection, item_key):
    real = connection.execute(
        text("SELECT width_cm FROM fair_stand_item_dimensions WHERE item_key = :k"), {"k": item_key}
    ).scalar()
    scene = connection.execute(
        text("SELECT width_cm, depth_cm, height_cm FROM fair_stand_item_scene_dimensions WHERE item_key = :k"),
        {"k": item_key},
    ).one()
    return float(real), tuple(float(value) for value in scene)


def _as_scene_card(connection, legacy, source):
    # Admin ekranında açılmış sahne kartı: kaynak satırın kopyası, farklı anahtar.
    connection.execute(
        text("UPDATE fair_stand_items SET item_key = :legacy WHERE item_key = :source"),
        {"legacy": legacy, "source": source},
    )


def test_seed_already_has_profile_346_5_and_upgrade_is_a_no_op(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    connection = db_session.connection()
    before = _keys(connection)
    assert "profile_346_5" in before
    assert not any(key.endswith("_scene") for key in before)
    _run(connection, _migration().upgrade)
    assert _keys(connection) == before
    assert _dims(connection, "profile_346_5") == (346.5, (350.0, 10.0, 10.0))


def test_upgrade_renames_346_5_scene_card_and_moves_project_keys_to_normal_profiles(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    connection = db_session.connection()
    # 0081 öncesi: 346,5 yalnız sahne kartı olarak var, 190'ın da sahne kopyası açılmış.
    _as_scene_card(connection, "profile_346_5_scene", "profile_346_5")
    connection.execute(
        text(
            "INSERT INTO fair_stand_items (item_key, name, item_type, unit, catalog_visible, is_active, "
            "created_at, updated_at) SELECT 'profile_190_scene', 'Profil 190 Sahne', item_type, unit, false, "
            "is_active, created_at, updated_at FROM fair_stand_items WHERE item_key = 'profile_190'"
        )
    )
    payload = {"modules": [{"itemKey": "profile_346_5_scene"}, {"itemKey": "profile_190_scene"}]}
    connection.execute(
        text(
            "INSERT INTO fair_stand_projects (id, organization_id, customer_id, name, payload, version, created_at, "
            "updated_at) VALUES ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000010', "
            "'00000000-0000-4000-8000-0000000000c1', 'p', "
            ":payload, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        ),
        {"payload": json.dumps(payload)},
    )

    _run(connection, _migration().upgrade)

    keys = _keys(connection)
    assert "profile_346_5" in keys
    assert not any(key.endswith("_scene") for key in keys)
    assert _dims(connection, "profile_346_5") == (346.5, (350.0, 10.0, 10.0))
    assert connection.execute(
        text("SELECT name FROM fair_stand_items WHERE item_key = 'profile_346_5'")
    ).scalar() == "Profil 346,5"
    stored = connection.execute(text("SELECT payload FROM fair_stand_projects")).scalar()
    stored = json.loads(stored) if isinstance(stored, str) else stored
    assert [module["itemKey"] for module in stored["modules"]] == ["profile_346_5", "profile_190"]


def test_downgrade_removes_profile_346_5(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    connection = db_session.connection()
    _run(connection, _migration().downgrade)
    assert "profile_346_5" not in _keys(connection)
