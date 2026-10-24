"""0083: Banko, Köşe Banko ve Baza — tek katalog kartı, diğer ölçüler gizli, aileler variant ile."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import text

from app.modules.fair_stand.infrastructure.seed_catalog import seed_fair_stand_catalog

_VARIANTS = {
    **{f"desk_banko_{width}": "desk-banko" for width in (200, 150, 100)},
    **{f"desk_banko_{width}_l": "desk-banko-l" for width in (200, 150, 100)},
    **{f"base_{width}": "base" for width in (200, 150, 100)},
}
# 0082 sonundaki seed: kategori içi sıra.
_PRE_0082_ORDER = (
    "desk_banko_200", "desk_banko_150", "desk_banko_100",
    "desk_banko_200_l", "desk_banko_150_l", "desk_banko_100_l",
    "base_200", "base_150", "base_100",
)


def _migration():
    path = Path(__file__).resolve().parents[3] / "alembic/versions/0083_banko_base_cards.py"
    spec = spec_from_file_location("banko_base_cards_migration", path)
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _run(connection, step):
    with Operations.context(MigrationContext.configure(connection)):
        step()


def _category(connection):
    return connection.execute(
        text("SELECT category_id FROM fair_stand_items WHERE item_key = 'desk_banko_100'")
    ).scalar_one()


# 0086 Ayaklı Vitrin'i bu kategorinin sonuna taşıdı; 0083 kartlarının sırası ayrıca denetlenir.
_LATER_CARDS = ("floor_showcase_100",)


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
            text("SELECT item_key, variant FROM fair_stand_items WHERE item_key LIKE 'desk_banko_%' OR item_key LIKE 'base_%'")
        ).all()
    )


def _pre_0082_catalog(connection):
    """0083 öncesi: dokuz banko/baza ayrı görünür kart, variant boş."""
    category = _category(connection)
    connection.execute(
        text("UPDATE fair_stand_items SET catalog_item_index = NULL, catalog_visible = false WHERE category_id = :c"),
        {"c": category},
    )
    for index, item_key in enumerate(_PRE_0082_ORDER, start=1):
        preview = connection.execute(
            text("SELECT preview_id FROM fair_stand_items WHERE item_key = :k"),
            {"k": "base_100" if item_key.startswith("base_") else "desk_banko_100"},
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
    assert [row for row in _visible_order(connection, category) if row[0] not in _LATER_CARDS] == [
        ("desk_banko_100", 1),
        ("desk_banko_100_l", 2),
        ("base_100", 3),
    ]
    hidden = connection.execute(
        text(
            "SELECT count(*) FROM fair_stand_items WHERE variant IN ('desk-banko', 'desk-banko-l', 'base') "
            "AND item_key NOT IN ('desk_banko_100', 'desk_banko_100_l', 'base_100') "
            "AND (catalog_visible OR category_id IS NOT NULL OR catalog_item_index IS NOT NULL "
            "OR preview_id IS NOT NULL)"
        )
    ).scalar_one()
    assert hidden == 0
    # Item'lar silinmez; sahnede çizilir (ölçü penceresi seçer).
    for item_key in _VARIANTS:
        row = connection.execute(
            text("SELECT is_render FROM fair_stand_items WHERE item_key = :k"), {"k": item_key}
        ).one()
        assert bool(row[0]) is True, item_key


def test_banko_and_base_cards_become_one_each(db_session):
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


def test_seed_already_matches_post_0083_catalog(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    connection = db_session.connection()
    category = _category(connection)

    _assert_final_state(connection, category)
    _run(connection, _migration().upgrade)
    _assert_final_state(connection, category)
