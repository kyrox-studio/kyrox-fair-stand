from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.modules.fair_stand.application.item_mapper import (
    CatalogCategory,
    CatalogPreview,
    ItemAggregate,
    RuntimeSettings,
    StandDimensions,
    map_category,
    map_item,
    map_preview,
    map_runtime_settings,
    map_stand_dimensions,
)
from app.modules.fair_stand.infrastructure.models import (
    FairStandCatalogPreviewKindModel,
    FairStandCategoryModel,
    FairStandDimensionsModel,
    FairStandItemModel,
    FairStandItemTypeModel,
    FairStandRuleModel,
    FairStandRuleTypeModel,
    FairStandSettingsModel,
    FairStandUnitModel,
)


class SqlAlchemyFairStandCatalogRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def _item_query(self):
        return select(FairStandItemModel).options(
            selectinload(FairStandItemModel.dimensions),
            selectinload(FairStandItemModel.scene_dimensions),
            selectinload(FairStandItemModel.strip_occupancy),
            selectinload(FairStandItemModel.assets),
            selectinload(FairStandItemModel.components),
            selectinload(FairStandItemModel.width_variants),
            selectinload(FairStandItemModel.length_parts),
            selectinload(FairStandItemModel.assembly_parts),
            selectinload(FairStandItemModel.video_wall),
            selectinload(FairStandItemModel.body_parts),
            selectinload(FairStandItemModel.item_type_row),
            selectinload(FairStandItemModel.snap_requires_rule),
            selectinload(FairStandItemModel.snap_provides_rule),
        )

    def list_unit_labels(self) -> list[tuple[str, str]]:
        rows = self._session.scalars(
            select(FairStandUnitModel).order_by(FairStandUnitModel.unit_key, FairStandUnitModel.id)
        ).all()
        return [(row.unit_key, row.name) for row in rows]

    def list_active_categories(self) -> list[CatalogCategory]:
        rows = self._session.scalars(
            select(FairStandCategoryModel)
            .where(FairStandCategoryModel.is_active.is_(True))
            .order_by(FairStandCategoryModel.catalog_index)
        ).all()
        return [map_category(row) for row in rows]

    def list_items(self, *, active_only: bool = True) -> list[ItemAggregate]:
        stmt = self._item_query()
        if active_only:
            stmt = stmt.where(FairStandItemModel.is_active.is_(True))
        stmt = stmt.order_by(FairStandItemModel.item_key)
        return [map_item(row) for row in self._session.scalars(stmt).all()]

    def get_item(self, item_key: str, *, active_only: bool = True) -> ItemAggregate | None:
        stmt = self._item_query().where(FairStandItemModel.item_key == item_key)
        if active_only:
            stmt = stmt.where(FairStandItemModel.is_active.is_(True))
        row = self._session.scalar(stmt)
        return map_item(row) if row is not None else None

    def list_categories(self, *, active_only: bool = False) -> list[FairStandCategoryModel]:
        stmt = select(FairStandCategoryModel).order_by(FairStandCategoryModel.catalog_index)
        if active_only:
            stmt = stmt.where(FairStandCategoryModel.is_active.is_(True))
        return list(self._session.scalars(stmt).all())

    def get_category(self, category_id: int) -> FairStandCategoryModel | None:
        return self._session.get(FairStandCategoryModel, int(category_id))

    def get_category_by_index(self, catalog_index: int) -> FairStandCategoryModel | None:
        return self._session.scalar(
            select(FairStandCategoryModel).where(FairStandCategoryModel.catalog_index == catalog_index)
        )

    def list_previews(self, *, active_only: bool = False) -> list[FairStandCatalogPreviewKindModel]:
        stmt = select(FairStandCatalogPreviewKindModel).order_by(
            FairStandCatalogPreviewKindModel.sort_index,
            FairStandCatalogPreviewKindModel.id,
        )
        if active_only:
            stmt = stmt.where(FairStandCatalogPreviewKindModel.is_active.is_(True))
        return list(self._session.scalars(stmt).all())

    def list_preview_payloads(self, *, active_only: bool = False) -> list[CatalogPreview]:
        return [map_preview(row) for row in self.list_previews(active_only=active_only)]

    def get_preview(self, preview_id: int) -> FairStandCatalogPreviewKindModel | None:
        return self._session.get(FairStandCatalogPreviewKindModel, int(preview_id))

    def get_stand_dimensions(self) -> StandDimensions | None:
        row = self._session.get(FairStandDimensionsModel, 1)
        return map_stand_dimensions(row) if row is not None else None

    def get_runtime_settings(self) -> RuntimeSettings | None:
        row = self._session.get(FairStandSettingsModel, 1)
        return map_runtime_settings(row) if row is not None else None

    def list_item_catalog_rows(self) -> list[FairStandItemModel]:
        return list(
            self._session.scalars(
                select(FairStandItemModel).order_by(FairStandItemModel.item_key)
            ).all()
        )

    def get_item_row(self, item_key: str) -> FairStandItemModel | None:
        return self._session.get(FairStandItemModel, item_key)

    def count_items_for_category(self, category_id: int) -> int:
        rows = self._session.scalars(
            select(FairStandItemModel).where(FairStandItemModel.category_id == int(category_id))
        ).all()
        return len(rows)

    def count_items_for_preview(self, preview_id: int) -> int:
        rows = self._session.scalars(
            select(FairStandItemModel).where(FairStandItemModel.preview_id == int(preview_id))
        ).all()
        return len(rows)

    def list_item_types(self, *, active_only: bool = False) -> list[FairStandItemTypeModel]:
        stmt = (
            select(FairStandItemTypeModel)
            .options(
                selectinload(FairStandItemTypeModel.overlap_types),
                selectinload(FairStandItemTypeModel.scene_behavior),
            )
            .order_by(FairStandItemTypeModel.display_name)
        )
        if active_only:
            stmt = stmt.where(FairStandItemTypeModel.is_active.is_(True))
        return list(self._session.scalars(stmt).all())

    def list_rule_types(self, *, active_only: bool = False) -> list[FairStandRuleTypeModel]:
        stmt = select(FairStandRuleTypeModel).order_by(FairStandRuleTypeModel.display_name)
        if active_only:
            stmt = stmt.where(FairStandRuleTypeModel.is_active.is_(True))
        return list(self._session.scalars(stmt).all())

    def list_rules(self, *, active_only: bool = False) -> list[FairStandRuleModel]:
        stmt = (
            select(FairStandRuleModel)
            .options(
                selectinload(FairStandRuleModel.rule_type),
                selectinload(FairStandRuleModel.item_types),
            )
            .order_by(FairStandRuleModel.display_name)
        )
        if active_only:
            stmt = stmt.where(FairStandRuleModel.is_active.is_(True))
        return list(self._session.scalars(stmt).all())
