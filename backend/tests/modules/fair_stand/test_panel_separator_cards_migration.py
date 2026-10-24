"""0082: Panel ve Separatör — tek katalog kartı, diğer genişlikler gizli, aileler variant ile."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import text

from app.modules.fair_stand.infrastructure.seed_catalog import seed_fair_stand_catalog

_VARIANTS = {
    **{f"wall_{width}_350": "wall-panel" for width in (50, 100, 150, 200)},
    "wall_separator_50_350": "wall-separator",
    "wall_separator_100_350": "wall-separator",
    "wall_separator_50_350_sarmasik": "wall-separator-sarmasik",
    "wall_separator_100_350_sarmasik": "wall-separator-sarmasik",
}
# 0081 sonundaki seed: kategori içi sıra.
_PRE_0082_ORDER = (
    "wall_200_350", "wall_150_350", "wall_100_350", "wall_50_350",
    "wall_separator_100_350", "wall_separator_50_350",
    "wall_separator_100_350_sarmasik", "wall_separator_50_350_sarmasik",
    "wall_door_100_350",
)
_PREVIEWS = {"wall_separator_100_350_sarmasik": 19, "wall_separator_50_350_sarmasik": 19}


def _migration():
    path = Path(__file__).resolve().parents[3] / "alembic/versions/0082_panel_separator_cards.py"
    spec = spec_from_file_location("panel_separator_cards_migration", path)
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _run(connection, step):
    with Operations.context(MigrationContext.configure(connection)):
        step()


def _category(connection):
    return connection.execute(
        text("SELECT category_id FROM fair_stand_items WHERE item_key = 'wall_door_100_350'")
    ).scalar_one()


def _visible_order(connection, category_id):
    return connection.execute(
        text(
            "SELECT item_key, catalog_item_index FROM fair_stand_items "
            "WHERE category_id = :c AND catalog_visible ORDER BY catalog_item_index"
        ),
        {"c": category_id},
    ).all()


def _variants(connection):
    return dict(
        connection.execute(
            text("SELECT item_key, variant FROM fair_stand_items WHERE item_key LIKE 'wall_%_350%'")
        ).all()
    )


def _pre_0082_catalog(connection):
    """0082 öncesi: dört panel ve dört separatör ayrı görünür kart, variant boş."""
    category = _category(connection)
    connection.execute(
        text("UPDATE fair_stand_items SET catalog_item_index = NULL, catalog_visible = false WHERE category_id = :c"),
        {"c": category},
    )
    for index, item_key in enumerate(_PRE_0082_ORDER, start=1):
        preview = _PREVIEWS.get(item_key) or connection.execute(
            text("SELECT preview_id FROM fair_stand_items WHERE item_key = :k"),
            {"k": "wall_separator_100_350" if "separator" in item_key else (
                "wall_door_100_350" if "door" in item_key else "wall_100_350")},
        ).scalar_one()
        connection.execute(
            text(
                "UPDATE fair_stand_items SET category_id = :c, catalog_item_index = :i, catalog_visible = true, "
                "preview_id = :p, variant = NULL WHERE item_key = :k"
            ),
            {"c": category, "i": index, "p": preview, "k": item_key},
        )
    return category


def _assert_final_state(connection, category):
    variants = _variants(connection)
    assert {key: variants.get(key) for key in _VARIANTS} == _VARIANTS
    assert _visible_order(connection, category) == [
        ("wall_100_350", 1),
        ("wall_separator_100_350", 2),
        ("wall_door_100_350", 3),
    ]
    hidden = connection.execute(
        text(
            "SELECT count(*) FROM fair_stand_items WHERE variant IN ('wall-panel', 'wall-separator', "
            "'wall-separator-sarmasik') AND item_key NOT IN ('wall_100_350', 'wall_separator_100_350') "
            "AND (catalog_visible OR category_id IS NOT NULL OR catalog_item_index IS NOT NULL "
            "OR preview_id IS NOT NULL)"
        )
    ).scalar_one()
    assert hidden == 0
    # Item'lar silinmez; sahnede çizilir (genişlik penceresi seçer).
    for item_key in _VARIANTS:
        row = connection.execute(
            text("SELECT is_render FROM fair_stand_items WHERE item_key = :k"), {"k": item_key}
        ).one()
        assert bool(row[0]) is True, item_key


def test_panel_and_separator_cards_become_one_each(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    connection = db_session.connection()
    category = _pre_0082_catalog(connection)
    before = connection.execute(text("SELECT count(*) FROM fair_stand_items")).scalar_one()

    migration = _migration()
    _run(connection, migration.upgrade)
    _run(connection, migration.upgrade)

    assert connection.execute(text("SELECT count(*) FROM fair_stand_items")).scalar_one() == before
    _assert_final_state(connection, category)

    _run(connection, migration.downgrade)
    assert [key for key, _index in _visible_order(connection, category)] == list(_PRE_0082_ORDER)
    variants = _variants(connection)
    assert all(variants.get(key) is None for key in _VARIANTS)


def test_seed_already_matches_post_0082_catalog(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    connection = db_session.connection()
    category = _category(connection)

    _assert_final_state(connection, category)
    _run(connection, _migration().upgrade)
    _assert_final_state(connection, category)
