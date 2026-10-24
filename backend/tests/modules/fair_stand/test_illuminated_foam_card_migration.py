"""0084: Işıklı Strafor katalog kartı ve görsel kabulü (logo panelden seçilir)."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import text

from app.modules.fair_stand.infrastructure.seed_catalog import seed_fair_stand_catalog


def _migration():
    path = Path(__file__).resolve().parents[3] / "alembic/versions/0084_illuminated_foam_card.py"
    spec = spec_from_file_location("illuminated_foam_card_migration", path)
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _run(connection, step):
    with Operations.context(MigrationContext.configure(connection)):
        step()


def _foam(connection):
    return connection.execute(
        text(
            "SELECT catalog_visible, category_id, catalog_item_index, preview_id, accepts_image "
            "FROM fair_stand_items WHERE item_key = 'illuminated-foam'"
        )
    ).one()


def _category(connection):
    return connection.execute(
        text("SELECT category_id FROM fair_stand_items WHERE item_key = 'led_floodlight'")
    ).scalar_one()


def _visible_order(connection, category_id):
    return connection.execute(
        text(
            "SELECT item_key, catalog_item_index FROM fair_stand_items "
            "WHERE category_id = :c AND catalog_visible ORDER BY catalog_item_index"
        ),
        {"c": category_id},
    ).all()


def _assert_card(connection):
    category = _category(connection)
    visible, category_id, _index, preview_id, accepts_image = _foam(connection)
    assert bool(visible) is True
    assert category_id == category
    assert preview_id is not None
    assert bool(accepts_image) is True
    order = _visible_order(connection, category)
    assert order[-1][0] == "illuminated-foam"
    assert [index for _key, index in order] == list(range(1, len(order) + 1))


def _pre_0084(connection):
    connection.execute(
        text(
            "UPDATE fair_stand_items SET catalog_visible = false, category_id = NULL, catalog_item_index = NULL, "
            "preview_id = NULL, accepts_image = false WHERE item_key = 'illuminated-foam'"
        )
    )


def test_illuminated_foam_becomes_catalog_card_with_image(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    connection = db_session.connection()
    _pre_0084(connection)
    before = connection.execute(text("SELECT count(*) FROM fair_stand_items")).scalar_one()
    category = _category(connection)
    order_before = [key for key, _index in _visible_order(connection, category)]

    migration = _migration()
    _run(connection, migration.upgrade)
    _run(connection, migration.upgrade)

    assert connection.execute(text("SELECT count(*) FROM fair_stand_items")).scalar_one() == before
    _assert_card(connection)
    assert [key for key, _index in _visible_order(connection, category)] == [*order_before, "illuminated-foam"]

    _run(connection, migration.downgrade)
    visible, category_id, index, preview_id, accepts_image = _foam(connection)
    assert (bool(visible), category_id, index, preview_id, bool(accepts_image)) == (False, None, None, None, False)
    assert [key for key, _index in _visible_order(connection, category)] == order_before


def test_seed_already_matches_post_0084_catalog(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    connection = db_session.connection()

    _assert_card(connection)
    _run(connection, _migration().upgrade)
    _assert_card(connection)
