from sqlalchemy import inspect, select

from app.modules.fair_stand.application.cycle_validation import CyclicItemCompositionError, assert_acyclic_components
from app.modules.fair_stand.infrastructure.catalog_seed_data import CATALOG_SEED
from app.modules.fair_stand.infrastructure.models import FairStandCategoryModel, FairStandItemComponentModel, FairStandItemModel, FairStandItemWidthVariantModel
from app.modules.fair_stand.infrastructure.seed_catalog import seed_fair_stand_catalog


def test_seed_is_idempotent_and_matches_canonical_counts(db_session):
    seed_fair_stand_catalog(db_session)
    seed_fair_stand_catalog(db_session)
    db_session.flush()

    items = db_session.scalars(select(FairStandItemModel)).all()
    categories = db_session.scalars(select(FairStandCategoryModel)).all()
    components = db_session.scalars(select(FairStandItemComponentModel)).all()
    visible = [item for item in items if item.catalog_visible]

    assert len(categories) == 6
    assert len(items) == 136  # 0081: +1 profile_346_5; 0080: +1 profile_8; 0078: +4 profil; 0075: +1; 0072: +3 raf tahtası, +3 kart, +6 sıralı raf; 0074: +2
    assert len(visible) == 54  # 0079: 6 kısa panel gizlendi; 0078: 4 profil gizlendi, profile_289 kartı; 0075: bar masası; 0072: 3 tekli raf gizlendi, 3 kart göründü; 0074: vitrin + broşürlük
    assert len(components) == 199  # 0072: tekli raf reçetesi 6 + tahta ayakları 3 + sıralı raf 6
    width_variants = db_session.scalars(select(FairStandItemWidthVariantModel)).all()
    assert sorted((row.family_item_key, row.item_key) for row in width_variants) == [
        ("shelf_row_1", "shelf_100"), ("shelf_row_1", "shelf_150"), ("shelf_row_1", "shelf_200"),
        ("shelf_row_2", "shelf_row_2_100"), ("shelf_row_2", "shelf_row_2_150"), ("shelf_row_2", "shelf_row_2_200"),
        ("shelf_row_3", "shelf_row_3_100"), ("shelf_row_3", "shelf_row_3_150"), ("shelf_row_3", "shelf_row_3_200"),
    ]
    assert {item.item_key for item in items} == {row["item_key"] for row in CATALOG_SEED["items"]}
    assert {category.catalog_name for category in categories} == {
        row["catalog_name"] for row in CATALOG_SEED["categories"]
    }
    assert "catalog_key" not in FairStandCategoryModel.__table__.c
    assert "catalog_key" not in FairStandItemModel.__table__.c
    assert "category_id" in FairStandItemModel.__table__.c
    assert all(isinstance(category.id, int) for category in categories)
    assert {item.category_id for item in visible}.issubset({category.id for category in categories})
    assert None not in {item.category_id for item in visible}


def test_cycle_validation_rejects_loop():
    try:
        assert_acyclic_components([("A", "B"), ("B", "A")])
    except CyclicItemCompositionError as exc:
        assert "A" in str(exc)
    else:
        raise AssertionError("expected cycle")


def test_self_component_rejected_by_seed_graph():
    assert_acyclic_components([("A", "B"), ("B", "C")])
