"""0091 stand tipleri ve ilk Item eşlemesi. Migration ile seed aynı kuralı kullanır."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.fair_stand.infrastructure.models import (
    FairStandBoothTypeModel,
    FairStandCategoryModel,
    FairStandItemBoothTypeModel,
    FairStandItemModel,
)

DEFAULT_BOOTH_TYPE_KEY = "maxima"

BOOTH_TYPE_ROWS = (
    {"booth_type_key": "maxima", "name": "Maksima Stand", "is_active": True, "sort_index": 1},
    {"booth_type_key": "custom", "name": "Özel Tasarım", "is_active": False, "sort_index": 2},
    {"booth_type_key": "package", "name": "Paket Stand", "is_active": False, "sort_index": 3},
)

# Bu kategorilerdeki Item'lar null kalır: bütün stand tiplerinde görünür. Katalogda görünen
# diğerleri Maksima olur; katalogda görünmeyen Item'lar etiketlenmez.
ALL_BOOTH_TYPES_CATEGORY_NAMES = ("Extra", "Elektronik & Aydınlatma")


def ensure_booth_types(session: Session) -> None:
    existing = set(session.scalars(select(FairStandBoothTypeModel.booth_type_key)).all())
    for row in BOOTH_TYPE_ROWS:
        if row["booth_type_key"] not in existing:
            session.add(FairStandBoothTypeModel(**row))
    session.flush()
    linked = set(session.scalars(select(FairStandItemBoothTypeModel.item_key)).all())
    keys = session.scalars(
        select(FairStandItemModel.item_key)
        .join(FairStandCategoryModel, FairStandItemModel.category_id == FairStandCategoryModel.id)
        .where(
            FairStandItemModel.catalog_visible.is_(True),
            FairStandCategoryModel.catalog_name.not_in(ALL_BOOTH_TYPES_CATEGORY_NAMES),
        )
    ).all()
    for item_key in keys:
        if item_key not in linked:
            session.add(FairStandItemBoothTypeModel(item_key=item_key, booth_type_key=DEFAULT_BOOTH_TYPE_KEY))
    session.flush()
