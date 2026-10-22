from __future__ import annotations

import re
import unicodedata
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from uuid import uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.modules.fair_stand.application.catalog_item_order import (
    CatalogItemOrderError,
    apply_catalog_item_order,
    next_append_catalog_index,
)
from app.modules.fair_stand.infrastructure.models import (
    FairStandItemAssemblyPartModel,
    FairStandItemAssetModel,
    FairStandItemBodyPartModel,
    FairStandItemComponentModel,
    FairStandItemDimensionsModel,
    FairStandItemModel,
    FairStandItemSceneDimensionsModel,
    FairStandItemStripOccupancyModel,
    FairStandItemTypeModel,
    FairStandItemVideoWallModel,
    FairStandItemWidthVariantModel,
    FairStandRuleModel,
    FairStandUnitModel,
)

_ITEM_LIST_SORT_FIELDS: dict[str, object] = {
    "itemKey": FairStandItemModel.item_key,
    "name": FairStandItemModel.name,
    "type": FairStandItemModel.item_type,
    "catalogVisible": FairStandItemModel.catalog_visible,
    "isRender": FairStandItemModel.is_render,
    "isCostEnabled": FairStandItemModel.is_cost_enabled,
    "status": FairStandItemModel.is_active,
    "isActive": FairStandItemModel.is_active,
}


class ItemAdminError(ValueError):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


def _now() -> datetime:
    return datetime.now(tz=UTC)


def _normalize_item_key(value: object | None, *, max_length: int = 128) -> str:
    """Display/name-ish input → lowercase snake item_key (ascii)."""
    text = unicodedata.normalize("NFKD", str(value or "").strip())
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.replace("ı", "i").replace("İ", "i")
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    text = text.strip("_")
    return text[:max_length]


def _num(value: Decimal | float | int | None) -> float | int | None:
    if value is None:
        return None
    number = float(value)
    return int(number) if number.is_integer() else number


def _optional_decimal(value: object | None) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ItemAdminError("Sayısal alan geçerli bir sayı olmalıdır.") from exc


def _optional_bool(value: object | None) -> bool | None:
    if value is None:
        return None
    return bool(value)


_Z_REFERENCES = ("floor", "wall-top")


def _z_reference(value: object | None) -> str:
    text = _optional_str(value) or "floor"
    if text not in _Z_REFERENCES:
        raise ItemAdminError(f"z_reference yalnız {', '.join(_Z_REFERENCES)} olabilir.", status_code=422)
    return text


def _optional_str(value: object | None) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _optional_int(value: object | None) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise ItemAdminError("Geçersiz sayısal değer.") from exc


def _require_known_unit(session: Session, unit: str | None) -> str | None:
    """Existence only. Inactive catalog rows stay assignable; this is not an activity rule."""
    if unit is None:
        return None
    if len(unit) > 64:
        raise ItemAdminError("Ölçü birimi en fazla 64 karakter olabilir.")
    found = session.scalar(select(FairStandUnitModel.unit_key).where(FairStandUnitModel.unit_key == unit))
    if found is None:
        raise ItemAdminError("Ölçü birimi katalogda yok.", status_code=400)
    return unit


def _require_item_type(session: Session, item_type: str) -> str:
    key = str(item_type or "").strip()
    if not key:
        raise ItemAdminError("Item tipi zorunludur.")
    row = session.scalar(
        select(FairStandItemTypeModel).where(FairStandItemTypeModel.key == key)
    )
    if row is None:
        raise ItemAdminError("Item tipi katalogda yok. Önce item type ekleyin.", status_code=404)
    if not row.is_active:
        raise ItemAdminError("Item tipi pasif.")
    return key


def _require_catalog_visibility_fields(
    *,
    catalog_visible: bool,
    category_id: object | None,
    catalog_item_index: object | None,
    preview_id: object | None,
) -> None:
    """catalog_visible=true ⇒ triad required. Hidden leaves stale category/preview alone."""
    if not catalog_visible:
        return
    if category_id is None or catalog_item_index is None or preview_id is None:
        raise ItemAdminError(
            "Katalogda görünür itemlerde kategori, katalog sırası ve önizleme zorunludur."
        )


def _parse_snap_selection(session: Session, payload: dict) -> dict:
    """Item selects requires XOR provides rule id. Face/edge live on rules."""
    requires_id = (
        _optional_int(payload.get("snap_requires_rule_id"))
        if "snap_requires_rule_id" in payload
        else None
    )
    provides_id = (
        _optional_int(payload.get("snap_provides_rule_id"))
        if "snap_provides_rule_id" in payload
        else None
    )
    has_requires = "snap_requires_rule_id" in payload
    has_provides = "snap_provides_rule_id" in payload

    out: dict = {
        "snap_target_item_type": None,
        "snap_anchor": None,
    }
    if has_requires or has_provides:
        if requires_id is not None and provides_id is not None:
            raise ItemAdminError("Bir item aynı anda requires ve provides kuralı taşıyamaz.")
        if requires_id is not None and session.get(FairStandRuleModel, requires_id) is None:
            raise ItemAdminError("Requires kuralı bulunamadı.", status_code=404)
        if provides_id is not None:
            rule = session.get(FairStandRuleModel, provides_id)
            if rule is None:
                raise ItemAdminError("Provides kuralı bulunamadı.", status_code=404)
            if not rule.face or not rule.edge:
                raise ItemAdminError("Provides kuralında face/edge tanımlı olmalıdır.")
        if has_requires:
            out["snap_requires_rule_id"] = requires_id
        if has_provides:
            out["snap_provides_rule_id"] = provides_id
    return out


