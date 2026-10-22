"""0078: profil boyları — tek kart (profile_289), 239,5 / 388 / 487 profil, sahne ölçüleri 50…500."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import text

from app.modules.fair_stand.infrastructure.seed_catalog import seed_fair_stand_catalog

_EXPECTED = {
    "profile_41_5": (41.5, 50),
    "profile_91": (91, 100),
    "profile_140_5": (140.5, 150),
    "profile_190": (190, 200),
    "profile_239_5": (239.5, 250),
    "profile_289": (289, 300),
    "profile_388": (388, 400),
    "profile_487": (487, 500),
}


def _migration():
    path = Path(__file__).resolve().parents[3] / "alembic/versions/0078_profile_lengths.py"
    spec = spec_from_file_location("profile_lengths_migration", path)
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _run(connection, step):
    with Operations.context(MigrationContext.configure(connection)):
        step()


def _assert_final_state(connection):
    for item_key, (real_cm, scene_cm) in _EXPECTED.items():
        row = connection.execute(
            text(
                "SELECT i.item_type, i.is_render, d.width_cm, s.width_cm, s.depth_cm, s.height_cm FROM fair_stand_items i "
                "JOIN fair_stand_item_dimensions d ON d.item_key = i.item_key "
                "JOIN fair_stand_item_scene_dimensions s ON s.item_key = i.item_key WHERE i.item_key = :k"
            ),
            {"k": item_key},
        ).one()
        assert row[0] == "profile", item_key
        # Gizli boylar da sahnede çizilir (boy penceresinden seçilir).
        assert bool(row[1]) is True, item_key
        assert [float(value) for value in row[2:]] == [real_cm, scene_cm, 10, 10], item_key
    visible = connection.execute(
        text("SELECT item_key FROM fair_stand_items WHERE item_type = 'profile' AND catalog_visible")
    ).scalars().all()
    assert visible == ["profile_289"]
    card = connection.execute(
        text("SELECT category_id, catalog_item_index, preview_id FROM fair_stand_items WHERE item_key = 'profile_289'")
    ).one()
    assert None not in card
    hidden = connection.execute(
        text(
            "SELECT count(*) FROM fair_stand_items WHERE item_type = 'profile' AND item_key <> 'profile_289' "
            "AND (category_id IS NOT NULL OR catalog_item_index IS NOT NULL OR preview_id IS NOT NULL)"
        )
    ).scalar_one()
    assert hidden == 0
    names = dict(
        connection.execute(
            text(
                "SELECT item_key, name FROM fair_stand_items "
                "WHERE item_key IN ('profile_239_5', 'profile_289', 'profile_388', 'profile_487')"
            )
        ).all()
    )
    assert names == {
        "profile_239_5": "Profil 239,5",
        "profile_289": "Profil 289",
        "profile_388": "Profil 388",
        "profile_487": "Profil 487",
    }


def _pre_0078_catalog(connection):
    """0078 öncesi: dört profil ayrı görünür kart, 239,5 ve 289 yok."""
    for item_key in ("profile_239_5", "profile_289", "profile_388", "profile_487"):
        for table in ("fair_stand_item_scene_dimensions", "fair_stand_item_dimensions", "fair_stand_items"):
            connection.execute(text(f"DELETE FROM {table} WHERE item_key = :k"), {"k": item_key})
    category = connection.execute(
        text("SELECT category_id FROM fair_stand_items WHERE item_key = 'upright_346_5'")
    ).scalar_one()
    connection.execute(text("UPDATE fair_stand_items SET catalog_item_index = 14 WHERE item_key = 'box_block'"))
    for index, item_key in enumerate(("profile_190", "profile_140_5", "profile_91", "profile_41_5"), start=10):
        connection.execute(
            text(
                "UPDATE fair_stand_items SET category_id = :c, catalog_item_index = :i, preview_id = 17, "
                "catalog_visible = true WHERE item_key = :k"
            ),
            {"c": category, "i": index, "k": item_key},
        )


def test_fresh_catalog_gets_profile_card_and_239_5(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    connection = db_session.connection()
    _pre_0078_catalog(connection)
    before = connection.execute(text("SELECT count(*) FROM fair_stand_items")).scalar_one()

    migration = _migration()
    _run(connection, migration.upgrade)
    _run(connection, migration.upgrade)

    assert connection.execute(text("SELECT count(*) FROM fair_stand_items")).scalar_one() == before + 4
    _assert_final_state(connection)

    _run(connection, migration.downgrade)
    assert connection.execute(text("SELECT count(*) FROM fair_stand_items")).scalar_one() == before + 1
    for item_key in ("profile_239_5", "profile_388", "profile_487"):
        assert connection.execute(text("SELECT 1 FROM fair_stand_items WHERE item_key = :k"), {"k": item_key}).first() is None


def test_admin_card_profile_289_scene_is_renamed_with_project_payloads(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    connection = db_session.connection()
    # Admin ekranında açılmış kart: profile_289 yerine profile_289_scene; bir proje bu anahtarı taşır.
    connection.execute(text("UPDATE fair_stand_items SET item_key = 'profile_289_scene', name = 'Profile 289 Sahne' WHERE item_key = 'profile_289'"))
    for table in ("fair_stand_item_scene_dimensions", "fair_stand_item_dimensions", "fair_stand_items"):
        for item_key in ("profile_239_5", "profile_388", "profile_487"):
            connection.execute(text(f"DELETE FROM {table} WHERE item_key = :k"), {"k": item_key})
    assert connection.execute(text("SELECT 1 FROM fair_stand_item_dimensions WHERE item_key = 'profile_289_scene'")).first()

    migration = _migration()
    _run(connection, migration.upgrade)

    assert connection.execute(text("SELECT 1 FROM fair_stand_items WHERE item_key = 'profile_289_scene'")).first() is None
    _assert_final_state(connection)
