"""0086: Vitrin, Raf, TV, Video Wall, Uzun Saksı — tek katalog kartı; Vitrin ve Ayaklı Vitrin taşınır."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import bindparam, text

from app.modules.fair_stand.infrastructure.seed_catalog import seed_fair_stand_catalog

_VARIANTS = {
    "wall_showcase_100_2_350": "wall-showcase",
    "wall_showcase_100_3_350": "wall-showcase",
    "shelf_row_1": "shelf-row",
    "shelf_row_2": "shelf-row",
    "shelf_row_3": "shelf-row",
    "tv_42": "tv",
    "tv_55": "tv",
    "tv_65": "tv",
    "video_wall_2x2": "video-wall",
    "video_wall_3x3": "video-wall",
    "extra_long_planter_100": "long-planter",
    "extra_long_planter_150": "long-planter",
    "extra_long_planter_200": "long-planter",
}
_CARDS = ("wall_showcase_100_3_350", "shelf_row_1", "tv_42", "video_wall_2x2", "extra_long_planter_100")
# 0085 sonundaki seed: kategori → görünür sıra.
_PRE_0086 = {
    "panel": ("wall_100_350", "wall_separator_100_350", "wall_door_100_350"),
    "shelf": (
        "wall_showcase_100_3_350", "wall_showcase_100_2_350",
        "shelf_row_1", "shelf_row_2", "shelf_row_3", "floor_showcase_100",
    ),
    "banko": ("desk_banko_100", "desk_banko_100_l", "base_100"),
    "extra": (
        "furniture_sofa_set_classic", "furniture_sofa_single_classic", "furniture_sofa_double_classic",
        "furniture_coffee_table_classic", "furniture_table_chair_set_eames", "chair_eames", "glass_table",
        "furniture_bar_stool_classic", "mini_fridge_avanti", "kettle", "coat_rack", "plastic_trash_bin",
        "extra_indoor_plant_1", "extra_long_planter_100", "extra_long_planter_150", "extra_long_planter_200",
        "tulle_fabric", "brochure_stand", "glass_bar_table",
    ),
    "electronics": ("tv_42", "tv_55", "video_wall_2x2", "video_wall_3x3", "tv_65", "led_floodlight", "illuminated-foam"),
}
_POST_0086 = {
    "panel": ("wall_100_350", "wall_separator_100_350", "wall_door_100_350", "wall_showcase_100_3_350"),
    "shelf": ("shelf_row_1",),
    "banko": ("desk_banko_100", "desk_banko_100_l", "base_100", "floor_showcase_100"),
    "extra": (
        "furniture_sofa_set_classic", "furniture_sofa_single_classic", "furniture_sofa_double_classic",
        "furniture_coffee_table_classic", "furniture_table_chair_set_eames", "chair_eames", "glass_table",
        "furniture_bar_stool_classic", "mini_fridge_avanti", "kettle", "coat_rack", "plastic_trash_bin",
        "extra_indoor_plant_1", "extra_long_planter_100", "tulle_fabric", "brochure_stand", "glass_bar_table",
    ),
    "electronics": ("tv_42", "video_wall_2x2", "led_floodlight", "illuminated-foam"),
}
# Kategori kimliğini veren Item (kategori kimliği ortama göre değişir).
_ANCHORS = {
    "panel": "wall_100_350",
    "shelf": "shelf_row_1",
    "banko": "desk_banko_100",
    "extra": "extra_indoor_plant_1",
    "electronics": "led_floodlight",
}


def _migration():
    path = Path(__file__).resolve().parents[3] / "alembic/versions/0086_variant_family_cards.py"
    spec = spec_from_file_location("variant_family_cards_migration", path)
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _run(connection, step):
    with Operations.context(MigrationContext.configure(connection)):
        step()


def _categories(connection):
    return {
        name: connection.execute(
            text("SELECT category_id FROM fair_stand_items WHERE item_key = :k"), {"k": anchor}
        ).scalar_one()
        for name, anchor in _ANCHORS.items()
    }


def _visible_order(connection, category_id):
    return tuple(
        connection.execute(
            text(
                "SELECT item_key FROM fair_stand_items "
                "WHERE category_id = :c AND catalog_visible ORDER BY catalog_item_index"
            ),
            {"c": category_id},
        ).scalars().all()
    )


def _indexes(connection, category_id):
    return connection.execute(
        text(
            "SELECT catalog_item_index FROM fair_stand_items "
            "WHERE category_id = :c AND catalog_visible ORDER BY catalog_item_index"
        ),
        {"c": category_id},
    ).scalars().all()


def _variants(connection):
    return dict(
        connection.execute(
            text("SELECT item_key, variant FROM fair_stand_items WHERE item_key IN :keys").bindparams(
                bindparam("keys", expanding=True)
            ),
            {"keys": list(_VARIANTS)},
        ).all()
    )


def _pre_0086_catalog(connection, categories):
    """0086 öncesi: aile üyeleri ayrı görünür kart, variant boş, vitrinler Raf & Vitrin altında."""
    previews = {
        key: connection.execute(
            text("SELECT preview_id FROM fair_stand_items WHERE item_key = :k"), {"k": key}
        ).scalar_one()
        for key in (*_CARDS, "floor_showcase_100")
    }
    family_card = {
        "wall_showcase_100_2_350": "wall_showcase_100_3_350",
        "shelf_row_2": "shelf_row_1", "shelf_row_3": "shelf_row_1",
        "tv_55": "tv_42", "tv_65": "tv_42", "video_wall_3x3": "video_wall_2x2",
        "extra_long_planter_150": "extra_long_planter_100", "extra_long_planter_200": "extra_long_planter_100",
    }
    for category_id in categories.values():
        connection.execute(
            text(
                "UPDATE fair_stand_items SET catalog_item_index = NULL, catalog_visible = false "
                "WHERE category_id = :c"
            ),
            {"c": category_id},
        )
    for name, order in _PRE_0086.items():
        for index, item_key in enumerate(order, start=1):
            preview = previews.get(family_card.get(item_key, item_key))
            connection.execute(
                text(
                    "UPDATE fair_stand_items SET category_id = :c, catalog_item_index = :i, catalog_visible = true, "
                    "preview_id = COALESCE(:p, preview_id) WHERE item_key = :k"
                ),
                {"c": categories[name], "i": index, "p": preview, "k": item_key},
            )
    connection.execute(
        text("UPDATE fair_stand_items SET variant = NULL WHERE item_key IN :keys").bindparams(
            bindparam("keys", expanding=True)
        ),
        {"keys": list(_VARIANTS)},
    )


def _assert_final_state(connection, categories):
    variants = _variants(connection)
    assert {key: variants.get(key) for key in _VARIANTS} == _VARIANTS
    for name, order in _POST_0086.items():
        assert _visible_order(connection, categories[name]) == order, name
        assert _indexes(connection, categories[name]) == list(range(1, len(order) + 1)), name
    hidden = connection.execute(
        text(
            "SELECT count(*) FROM fair_stand_items WHERE item_key IN :keys "
            "AND (catalog_visible OR category_id IS NOT NULL OR catalog_item_index IS NOT NULL "
            "OR preview_id IS NOT NULL)"
        ).bindparams(bindparam("keys", expanding=True)),
        {"keys": [key for key in _VARIANTS if key not in _CARDS]},
    ).scalar_one()
    assert hidden == 0
    # Item'lar silinmez; sahnede çizilir (varyant Özellikler panelinde seçilir).
    for item_key in _VARIANTS:
        row = connection.execute(
            text("SELECT is_render FROM fair_stand_items WHERE item_key = :k"), {"k": item_key}
        ).one()
        assert bool(row[0]) is True, item_key


def test_variant_families_become_one_card_each(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    connection = db_session.connection()
    categories = _categories(connection)
    _pre_0086_catalog(connection, categories)
    before = connection.execute(text("SELECT count(*) FROM fair_stand_items")).scalar_one()

    migration = _migration()
    _run(connection, migration.upgrade)
    _run(connection, migration.upgrade)

    assert connection.execute(text("SELECT count(*) FROM fair_stand_items")).scalar_one() == before
    _assert_final_state(connection, categories)

    _run(connection, migration.downgrade)
    for name, order in _PRE_0086.items():
        assert _visible_order(connection, categories[name]) == order, name
    variants = _variants(connection)
    assert all(variants.get(key) is None for key in _VARIANTS)


def test_seed_already_matches_post_0086_catalog(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    connection = db_session.connection()
    categories = _categories(connection)

    _assert_final_state(connection, categories)
    _run(connection, _migration().upgrade)
    _assert_final_state(connection, categories)