def _integrity_error_message(exc: IntegrityError) -> str:
    orig = str(getattr(exc, "orig", exc)).lower()
    if "uq_fair_stand_item_assembly_instance" in orig:
        return "Aynı child + instance_index montajda birden fazla olamaz."
    if "uq_fair_stand_item_assets_role" in orig:
        return "Aynı asset rolü bir item altında birden fazla kullanılamaz."
    if "uq_fair_stand_items_catalog_order" in orig:
        return "Bu kategori içinde aynı katalog sırası zaten kullanılıyor."
    if "fair_stand_items_pkey" in orig or (
        "fair_stand_items" in orig
        and "item_key" in orig
        and ("already exists" in orig or "duplicate" in orig)
    ):
        return "Bu item key zaten kayıtlı."
    if "uq_fair_stand_item_body_parts_role" in orig or "fair_stand_item_body_parts_pkey" in orig or (
        "body_role" in orig and ("already exists" in orig or "duplicate" in orig)
    ):
        return "Aynı body role bir item altında birden fazla kullanılamaz."
    if "fk_fair_stand_items_unit_key" in orig:
        return "Ölçü birimi katalogda yok."
    if "foreign key" in orig or "fk_" in orig:
        return "Bağlantılı kayıt bulunamadı (alt item, kategori veya preview geçersiz olabilir)."
    if "ck_fair_stand_items_catalog_visible" in orig:
        return "Katalogda görünür itemlerde kategori, katalog sırası ve önizleme zorunludur."
    if "ck_fair_stand" in orig or "check constraint" in orig:
        return "Girilen değerlerden biri geçersiz."
    return "Kayıt kaydedilemedi: veri kısıtı ihlal edildi."


def _item_load_options():
    return (
        selectinload(FairStandItemModel.dimensions),
        selectinload(FairStandItemModel.scene_dimensions),
        selectinload(FairStandItemModel.strip_occupancy),
        selectinload(FairStandItemModel.assets),
        selectinload(FairStandItemModel.components),
        selectinload(FairStandItemModel.width_variants),
        selectinload(FairStandItemModel.assembly_parts),
        selectinload(FairStandItemModel.video_wall),
        selectinload(FairStandItemModel.body_parts),
        selectinload(FairStandItemModel.item_type_row),
        selectinload(FairStandItemModel.snap_requires_rule),
        selectinload(FairStandItemModel.snap_provides_rule),
    )


def _dimensions_payload(row: FairStandItemDimensionsModel | None) -> dict | None:
    if row is None:
        return None
    return {
        "widthCm": _num(row.width_cm),
        "depthCm": _num(row.depth_cm),
        "heightCm": _num(row.height_cm),
        "mountHeightCm": _num(row.mount_height_cm),
        "wallGapCm": _num(row.wall_gap_cm),
    }


def _scene_dimensions_payload(row: FairStandItemSceneDimensionsModel | None) -> dict | None:
    if row is None:
        return None
    return {
        "widthCm": _num(row.width_cm),
        "depthCm": _num(row.depth_cm),
        "heightCm": _num(row.height_cm),
    }


def _strip_payload(row: FairStandItemStripOccupancyModel | None) -> dict | None:
    if row is None:
        return None
    return {"align": row.align, "stripCount": int(row.strip_count)}


def _assets_payload(rows: list[FairStandItemAssetModel]) -> list[dict]:
    return [
        {
            "id": str(row.id),
            "assetRole": row.asset_role,
            "relativePath": row.relative_path,
            "isActive": bool(row.is_active),
        }
        for row in sorted(rows, key=lambda item: (item.asset_role, item.relative_path))
    ]


def _components_payload(rows: list[FairStandItemComponentModel]) -> list[dict]:
    return [
        {
            "id": str(row.id),
            "childItemKey": row.child_item_key,
            "childName": None,
            "childType": None,
            "quantity": _num(row.quantity),
            "perBand": _num(row.per_band) if row.per_band is not None else 0,
            "heightMatched": bool(row.height_matched),
        }
        for row in sorted(rows, key=lambda item: item.child_item_key)
    ]


def _assembly_parts_payload(rows: list[FairStandItemAssemblyPartModel]) -> list[dict]:
    return [
        {
            "id": str(row.id),
            "childItemKey": row.child_item_key,
            "instanceIndex": int(row.instance_index),
            "xCm": _num(row.x_cm),
            "yCm": _num(row.y_cm),
            "zCm": _num(row.z_cm),
            "rotationXDeg": _num(row.rotation_x_deg),
            "rotationYDeg": _num(row.rotation_y_deg),
            "rotationZDeg": _num(row.rotation_z_deg),
            "lockGroupId": int(row.lock_group_id) if row.lock_group_id is not None else None,
        }
        for row in sorted(
            rows,
            key=lambda item: (item.child_item_key, int(item.instance_index)),
        )
    ]


def _body_parts_payload(rows: list[FairStandItemBodyPartModel]) -> list[dict]:
    return [
        {
            "id": str(row.id),
            "bodyRole": row.body_role,
            "childItemKey": row.child_item_key,
            "childName": None,
            "childType": None,
        }
        for row in sorted(rows, key=lambda item: item.body_role)
    ]


def _video_wall_payload(row: FairStandItemVideoWallModel | None) -> dict | None:
    if row is None:
        return None
    return {
        "rows": int(row.rows),
        "cols": int(row.cols),
        "panelItemKey": row.panel_item_key,
    }


