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

# 0093 (kullanıcı kararı 2026-11-09): katalogda görünmeyen bu Item'lar da Maksima'dır (kart
# varyantları, gövde parçaları, profil/dikme boyları, bağlantılar). Listede olmayan gizli
# Item'lar (zemin, TV, üretim kalemi vb.) null kalır.
HIDDEN_MAXIMA_ITEM_KEYS = (
    "base_150",
    "base_200",
    "base_top_107_50",
    "base_top_157_50",
    "base_top_206_50",
    "connector_corner",
    "connector_double",
    "connector_single",
    "connector_start",
    "counter_top_102_60",
    "counter_top_110_60",
    "counter_top_150_60",
    "counter_top_160_60",
    "counter_top_210_60",
    "counter_top_52_60",
    "desk_banko_150",
    "desk_banko_150_l",
    "desk_banko_200",
    "desk_banko_200_l",
    "panel_147_5",
    "panel_197",
    "panel_48_5",
    "panel_98",
    "panel_cam_147_5",
    "panel_cam_197",
    "panel_cam_48_5",
    "panel_cam_98",
    "panel_corner_142_5",
    "panel_corner_192",
    "panel_corner_42_5",
    "panel_corner_92",
    "panel_corner_cam_142_5",
    "panel_corner_cam_192",
    "panel_corner_cam_42_5",
    "panel_corner_cam_92",
    "profile_140_5",
    "profile_190",
    "profile_239_5",
    "profile_346_5",
    "profile_388",
    "profile_41_5",
    "profile_437_5",
    "profile_487",
    "profile_8",
    "profile_91",
    "separator_panel_48_5",
    "separator_panel_98",
    "shelf_100",
    "shelf_100_self",
    "shelf_150",
    "shelf_150_self",
    "shelf_200",
    "shelf_200_self",
    "shelf_leg",
    "shelf_row_2",
    "shelf_row_2_100",
    "shelf_row_2_150",
    "shelf_row_2_200",
    "shelf_row_3",
    "shelf_row_3_100",
    "shelf_row_3_150",
    "shelf_row_3_200",
    "showcase_2_body",
    "showcase_horizontal_87_4_30",
    "showcase_side_143_5_30",
    "showcase_side_94_6_30",
    "upright_247_5",
    "upright_297",
    "upright_396",
    "upright_445_5",
    "upright_495",
    "upright_49_5",
    "upright_99",
    "wall_150_350",
    "wall_150_short_1",
    "wall_150_short_2",
    "wall_200_350",
    "wall_200_short_1",
    "wall_200_short_2",
    "wall_50_350",
    "wall_50_short_1",
    "wall_50_short_2",
    "wall_separator_100_350_sarmasik",
    "wall_separator_50_350",
    "wall_separator_50_350_sarmasik",
    "wall_showcase_100_2_350",
)


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
    hidden_keys = session.scalars(
        select(FairStandItemModel.item_key).where(FairStandItemModel.item_key.in_(HIDDEN_MAXIMA_ITEM_KEYS))
    ).all()
    for item_key in [*keys, *hidden_keys]:
        if item_key not in linked:
            linked.add(item_key)
            session.add(FairStandItemBoothTypeModel(item_key=item_key, booth_type_key=DEFAULT_BOOTH_TYPE_KEY))
    session.flush()
