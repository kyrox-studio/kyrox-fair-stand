"""0079: kısa panel — Tek Sıra / Çift Sıra için tek katalog kartı, diğer genişlikler gizli."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import bindparam, text

from app.modules.fair_stand.infrastructure.seed_catalog import seed_fair_stand_catalog

_SHORT_KEYS = tuple(f"wall_{width}_short_{rows}" for rows in (1, 2) for width in (50, 100, 150, 200))
_CARDS = ("wall_100_short_1", "wall_100_short_2")
_ROWS_LABEL = {"1": "Tek", "2": "Çift"}
# 0078 sonundaki adlar → 0079 adları (ad = sahnedeki öğenin ölçüsü).
_NAMES = {
    **{
        f"wall_{width}_short_{rows}": (f"Panel {width} Kısa {label} Sıra", f"Panel {label} Sıra {width}")
        for rows, label in _ROWS_LABEL.items()
        for width in (50, 100, 150, 200)
    },
    **{
        key: (f"Profil {size} cm", f"Profil {size}")
        for key, size in (("profile_41_5", "41,5"), ("profile_91", "91"), ("profile_140_5", "140,5"), ("profile_190", "190"))
    },
    **{
        key: (f"Dikme {size} cm", f"Dikme {size}")
        for key, size in (
            ("upright_49_5", "49,5"), ("upright_99", "99"), ("upright_247_5", "247,5"), ("upright_297", "297"),
            ("upright_346_5", "346,5"), ("upright_396", "396"), ("upright_445_5", "445,5"), ("upright_495", "495"),
        )
    },
}
# 0078 sonundaki seed: sekiz genişlik görünür, kategori içi sıra 1…8, ardından dikme / profil / kutu.
_PRE_0079_ORDER = (
    "wall_200_short_2", "wall_150_short_2", "wall_100_short_2", "wall_50_short_2",
    "wall_200_short_1", "wall_150_short_1", "wall_100_short_1", "wall_50_short_1",
    "upright_346_5", "profile_289", "box_block",
)


def _migration():
    path = Path(__file__).resolve().parents[3] / "alembic/versions/0079_wall_short_cards.py"
    spec = spec_from_file_location("wall_short_cards_migration", path)
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _run(connection, step):
    with Operations.context(MigrationContext.configure(connection)):
        step()


def _category(connection):
    return connection.execute(
        text("SELECT category_id FROM fair_stand_items WHERE item_key = 'upright_346_5'")
    ).scalar_one()


def _visible_order(connection, category_id):
    return connection.execute(
        text(
            "SELECT item_key, catalog_item_index FROM fair_stand_items "
            "WHERE category_id = :c AND catalog_visible ORDER BY catalog_item_index"
        ),
        {"c": category_id},
    ).all()


def _names(connection):
    return dict(
        connection.execute(
            text("SELECT item_key, name FROM fair_stand_items WHERE item_key IN :keys").bindparams(
                bindparam("keys", expanding=True)
            ),
            {"keys": list(_NAMES)},
        ).all()
    )


def _pre_0079_catalog(connection):
    """0079 öncesi: sekiz kısa panel ayrı görünür kart, adlarında genişlik yazar."""
    category = _category(connection)
    preview = connection.execute(
        text("SELECT preview_id FROM fair_stand_items WHERE item_key = 'wall_100_short_1'")
    ).scalar_one()
    connection.execute(
        text("UPDATE fair_stand_items SET catalog_item_index = NULL, catalog_visible = false WHERE category_id = :c"),
        {"c": category},
    )
    for index, item_key in enumerate(_PRE_0079_ORDER, start=1):
        connection.execute(
            text(
                "UPDATE fair_stand_items SET category_id = :c, catalog_item_index = :i, catalog_visible = true, "
                "preview_id = COALESCE(preview_id, :p) WHERE item_key = :k"
            ),
            {"c": category, "i": index, "p": preview, "k": item_key},
        )
    for item_key, (previous, _current) in _NAMES.items():
        connection.execute(
            text("UPDATE fair_stand_items SET name = :n WHERE item_key = :k"),
            {"n": previous, "k": item_key},
        )
    return category


def _assert_final_state(connection, category):
    visible = connection.execute(
        text(
            "SELECT item_key FROM fair_stand_items WHERE variant IN ('wall-short-1', 'wall-short-2') "
            "AND catalog_visible ORDER BY item_key"
        )
    ).scalars().all()
    assert visible == sorted(_CARDS)
    hidden = connection.execute(
        text(
            "SELECT count(*) FROM fair_stand_items WHERE variant IN ('wall-short-1', 'wall-short-2') "
            "AND item_key NOT IN ('wall_100_short_1', 'wall_100_short_2') "
            "AND (category_id IS NOT NULL OR catalog_item_index IS NOT NULL OR preview_id IS NOT NULL)"
        )
    ).scalar_one()
    assert hidden == 0
    assert _names(connection) == {key: current for key, (_previous, current) in _NAMES.items()}
    # Item'lar silinmez; sahnede çizilir (genişlik penceresi ve otomatik alınlık kullanır).
    for item_key in _SHORT_KEYS:
        row = connection.execute(
            text("SELECT is_render FROM fair_stand_items WHERE item_key = :k"), {"k": item_key}
        ).one()
        assert bool(row[0]) is True, item_key
    assert _visible_order(connection, category) == [
        ("wall_100_short_2", 1),
        ("wall_100_short_1", 2),
        ("upright_346_5", 3),
        ("profile_289", 4),
        ("box_block", 5),
    ]


def test_eight_short_cards_become_two(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    connection = db_session.connection()
    category = _pre_0079_catalog(connection)
    before = connection.execute(text("SELECT count(*) FROM fair_stand_items")).scalar_one()

    migration = _migration()
    _run(connection, migration.upgrade)
    _run(connection, migration.upgrade)

    assert connection.execute(text("SELECT count(*) FROM fair_stand_items")).scalar_one() == before
    _assert_final_state(connection, category)

    _run(connection, migration.downgrade)
    assert [key for key, _index in _visible_order(connection, category)] == list(_PRE_0079_ORDER)
    assert _names(connection) == {key: previous for key, (previous, _current) in _NAMES.items()}


def test_seed_already_matches_post_0079_catalog(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    connection = db_session.connection()
    category = _category(connection)

    _assert_final_state(connection, category)
    _run(connection, _migration().upgrade)
    _assert_final_state(connection, category)