def _item_admin_payload(row: FairStandItemModel) -> dict:
    return {
        "itemKey": row.item_key,
        "name": row.name,
        "type": row.item_type,
        "unit": row.unit,
        "isActive": bool(row.is_active),
        "catalogVisible": bool(row.catalog_visible),
        "categoryId": int(row.category_id) if row.category_id is not None else None,
        "catalogItemIndex": row.catalog_item_index,
        "previewId": int(row.preview_id) if row.preview_id is not None else None,
        "material": row.material,
        "defaultColor": int(row.default_color) if row.default_color is not None else None,
        "defaultOpacity": _num(row.default_opacity) if row.default_opacity is not None else 1,
        "preserveModelScale": row.preserve_model_scale,
        "modelRotationYDeg": _num(row.model_rotation_y_deg),
        "visualRotationYDeg": _num(row.visual_rotation_y_deg),
        "rotationStepDeg": _num(row.rotation_step_deg),
        "defaultRotationDeg": _num(row.default_rotation_deg),
        "sideInsertRotation": row.side_insert_rotation,
        "compositionMode": row.composition_mode,
        "paintable": row.paintable,
        "shape": row.shape,
        "variant": row.variant,
        "eyeCount": int(row.eye_count) if row.eye_count is not None else None,
        "defaultZCm": _num(row.default_z_cm) if row.default_z_cm is not None else 0,
        "zReference": row.z_reference or "floor",
        "verticalMove": bool(row.vertical_move),
        "snapTargetItemType": row.snap_target_item_type,
        "snapAnchor": row.snap_anchor,
        "snapRequiresRuleId": int(row.snap_requires_rule_id) if row.snap_requires_rule_id is not None else None,
        "snapProvidesRuleId": int(row.snap_provides_rule_id) if row.snap_provides_rule_id is not None else None,
        "snapRequires": row.snap_requires_rule.key if row.snap_requires_rule is not None else None,
        "snapProvides": row.snap_provides_rule.key if row.snap_provides_rule is not None else None,
        "isRender": bool(row.is_render),
        "acceptsColor": bool(row.accepts_color),
        "acceptsImage": bool(row.accepts_image),
        "acceptsLightbox": bool(row.accepts_lightbox),
        "acceptsGlass": bool(row.accepts_glass),
        "acceptsMesh": bool(row.accepts_mesh),
        "isCostEnabled": bool(row.is_cost_enabled),
        "dimensions": _dimensions_payload(row.dimensions),
        "sceneDimensions": _scene_dimensions_payload(row.scene_dimensions),
        "stripOccupancy": _strip_payload(row.strip_occupancy),
        "assets": _assets_payload(list(row.assets or [])),
        "components": _components_payload(list(row.components or [])),
        "assemblyParts": _assembly_parts_payload(list(row.assembly_parts or [])),
        "bodyParts": _body_parts_payload(list(row.body_parts or [])),
        "videoWall": _video_wall_payload(row.video_wall),
    }


def _item_list_payload(row: FairStandItemModel) -> dict:
    return {
        "itemKey": row.item_key,
        "name": row.name,
        "type": row.item_type,
        "isActive": bool(row.is_active),
        "catalogVisible": bool(row.catalog_visible),
        "categoryId": int(row.category_id) if row.category_id is not None else None,
        "catalogItemIndex": row.catalog_item_index,
        "isRender": bool(row.is_render),
        "isCostEnabled": bool(row.is_cost_enabled),
        "componentCount": len(row.components or []),
        "assetCount": len(row.assets or []),
        "hasDimensions": row.dimensions is not None,
        "hasSceneDimensions": row.scene_dimensions is not None,
        "hasStripOccupancy": row.strip_occupancy is not None,
        "hasVideoWall": row.video_wall is not None,
        "bodyPartCount": len(row.body_parts or []),
    }


class AdminItemsService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_items(self) -> list[dict]:
        """Full list (legacy). Prefer list_item_records for admin UI."""
        rows = self._session.scalars(
            select(FairStandItemModel)
            .options(*_item_load_options())
            .order_by(FairStandItemModel.item_key)
        ).all()
        return [_item_list_payload(row) for row in rows]

    def list_item_records(
        self,
        *,
        page: int = 1,
        page_size: int = 25,
        search: str | None = None,
        sort_by: str | None = None,
        sort_order: str | None = None,
        status: str | None = None,
        catalog: str | None = None,
        render: str | None = None,
        item_type: str | None = None,
    ) -> dict:
        page = max(1, int(page))
        page_size = min(100, max(1, int(page_size)))
        search_text = (search or "").strip()
        status_filter = (status or "").strip().lower()
        catalog_filter = (catalog or "").strip().lower()
        render_filter = (render or "").strip().lower()
        type_filter = (item_type or "").strip()
        if status_filter in {"", "all"}:
            status_filter = ""
        if catalog_filter in {"", "all"}:
            catalog_filter = ""
        if render_filter in {"", "all"}:
            render_filter = ""
        if type_filter.lower() in {"", "all"}:
            type_filter = ""

        component_count = (
            select(func.count())
            .select_from(FairStandItemComponentModel)
            .where(FairStandItemComponentModel.parent_item_key == FairStandItemModel.item_key)
            .correlate(FairStandItemModel)
            .scalar_subquery()
        )
        asset_count = (
            select(func.count())
            .select_from(FairStandItemAssetModel)
            .where(FairStandItemAssetModel.item_key == FairStandItemModel.item_key)
            .correlate(FairStandItemModel)
            .scalar_subquery()
        )

        filters = []
        if search_text:
            like = f"%{search_text}%"
            filters.append(
                or_(
                    FairStandItemModel.item_key.ilike(like),
                    FairStandItemModel.name.ilike(like),
                    FairStandItemModel.item_type.ilike(like),
                )
            )
        if status_filter == "active":
            filters.append(FairStandItemModel.is_active.is_(True))
        elif status_filter == "inactive":
            filters.append(FairStandItemModel.is_active.is_(False))
        if catalog_filter == "visible":
            filters.append(FairStandItemModel.catalog_visible.is_(True))
        elif catalog_filter == "hidden":
            filters.append(FairStandItemModel.catalog_visible.is_(False))
        if render_filter in {"yes", "true", "1", "render"}:
            filters.append(FairStandItemModel.is_render.is_(True))
        elif render_filter in {"no", "false", "0"}:
            filters.append(FairStandItemModel.is_render.is_(False))
        if type_filter:
            filters.append(FairStandItemModel.item_type == type_filter)

        sort_field = sort_by if sort_by in _ITEM_LIST_SORT_FIELDS or sort_by in {
            "componentCount",
            "assetCount",
        } else "itemKey"
        direction = "desc" if (sort_order or "").lower() == "desc" else "asc"
        if sort_field == "componentCount":
            order_expr = component_count
        elif sort_field == "assetCount":
            order_expr = asset_count
        else:
            order_expr = _ITEM_LIST_SORT_FIELDS.get(sort_field, FairStandItemModel.item_key)
        order_clause = order_expr.desc() if direction == "desc" else order_expr.asc()

        count_stmt = select(func.count()).select_from(FairStandItemModel)
        if filters:
            count_stmt = count_stmt.where(*filters)
        total = int(self._session.scalar(count_stmt) or 0)
        total_pages = max(1, (total + page_size - 1) // page_size) if total else 0
        if total_pages and page > total_pages:
            page = total_pages

        list_stmt = select(FairStandItemModel).options(*_item_load_options())
        if filters:
            list_stmt = list_stmt.where(*filters)
        list_stmt = (
            list_stmt.order_by(order_clause, FairStandItemModel.item_key.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = self._session.scalars(list_stmt).all()

        item_types = list(
            self._session.scalars(
                select(FairStandItemModel.item_type)
                .distinct()
                .order_by(FairStandItemModel.item_type.asc())
            ).all()
        )

        return {
            "items": [_item_list_payload(row) for row in rows],
            "pagination": {
                "page": page,
                "pageSize": page_size,
                "totalItems": total,
                "totalPages": total_pages,
                "hasNext": total_pages > 0 and page < total_pages,
                "hasPrevious": page > 1,
            },
            "sorting": {"field": sort_field, "direction": direction},
            "filters": {
                "status": status_filter or "all",
                "catalog": catalog_filter or "all",
                "render": render_filter or "all",
                "type": type_filter or "all",
            },
            "filterOptions": {
                "types": item_types,
                **self._field_option_values(),
            },
        }

    def _field_option_values(self) -> dict[str, list[str]]:
        def distinct_values(column) -> list[str]:
            values = self._session.scalars(
                select(column)
                .where(column.is_not(None))
                .where(column != "")
                .distinct()
                .order_by(column.asc())
            ).all()
            return [str(value) for value in values if str(value).strip()]

        return {
            "units": [
                row.unit_key
                for row in self._session.scalars(
                    select(FairStandUnitModel)
                    .where(FairStandUnitModel.is_active.is_(True))
                    .order_by(FairStandUnitModel.unit_key.asc())
                ).all()
            ],
            "materials": distinct_values(FairStandItemModel.material),
            "shapes": distinct_values(FairStandItemModel.shape),
            "variants": distinct_values(FairStandItemModel.variant),
            "compositionModes": distinct_values(FairStandItemModel.composition_mode),
            "sideInsertRotations": distinct_values(FairStandItemModel.side_insert_rotation),
            "itemTypes": [
                {"id": int(row.id), "key": row.key, "displayName": row.display_name}
                for row in self._session.scalars(
                    select(FairStandItemTypeModel)
                    .where(FairStandItemTypeModel.is_active.is_(True))
                    .order_by(FairStandItemTypeModel.display_name)
                ).all()
            ],
            "snapRules": [
                {
                    "id": int(row.id),
                    "key": row.key,
                    "displayName": row.display_name,
                    "face": row.face,
                    "edge": row.edge,
                }
                for row in self._session.scalars(
                    select(FairStandRuleModel)
                    .where(FairStandRuleModel.is_active.is_(True))
                    .order_by(FairStandRuleModel.display_name)
                ).all()
            ],
        }

    def get_item(self, item_key: str) -> dict:
        row = self._get(item_key)
        return self._enrich_child_refs(_item_admin_payload(row))

    def _enrich_child_refs(self, payload: dict) -> dict:
        keys: set[str] = set()
        for component in payload.get("components") or []:
            key = component.get("childItemKey")
            if key:
                keys.add(str(key))
        for part in payload.get("bodyParts") or []:
            key = part.get("childItemKey")
            if key:
                keys.add(str(key))
        if not keys:
            return payload
        children = {
            child.item_key: child
            for child in self._session.scalars(
                select(FairStandItemModel).where(FairStandItemModel.item_key.in_(keys))
            ).all()
        }
        for component in payload.get("components") or []:
            child = children.get(str(component.get("childItemKey") or ""))
            component["childName"] = child.name if child is not None else None
            component["childType"] = child.item_type if child is not None else None
        for part in payload.get("bodyParts") or []:
            child = children.get(str(part.get("childItemKey") or ""))
            part["childName"] = child.name if child is not None else None
            part["childType"] = child.item_type if child is not None else None
        return payload

    def create_item(self, payload: dict) -> dict:
        raw_key = payload.get("item_key")
        if raw_key is None or not str(raw_key).strip():
            item_key = _normalize_item_key(payload.get("name"))
        else:
            item_key = _normalize_item_key(raw_key)
        name = str(payload.get("name") or "").strip()
        if not item_key:
            raise ItemAdminError("Item key zorunludur.")
        if not name:
            raise ItemAdminError("Ad zorunludur.")
        item_type = _require_item_type(self._session, str(payload.get("item_type") or ""))
        if self._session.get(FairStandItemModel, item_key) is not None:
            raise ItemAdminError("Bu item key zaten kayıtlı.", status_code=409)

        catalog_visible = bool(payload.get("catalog_visible", False))
        category_id = payload.get("category_id")
        catalog_item_index = payload.get("catalog_item_index")
        preview_id = payload.get("preview_id")
        _require_catalog_visibility_fields(
            catalog_visible=catalog_visible,
            category_id=category_id,
            catalog_item_index=catalog_item_index,
            preview_id=preview_id,
        )

        now = _now()
        row = FairStandItemModel(
            item_key=item_key,
            name=name,
            item_type=item_type,
            unit=_require_known_unit(self._session, _optional_str(payload.get("unit"))),
            catalog_visible=False,
            category_id=category_id,
            catalog_item_index=catalog_item_index,
            preview_id=preview_id,
            material=_optional_str(payload.get("material")),
            default_color=payload.get("default_color"),
            default_opacity=_optional_decimal(payload.get("default_opacity")) or Decimal("1"),
            preserve_model_scale=_optional_bool(payload.get("preserve_model_scale")),
            model_rotation_y_deg=_optional_decimal(payload.get("model_rotation_y_deg")),
            visual_rotation_y_deg=_optional_decimal(payload.get("visual_rotation_y_deg")),
            rotation_step_deg=_optional_decimal(payload.get("rotation_step_deg")),
            default_rotation_deg=_optional_decimal(payload.get("default_rotation_deg")),
            side_insert_rotation=_optional_str(payload.get("side_insert_rotation")),
            composition_mode=_optional_str(payload.get("composition_mode")),
            paintable=_optional_bool(payload.get("paintable")),
            shape=_optional_str(payload.get("shape")),
            variant=_optional_str(payload.get("variant")),
            eye_count=payload.get("eye_count"),
            default_z_cm=_optional_decimal(payload.get("default_z_cm")) or Decimal("0"),
            z_reference=_z_reference(payload.get("z_reference")),
            vertical_move=bool(payload.get("vertical_move", False)),
            **_parse_snap_selection(
                self._session,
                {
                    "snap_requires_rule_id": payload.get("snap_requires_rule_id"),
                    "snap_provides_rule_id": payload.get("snap_provides_rule_id"),
                },
            ),
            is_render=bool(payload.get("is_render", False)),
            accepts_color=bool(payload.get("accepts_color", False)),
            accepts_image=bool(payload.get("accepts_image", False)),
            accepts_lightbox=bool(payload.get("accepts_lightbox", False)),
            accepts_glass=bool(payload.get("accepts_glass", False)),
            accepts_mesh=bool(payload.get("accepts_mesh", False)),
            is_cost_enabled=bool(payload.get("is_cost_enabled", False)),
            is_active=bool(payload.get("is_active", True)),
            created_at=now,
            updated_at=now,
        )
        self._session.add(row)
        try:
            apply_catalog_item_order(
                self._session,
                row,
                catalog_visible=catalog_visible,
                category_id=int(category_id) if category_id is not None else None,
                catalog_item_index=int(catalog_item_index) if catalog_item_index is not None else None,
            )
        except CatalogItemOrderError as exc:
            raise ItemAdminError(str(exc), status_code=exc.status_code) from exc
        self._apply_satellites(row, payload, replace=True)
        self._flush()
        return self.get_item(item_key)

    def update_item(self, item_key: str, payload: dict) -> dict:
        row = self._get(item_key)
        if "name" in payload and payload["name"] is not None:
            name = str(payload["name"]).strip()
            if not name:
                raise ItemAdminError("Ad zorunludur.")
            row.name = name
        if "item_type" in payload and payload["item_type"] is not None:
            row.item_type = _require_item_type(self._session, str(payload["item_type"]))

        if "unit" in payload:
            row.unit = _require_known_unit(self._session, _optional_str(payload.get("unit")))

        scalar_map = {
            "material": _optional_str,
            "side_insert_rotation": _optional_str,
            "composition_mode": _optional_str,
            "shape": _optional_str,
            "variant": _optional_str,
        }
        for field, converter in scalar_map.items():
            if field in payload:
                setattr(row, field, converter(payload.get(field)))

        if any(
            key in payload
            for key in (
                "snap_requires_rule_id",
                "snap_provides_rule_id",
                "snap_target_item_type",
                "snap_anchor",
            )
        ):
            merged = {
                "snap_requires_rule_id": (
                    payload["snap_requires_rule_id"]
                    if "snap_requires_rule_id" in payload
                    else row.snap_requires_rule_id
                ),
                "snap_provides_rule_id": (
                    payload["snap_provides_rule_id"]
                    if "snap_provides_rule_id" in payload
                    else row.snap_provides_rule_id
                ),
            }
            for field, value in _parse_snap_selection(self._session, merged).items():
                setattr(row, field, value)

        next_catalog_visible = (
            bool(payload.get("catalog_visible"))
            if "catalog_visible" in payload
            else bool(row.catalog_visible)
        )
        next_category_id = payload["category_id"] if "category_id" in payload else row.category_id
        next_catalog_item_index = (
            payload["catalog_item_index"] if "catalog_item_index" in payload else row.catalog_item_index
        )
        next_preview_id = payload["preview_id"] if "preview_id" in payload else row.preview_id
        _require_catalog_visibility_fields(
            catalog_visible=next_catalog_visible,
            category_id=next_category_id,
            catalog_item_index=next_catalog_item_index,
            preview_id=next_preview_id,
        )
        catalog_touched = any(
            key in payload for key in ("catalog_visible", "category_id", "catalog_item_index")
        )
        if catalog_touched:
            try:
                apply_catalog_item_order(
                    self._session,
                    row,
                    catalog_visible=next_catalog_visible,
                    category_id=int(next_category_id) if next_category_id is not None else None,
                    catalog_item_index=(
                        int(next_catalog_item_index) if next_catalog_item_index is not None else None
                    ),
                )
            except CatalogItemOrderError as exc:
                raise ItemAdminError(str(exc), status_code=exc.status_code) from exc
        if "preview_id" in payload:
            row.preview_id = next_preview_id

        for field in (
            "default_color",
            "eye_count",
            "is_render",
            "accepts_color",
            "accepts_image",
            "accepts_lightbox",
            "accepts_glass",
            "accepts_mesh",
            "is_cost_enabled",
            "is_active",
            "vertical_move",
        ):
            if field in payload:
                setattr(row, field, payload.get(field))

        if "z_reference" in payload:
            row.z_reference = _z_reference(payload.get("z_reference"))

        if "default_opacity" in payload:
            row.default_opacity = _optional_decimal(payload.get("default_opacity")) or Decimal("1")

        for field, attr in (
            ("preserve_model_scale", "preserve_model_scale"),
            ("paintable", "paintable"),
        ):
            if field in payload:
                setattr(row, attr, _optional_bool(payload.get(field)))

        for field in (
            "model_rotation_y_deg",
            "visual_rotation_y_deg",
            "rotation_step_deg",
            "default_rotation_deg",
            "default_z_cm",
        ):
            if field in payload:
                value = _optional_decimal(payload.get(field))
                if field == "default_z_cm" and value is None:
                    value = Decimal("0")
                setattr(row, field, value)

        self._apply_satellites(row, payload, replace=True)
        row.updated_at = _now()
        self._flush()
        return self.get_item(item_key)

    def clone_item(self, source_item_key: str, payload: dict) -> dict:
        """Kaynak item + parent-owned satırları kopyala; yalnızca key/name değişir.

        BOM/assembly/body/video child pointer’ları shallow kalır (aynı child key + adet).
        Asset relative_path paylaşılır. Katalogda görünürse index = kategori son + 1.
        """
        source = self._get(source_item_key)
        raw_key = payload.get("item_key", payload.get("itemKey"))
        if raw_key is None or not str(raw_key).strip():
            raise ItemAdminError("Item key zorunludur.")
        item_key = _normalize_item_key(raw_key)
        name = str(payload.get("name") or "").strip()
        if not item_key:
            raise ItemAdminError("Item key zorunludur.")
        if not name:
            raise ItemAdminError("Ad zorunludur.")
        if item_key == source.item_key:
            raise ItemAdminError("Kopya item key kaynak ile aynı olamaz.")
        if self._session.get(FairStandItemModel, item_key) is not None:
            raise ItemAdminError("Bu item key zaten kayıtlı.", status_code=409)

        catalog_visible = bool(source.catalog_visible)
        category_id = int(source.category_id) if source.category_id is not None else None
        preview_id = int(source.preview_id) if source.preview_id is not None else None
        if catalog_visible:
            if category_id is None or preview_id is None:
                raise ItemAdminError(
                    "Kaynak katalogda görünür ama kategori/önizleme eksik; kopyalanamaz."
                )
            catalog_item_index = next_append_catalog_index(self._session, category_id)
        else:
            catalog_item_index = (
                int(source.catalog_item_index) if source.catalog_item_index is not None else None
            )

        now = _now()
        clone = FairStandItemModel(
            item_key=item_key,
            name=name,
            item_type=source.item_type,
            unit=source.unit,
            catalog_visible=False,
            category_id=category_id,
            catalog_item_index=catalog_item_index,
            preview_id=preview_id,
            material=source.material,
            default_color=source.default_color,
            default_opacity=source.default_opacity if source.default_opacity is not None else Decimal("1"),
            preserve_model_scale=source.preserve_model_scale,
            model_rotation_y_deg=source.model_rotation_y_deg,
            visual_rotation_y_deg=source.visual_rotation_y_deg,
            rotation_step_deg=source.rotation_step_deg,
            default_rotation_deg=source.default_rotation_deg,
            side_insert_rotation=source.side_insert_rotation,
            composition_mode=source.composition_mode,
            paintable=source.paintable,
            shape=source.shape,
            variant=source.variant,
            eye_count=source.eye_count,
            default_z_cm=source.default_z_cm if source.default_z_cm is not None else Decimal("0"),
            z_reference=source.z_reference or "floor",
            vertical_move=bool(source.vertical_move),
            snap_target_item_type=source.snap_target_item_type,
            snap_anchor=source.snap_anchor,
            snap_requires_rule_id=source.snap_requires_rule_id,
            snap_provides_rule_id=source.snap_provides_rule_id,
            is_render=bool(source.is_render),
            accepts_color=bool(source.accepts_color),
            accepts_image=bool(source.accepts_image),
            accepts_lightbox=bool(source.accepts_lightbox),
            accepts_glass=bool(source.accepts_glass),
            accepts_mesh=bool(source.accepts_mesh),
            is_cost_enabled=bool(source.is_cost_enabled),
            is_active=bool(source.is_active),
            created_at=now,
            updated_at=now,
        )
        self._session.add(clone)
        try:
            apply_catalog_item_order(
                self._session,
                clone,
                catalog_visible=catalog_visible,
                category_id=category_id,
                catalog_item_index=catalog_item_index,
            )
        except CatalogItemOrderError as exc:
            raise ItemAdminError(str(exc), status_code=exc.status_code) from exc

        self._clone_satellites(source, clone)
        self._flush()
        return self.get_item(item_key)

    def _clone_satellites(self, source: FairStandItemModel, clone: FairStandItemModel) -> None:
        if source.dimensions is not None:
            dims = source.dimensions
            clone.dimensions = FairStandItemDimensionsModel(
                item_key=clone.item_key,
                width_cm=dims.width_cm,
                depth_cm=dims.depth_cm,
                height_cm=dims.height_cm,
                mount_height_cm=dims.mount_height_cm,
                wall_gap_cm=dims.wall_gap_cm,
            )
        if source.scene_dimensions is not None:
            scene = source.scene_dimensions
            clone.scene_dimensions = FairStandItemSceneDimensionsModel(
                item_key=clone.item_key,
                width_cm=scene.width_cm,
                depth_cm=scene.depth_cm,
                height_cm=scene.height_cm,
            )
        if source.strip_occupancy is not None:
            strip = source.strip_occupancy
            clone.strip_occupancy = FairStandItemStripOccupancyModel(
                item_key=clone.item_key,
                align=strip.align,
                strip_count=strip.strip_count,
            )
        clone.assets = [
            FairStandItemAssetModel(
                id=uuid4(),
                item_key=clone.item_key,
                asset_role=asset.asset_role,
                relative_path=asset.relative_path,
                is_active=bool(asset.is_active),
            )
            for asset in list(source.assets or [])
        ]
        clone.components = [
            FairStandItemComponentModel(
                id=uuid4(),
                parent_item_key=clone.item_key,
                child_item_key=component.child_item_key,
                quantity=component.quantity,
                per_band=component.per_band,
                height_matched=component.height_matched,
            )
            for component in list(source.components or [])
        ]
        clone.width_variants = [
            FairStandItemWidthVariantModel(
                family_item_key=clone.item_key,
                item_key=variant.item_key,
            )
            for variant in list(source.width_variants or [])
        ]
        clone.assembly_parts = [
            FairStandItemAssemblyPartModel(
                id=uuid4(),
                parent_item_key=clone.item_key,
                child_item_key=part.child_item_key,
                instance_index=int(part.instance_index),
                x_cm=part.x_cm,
                y_cm=part.y_cm,
                z_cm=part.z_cm,
                rotation_x_deg=part.rotation_x_deg,
                rotation_y_deg=part.rotation_y_deg,
                rotation_z_deg=part.rotation_z_deg,
                lock_group_id=part.lock_group_id,
            )
            for part in list(source.assembly_parts or [])
        ]
        clone.body_parts = [
            FairStandItemBodyPartModel(
                id=uuid4(),
                parent_item_key=clone.item_key,
                body_role=body.body_role,
                child_item_key=body.child_item_key,
            )
            for body in list(source.body_parts or [])
        ]
        if source.video_wall is not None:
            wall = source.video_wall
            clone.video_wall = FairStandItemVideoWallModel(
                parent_item_key=clone.item_key,
                rows=int(wall.rows),
                cols=int(wall.cols),
                panel_item_key=wall.panel_item_key,
            )

    def archive_item(self, item_key: str) -> dict:
        row = self._get(item_key)
        row.is_active = False
        row.updated_at = _now()
        self._flush()
        return self._enrich_child_refs(_item_admin_payload(row))

    def restore_item(self, item_key: str) -> dict:
        row = self._get(item_key)
        row.is_active = True
        row.updated_at = _now()
        self._flush()
        return self._enrich_child_refs(_item_admin_payload(row))

    def _get(self, item_key: str) -> FairStandItemModel:
        row = self._session.scalars(
            select(FairStandItemModel).options(*_item_load_options()).where(FairStandItemModel.item_key == item_key)
        ).first()
        if row is None:
            raise ItemAdminError("Item bulunamadı.", status_code=404)
        return row

    def _apply_satellites(self, row: FairStandItemModel, payload: dict, *, replace: bool) -> None:
        if "dimensions" in payload:
            self._set_dimensions(row, payload.get("dimensions"))
        if "scene_dimensions" in payload or "sceneDimensions" in payload:
            self._set_scene_dimensions(
                row, payload.get("scene_dimensions", payload.get("sceneDimensions"))
            )
        if "strip_occupancy" in payload or "stripOccupancy" in payload:
            self._set_strip(
                row, payload.get("strip_occupancy", payload.get("stripOccupancy"))
            )
        if "assets" in payload:
            self._replace_assets(row, payload.get("assets") or [])
        if "components" in payload:
            self._replace_components(row, payload.get("components") or [])
        if "assembly_parts" in payload or "assemblyParts" in payload:
            self._replace_assembly_parts(
                row, payload.get("assembly_parts", payload.get("assemblyParts")) or []
            )
        if "body_parts" in payload or "bodyParts" in payload:
            self._replace_body_parts(
                row, payload.get("body_parts", payload.get("bodyParts")) or []
            )
        if "video_wall" in payload or "videoWall" in payload:
            self._set_video_wall(row, payload.get("video_wall", payload.get("videoWall")))
        _ = replace

    def _set_dimensions(self, row: FairStandItemModel, data: dict | None) -> None:
        if data is None:
            if row.dimensions is not None:
                self._session.delete(row.dimensions)
                row.dimensions = None
            return
        dims = row.dimensions or FairStandItemDimensionsModel(item_key=row.item_key)
        dims.width_cm = _optional_decimal(data.get("width_cm", data.get("widthCm")))
        dims.depth_cm = _optional_decimal(data.get("depth_cm", data.get("depthCm")))
        dims.height_cm = _optional_decimal(data.get("height_cm", data.get("heightCm")))
        dims.mount_height_cm = _optional_decimal(
            data.get("mount_height_cm", data.get("mountHeightCm"))
        )
        dims.wall_gap_cm = _optional_decimal(data.get("wall_gap_cm", data.get("wallGapCm")))
        if all(
            value is None
            for value in (
                dims.width_cm,
                dims.depth_cm,
                dims.height_cm,
                dims.mount_height_cm,
                dims.wall_gap_cm,
            )
        ):
            raise ItemAdminError("Ölçüler için en az bir değer girilmelidir.")
        if row.dimensions is None:
            self._session.add(dims)
            row.dimensions = dims

    def _set_scene_dimensions(self, row: FairStandItemModel, data: dict | None) -> None:
        if data is None:
            if row.scene_dimensions is not None:
                self._session.delete(row.scene_dimensions)
                row.scene_dimensions = None
            return
        dims = row.scene_dimensions or FairStandItemSceneDimensionsModel(item_key=row.item_key)
        dims.width_cm = _optional_decimal(data.get("width_cm", data.get("widthCm")))
        dims.depth_cm = _optional_decimal(data.get("depth_cm", data.get("depthCm")))
        dims.height_cm = _optional_decimal(data.get("height_cm", data.get("heightCm")))
        if dims.width_cm is None and dims.depth_cm is None and dims.height_cm is None:
            raise ItemAdminError("Sahne ölçüleri için en az bir değer girilmelidir.")
        if row.scene_dimensions is None:
            self._session.add(dims)
            row.scene_dimensions = dims

    def _set_strip(self, row: FairStandItemModel, data: dict | None) -> None:
        if data is None:
            if row.strip_occupancy is not None:
                self._session.delete(row.strip_occupancy)
                row.strip_occupancy = None
            return
        align = str(data.get("align") or "top")
        strip_count = int(data.get("strip_count", data.get("stripCount") or 0))
        if strip_count <= 0:
            raise ItemAdminError("Şerit sayısı 0’dan büyük olmalıdır.")
        strip = row.strip_occupancy or FairStandItemStripOccupancyModel(item_key=row.item_key)
        strip.align = align
        strip.strip_count = strip_count
        if row.strip_occupancy is None:
            self._session.add(strip)
            row.strip_occupancy = strip

    def _replace_assets(self, row: FairStandItemModel, assets: list[dict]) -> None:
        normalized: list[dict] = []
        seen_roles: set[str] = set()
        for asset in assets:
            role = str(asset.get("asset_role", asset.get("assetRole") or "")).strip()
            path = str(asset.get("relative_path", asset.get("relativePath") or "")).strip()
            if not role or not path:
                raise ItemAdminError("Asset rolü ve relative path zorunludur.")
            if role in seen_roles:
                raise ItemAdminError("Aynı asset rolü bir item altında birden fazla kullanılamaz.")
            seen_roles.add(role)
            normalized.append(
                {
                    "asset_role": role,
                    "relative_path": path,
                    "is_active": bool(asset.get("is_active", asset.get("isActive", True))),
                }
            )

        for existing in list(row.assets or []):
            self._session.delete(existing)
        row.assets = []
        # Flush deletes before inserts so (item_key, asset_role) unique is not hit mid-replace.
        self._flush()
        for asset in normalized:
            row.assets.append(
                FairStandItemAssetModel(
                    id=uuid4(),
                    item_key=row.item_key,
                    asset_role=asset["asset_role"],
                    relative_path=asset["relative_path"],
                    is_active=asset["is_active"],
                )
            )

    def _replace_components(self, row: FairStandItemModel, components: list[dict]) -> None:
        for existing in list(row.components or []):
            self._session.delete(existing)
        row.components = []
        for component in components:
            child = str(
                component.get("child_item_key", component.get("childItemKey") or "")
            ).strip().lower()
            if not child:
                raise ItemAdminError("Alt item key zorunludur.")
            if child == row.item_key:
                raise ItemAdminError("Alt item kendisine bağlanamaz.")
            quantity = _optional_decimal(component.get("quantity"))
            if quantity is None or quantity <= 0:
                raise ItemAdminError("Alt item miktarı 0’dan büyük olmalıdır.")
            per_band = _optional_decimal(component.get("per_band", component.get("perBand")))
            row.components.append(
                FairStandItemComponentModel(
                    id=uuid4(),
                    parent_item_key=row.item_key,
                    child_item_key=child,
                    quantity=quantity,
                    per_band=per_band if per_band is not None else Decimal("0"),
                    height_matched=bool(
                        component.get("height_matched", component.get("heightMatched"))
                    ),
                )
            )

    def _replace_assembly_parts(self, row: FairStandItemModel, parts: list[dict]) -> None:
        """Add/update/delete: (child, instance) varsa pose güncelle; yoksa ekle; payload’da yoksa sil."""
        existing_by_key: dict[tuple[str, int], FairStandItemAssemblyPartModel] = {
            (str(part.child_item_key), int(part.instance_index)): part
            for part in list(row.assembly_parts or [])
        }
        seen: set[tuple[str, int]] = set()
        kept: list[FairStandItemAssemblyPartModel] = []

        for part in parts:
            child = str(
                part.get("child_item_key", part.get("childItemKey") or "")
            ).strip().lower()
            if not child:
                raise ItemAdminError("Assembly child item key zorunludur.")
            if child == row.item_key:
                raise ItemAdminError("Assembly parçası kendisine bağlanamaz.")
            index = _optional_int(part.get("instance_index", part.get("instanceIndex")))
            if index is None or index < 0:
                raise ItemAdminError("Assembly instance_index 0 veya daha büyük olmalıdır.")
            key = (child, index)
            if key in seen:
                raise ItemAdminError(
                    f"Tekrarlayan assembly instance: {child}#{index}."
                )
            seen.add(key)
            child_row = self._session.get(FairStandItemModel, child)
            if child_row is None:
                raise ItemAdminError(f"Assembly child bulunamadı: {child}", status_code=404)

            x_cm = _optional_decimal(part.get("x_cm", part.get("xCm"))) or Decimal("0")
            y_cm = _optional_decimal(part.get("y_cm", part.get("yCm"))) or Decimal("0")
            z_cm = _optional_decimal(part.get("z_cm", part.get("zCm"))) or Decimal("0")
            rotation_x_deg = (
                _optional_decimal(part.get("rotation_x_deg", part.get("rotationXDeg")))
                or Decimal("0")
            )
            rotation_y_deg = (
                _optional_decimal(part.get("rotation_y_deg", part.get("rotationYDeg")))
                or Decimal("0")
            )
            rotation_z_deg = (
                _optional_decimal(part.get("rotation_z_deg", part.get("rotationZDeg")))
                or Decimal("0")
            )
            lock_raw = part.get("lock_group_id", part.get("lockGroupId"))
            lock_group_id = _optional_int(lock_raw)
            if lock_group_id is not None and lock_group_id < 1:
                raise ItemAdminError("Assembly lock_group_id 1 veya daha büyük olmalıdır.")

            current = existing_by_key.pop(key, None)
            if current is None:
                current = FairStandItemAssemblyPartModel(
                    id=uuid4(),
                    parent_item_key=row.item_key,
                    child_item_key=child,
                    instance_index=index,
                )
                self._session.add(current)
            current.x_cm = x_cm
            current.y_cm = y_cm
            current.z_cm = z_cm
            current.rotation_x_deg = rotation_x_deg
            current.rotation_y_deg = rotation_y_deg
            current.rotation_z_deg = rotation_z_deg
            current.lock_group_id = lock_group_id
            kept.append(current)

        for obsolete in existing_by_key.values():
            self._session.delete(obsolete)
        row.assembly_parts = kept

    def replace_assembly_parts(self, item_key: str, parts: list[dict]) -> dict:
        row = self._get(item_key)
        self._replace_assembly_parts(row, parts or [])
        row.updated_at = _now()
        self._flush()
        return self.get_item(item_key)

    def _replace_body_parts(self, row: FairStandItemModel, parts: list[dict]) -> None:
        normalized: list[dict] = []
        seen_roles: set[str] = set()
        for part in parts:
            role = str(part.get("body_role", part.get("bodyRole") or "")).strip()
            child = str(part.get("child_item_key", part.get("childItemKey") or "")).strip().lower()
            if not role or not child:
                raise ItemAdminError("Body role ve alt item key zorunludur.")
            if role in seen_roles:
                raise ItemAdminError("Aynı body role bir item altında birden fazla kullanılamaz.")
            seen_roles.add(role)
            normalized.append({"body_role": role, "child_item_key": child})

        for existing in list(row.body_parts or []):
            self._session.delete(existing)
        row.body_parts = []
        self._flush()
        for part in normalized:
            row.body_parts.append(
                FairStandItemBodyPartModel(
                    id=uuid4(),
                    parent_item_key=row.item_key,
                    body_role=part["body_role"],
                    child_item_key=part["child_item_key"],
                )
            )

    def _set_video_wall(self, row: FairStandItemModel, data: dict | None) -> None:
        if data is None:
            if row.video_wall is not None:
                self._session.delete(row.video_wall)
                row.video_wall = None
            return
        panel = str(data.get("panel_item_key", data.get("panelItemKey") or "")).strip().lower()
        rows = int(data.get("rows") or 0)
        cols = int(data.get("cols") or 0)
        if not panel or rows <= 0 or cols <= 0:
            raise ItemAdminError("Video wall için satır, sütun ve panel item key zorunludur.")
        wall = row.video_wall or FairStandItemVideoWallModel(parent_item_key=row.item_key)
        wall.rows = rows
        wall.cols = cols
        wall.panel_item_key = panel
        if row.video_wall is None:
            self._session.add(wall)
            row.video_wall = wall

    def _flush(self) -> None:
        try:
            self._session.flush()
        except IntegrityError as exc:
            raise ItemAdminError(_integrity_error_message(exc), status_code=409) from exc
