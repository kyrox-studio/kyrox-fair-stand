from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field

from app.integrations.kyrox_core.audit import SCOPE_SYSTEM_CATALOG, StandAuditRecorder
from app.integrations.kyrox_core.auth import AuthContext
from app.modules.fair_stand.application.admin_catalog import AdminCatalogService, CatalogAdminError
from app.modules.fair_stand.application.admin_items import AdminItemsService, ItemAdminError
from app.modules.fair_stand.application.admin_settings import AdminSettingsService, SettingsAdminError
from app.modules.fair_stand.application.admin_snap_catalog import AdminSnapCatalogService, SnapCatalogAdminError
from app.modules.fair_stand.application.admin_units import AdminUnitsService, UnitAdminError
from app.modules.fair_stand.application.get_catalog_bootstrap import GetCatalogBootstrapUseCase
from app.modules.fair_stand.application.item_mapper import runtime_settings_payload, stand_dimensions_payload
from app.modules.fair_stand.application.get_item import GetItemUseCase
from app.modules.fair_stand.api.dependencies import (
    PERMISSION_CATALOG_ARCHIVE,
    PERMISSION_CATALOG_CREATE,
    PERMISSION_CATALOG_READ,
    PERMISSION_CATALOG_UPDATE,
    PERMISSION_ITEMS_ARCHIVE,
    PERMISSION_ITEMS_CREATE,
    PERMISSION_ITEMS_READ,
    PERMISSION_ITEMS_UPDATE,
    PERMISSION_SETTINGS_READ,
    PERMISSION_SETTINGS_UPDATE,
    get_admin_catalog_service,
    get_admin_items_service,
    get_admin_settings_service,
    get_admin_snap_catalog_service,
    get_admin_units_service,
    get_catalog_bootstrap_use_case,
    get_item_use_case,
    get_stand_audit,
    require_any_permission,
    require_fair_stand_catalog_access,
    require_permission,
)

router = APIRouter(prefix="/fair-stand", tags=["fair-stand"])


class CategoryCreateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    catalog_name: str = Field(min_length=1, max_length=128)
    catalog_index: int = Field(ge=1)
    is_active: bool = True


class CategoryUpdateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    catalog_name: str | None = Field(default=None, min_length=1, max_length=128)
    catalog_index: int | None = Field(default=None, ge=1)
    is_active: bool | None = None


class UnitCreateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=128)
    symbol: str = Field(min_length=1, max_length=32)
    is_active: bool = True


class UnitUpdateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, min_length=1, max_length=128)
    symbol: str | None = Field(default=None, min_length=1, max_length=32)
    is_active: bool | None = None


class ItemCatalogUpdateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    catalog_visible: bool | None = None
    category_id: int | None = None
    catalog_item_index: int | None = None
    preview_id: int | None = None


class PreviewCreateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    display_name: str = Field(min_length=1, max_length=128)
    markup: str
    css_code: str
    sort_index: int = 0
    is_active: bool = True


class PreviewUpdateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    display_name: str | None = Field(default=None, min_length=1, max_length=128)
    markup: str | None = None
    css_code: str | None = None
    sort_index: int | None = None
    is_active: bool | None = None


class StandDimensionsUpdateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    height_cm: float = Field(gt=0)
    depth_cm: float = Field(gt=0)
    frame_width_cm: float = Field(gt=0)
    frame_depth_cm: float = Field(gt=0)
    panel_rail_height_cm: float = Field(gt=0)


class RuntimeSettingsUpdateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    max_image_upload_mb: int = Field(gt=0)
    export_button_visible: bool
    import_button_visible: bool
    save_as_button_visible: bool


class ItemTypeCreateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    display_name: str = Field(min_length=1, max_length=128)
    key: str | None = Field(default=None, max_length=64)
    is_active: bool = True
    placement: str | None = Field(default=None, max_length=32)
    collision: str | None = Field(default=None, max_length=32)
    move_snap_cm: int | None = Field(default=None, gt=0)
    magnetic_snap: str | None = Field(default=None, max_length=32)
    allow_side_insert: bool | None = None
    supports_wall_overlay_mount: bool | None = None
    wall_capacity: str | None = Field(default=None, max_length=16)
    connection_endpoint: str | None = Field(default=None, max_length=32)
    collision_depth: str | None = Field(default=None, max_length=32)
    endpoint_contact: str | None = Field(default=None, max_length=32)
    boundary_snap: str | None = Field(default=None, max_length=32)
    collision_height: str | None = Field(default=None, max_length=16)
    overlap_with_types: list[str] | str | None = None
    overlap_item_type_ids: list[int] | None = None
    ghost_kind: str | None = Field(default=None, max_length=32)
    ghost_renderer: str | None = Field(default=None, max_length=64)
    ghost_opacity: float | None = Field(default=None, ge=0, le=1)


class ItemTypeUpdateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    display_name: str | None = Field(default=None, min_length=1, max_length=128)
    key: str | None = Field(default=None, min_length=1, max_length=64)
    is_active: bool | None = None
    placement: str | None = Field(default=None, max_length=32)
    collision: str | None = Field(default=None, max_length=32)
    move_snap_cm: int | None = Field(default=None, gt=0)
    magnetic_snap: str | None = Field(default=None, max_length=32)
    allow_side_insert: bool | None = None
    supports_wall_overlay_mount: bool | None = None
    wall_capacity: str | None = Field(default=None, max_length=16)
    connection_endpoint: str | None = Field(default=None, max_length=32)
    collision_depth: str | None = Field(default=None, max_length=32)
    endpoint_contact: str | None = Field(default=None, max_length=32)
    boundary_snap: str | None = Field(default=None, max_length=32)
    collision_height: str | None = Field(default=None, max_length=16)
    overlap_with_types: list[str] | str | None = None
    overlap_item_type_ids: list[int] | None = None
    ghost_kind: str | None = Field(default=None, max_length=32)
    ghost_renderer: str | None = Field(default=None, max_length=64)
    ghost_opacity: float | None = Field(default=None, ge=0, le=1)


class RuleTypeCreateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    key: str | None = Field(default=None, max_length=64)
    display_name: str = Field(min_length=1, max_length=128)
    is_active: bool = True


class RuleTypeUpdateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    key: str | None = Field(default=None, min_length=1, max_length=64)
    display_name: str | None = Field(default=None, min_length=1, max_length=128)
    is_active: bool | None = None


class RuleCreateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    rule_type_id: int = Field(ge=1)
    key: str | None = Field(default=None, max_length=64)
    display_name: str = Field(min_length=1, max_length=128)
    face: str | None = None
    edge: str | None = None
    item_type_ids: list[int] | None = None
    is_active: bool = True


class RuleUpdateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    rule_type_id: int | None = Field(default=None, ge=1)
    key: str | None = Field(default=None, min_length=1, max_length=64)
    display_name: str | None = Field(default=None, min_length=1, max_length=128)
    face: str | None = None
    edge: str | None = None
    item_type_ids: list[int] | None = None
    is_active: bool | None = None


def _preview_kind_payload(preview) -> dict[str, Any]:
    return {
        "id": preview.id,
        "displayName": preview.display_name,
        "markup": preview.markup,
        "cssCode": preview.css_code,
        "sortIndex": preview.sort_index,
        "isActive": preview.is_active,
    }


def _result_key(result: Any, *keys: str) -> Any:
    """Audit resource id from the service result (create/clone returns the new key)."""
    if isinstance(result, dict):
        for key in keys:
            if result.get(key) is not None:
                return result[key]
    return None


def _raise_admin(
    exc: CatalogAdminError | SettingsAdminError | ItemAdminError | SnapCatalogAdminError | UnitAdminError,
) -> None:
    raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.get("/catalog/bootstrap")
def get_catalog_bootstrap(
    auth: AuthContext = Depends(require_fair_stand_catalog_access),
    use_case: GetCatalogBootstrapUseCase = Depends(get_catalog_bootstrap_use_case),
) -> dict[str, Any]:
    _ = auth
    snapshot = use_case.execute()
    return {
        "revision": snapshot.revision,
        "categories": [
            {
                "id": category.id,
                "catalogName": category.catalog_name,
                "catalogIndex": category.catalog_index,
            }
            for category in snapshot.categories
        ],
        "items": [item.payload for item in snapshot.items],
        "previewKinds": [_preview_kind_payload(preview) for preview in snapshot.preview_kinds],
        "itemTypes": snapshot.item_types,
        "ruleTypes": snapshot.rule_types,
        "rules": snapshot.rules,
        "standDimensions": stand_dimensions_payload(snapshot.stand_dimensions),
        "settings": runtime_settings_payload(snapshot.settings),
        "units": snapshot.units,
    }


@router.get("/items/{item_key}")
def get_item(
    item_key: str,
    auth: AuthContext = Depends(require_fair_stand_catalog_access),
    use_case: GetItemUseCase = Depends(get_item_use_case),
) -> dict[str, Any]:
    _ = auth
    item = use_case.execute(item_key)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return item.payload


@router.get("/admin/categories")
def admin_list_categories(
    auth: AuthContext = Depends(require_permission(PERMISSION_CATALOG_READ)),
    service: AdminCatalogService = Depends(get_admin_catalog_service),
) -> list[dict[str, Any]]:
    _ = auth
    return service.list_categories()


@router.post("/admin/categories", status_code=status.HTTP_201_CREATED)
def admin_create_category(
    body: CategoryCreateBody,
    auth: AuthContext = Depends(require_permission(PERMISSION_CATALOG_CREATE)),
    service: AdminCatalogService = Depends(get_admin_catalog_service),
    audit: StandAuditRecorder = Depends(get_stand_audit),
) -> dict[str, Any]:
    _ = auth
    try:
        result = service.create_category(
            catalog_name=body.catalog_name,
            catalog_index=body.catalog_index,
            is_active=body.is_active,
        )
    except CatalogAdminError as exc:
        _raise_admin(exc)
        raise
    audit.record(
        "fair_stand.catalog_category.created",
        "catalog_category",
        _result_key(result, "id"),
        scope=SCOPE_SYSTEM_CATALOG,
        new_values=body.model_dump(),
    )
    return result


@router.patch("/admin/categories/{category_id}")
def admin_update_category(
    category_id: int,
    body: CategoryUpdateBody,
    auth: AuthContext = Depends(require_permission(PERMISSION_CATALOG_UPDATE)),
    service: AdminCatalogService = Depends(get_admin_catalog_service),
    audit: StandAuditRecorder = Depends(get_stand_audit),
) -> dict[str, Any]:
    _ = auth
    try:
        result = service.update_category(
            category_id,
            catalog_name=body.catalog_name,
            catalog_index=body.catalog_index,
            is_active=body.is_active,
        )
    except CatalogAdminError as exc:
        _raise_admin(exc)
        raise
    audit.record(
        "fair_stand.catalog_category.updated",
        "catalog_category",
        category_id,
        scope=SCOPE_SYSTEM_CATALOG,
        new_values=body.model_dump(exclude_unset=True),
    )
    return result


@router.post("/admin/categories/{category_id}/archive")
def admin_archive_category(
    category_id: int,
    auth: AuthContext = Depends(require_permission(PERMISSION_CATALOG_ARCHIVE)),
    service: AdminCatalogService = Depends(get_admin_catalog_service),
    audit: StandAuditRecorder = Depends(get_stand_audit),
) -> dict[str, Any]:
    _ = auth
    try:
        result = service.archive_category(category_id)
    except CatalogAdminError as exc:
        _raise_admin(exc)
        raise
    audit.record(
        "fair_stand.catalog_category.archived",
        "catalog_category",
        category_id,
        scope=SCOPE_SYSTEM_CATALOG,
    )
    return result


@router.post("/admin/categories/{category_id}/restore")
def admin_restore_category(
    category_id: int,
    auth: AuthContext = Depends(require_permission(PERMISSION_CATALOG_ARCHIVE)),
    service: AdminCatalogService = Depends(get_admin_catalog_service),
    audit: StandAuditRecorder = Depends(get_stand_audit),
) -> dict[str, Any]:
    _ = auth
    try:
        result = service.restore_category(category_id)
    except CatalogAdminError as exc:
        _raise_admin(exc)
        raise
    audit.record(
        "fair_stand.catalog_category.restored",
        "catalog_category",
        category_id,
        scope=SCOPE_SYSTEM_CATALOG,
    )
    return result


@router.get("/admin/units")
def admin_list_units(
    auth: AuthContext = Depends(require_permission(PERMISSION_CATALOG_READ)),
    service: AdminUnitsService = Depends(get_admin_units_service),
) -> list[dict[str, Any]]:
    _ = auth
    return service.list_units()


@router.post("/admin/units", status_code=status.HTTP_201_CREATED)
def admin_create_unit(
    body: UnitCreateBody,
    auth: AuthContext = Depends(require_permission(PERMISSION_CATALOG_CREATE)),
    service: AdminUnitsService = Depends(get_admin_units_service),
    audit: StandAuditRecorder = Depends(get_stand_audit),
) -> dict[str, Any]:
    _ = auth
    try:
        result = service.create_unit(
            name=body.name,
            symbol=body.symbol,
            is_active=body.is_active,
        )
    except UnitAdminError as exc:
        _raise_admin(exc)
        raise
    audit.record(
        "fair_stand.unit.created",
        "unit",
        _result_key(result, "id"),
        scope=SCOPE_SYSTEM_CATALOG,
        new_values=body.model_dump(),
    )
    return result


@router.patch("/admin/units/{unit_id}")
def admin_update_unit(
    unit_id: int,
    body: UnitUpdateBody,
    auth: AuthContext = Depends(require_permission(PERMISSION_CATALOG_UPDATE)),
    service: AdminUnitsService = Depends(get_admin_units_service),
    audit: StandAuditRecorder = Depends(get_stand_audit),
) -> dict[str, Any]:
    _ = auth
    try:
        result = service.update_unit(
            unit_id,
            name=body.name,
            symbol=body.symbol,
            is_active=body.is_active,
        )
    except UnitAdminError as exc:
        _raise_admin(exc)
        raise
    audit.record(
        "fair_stand.unit.updated",
        "unit",
        unit_id,
        scope=SCOPE_SYSTEM_CATALOG,
        new_values=body.model_dump(exclude_unset=True),
    )
    return result


@router.post("/admin/units/{unit_id}/archive")
def admin_archive_unit(
    unit_id: int,
    auth: AuthContext = Depends(require_permission(PERMISSION_CATALOG_ARCHIVE)),
    service: AdminUnitsService = Depends(get_admin_units_service),
    audit: StandAuditRecorder = Depends(get_stand_audit),
) -> dict[str, Any]:
    _ = auth
    try:
        result = service.archive_unit(unit_id)
    except UnitAdminError as exc:
        _raise_admin(exc)
        raise
    audit.record(
        "fair_stand.unit.archived",
        "unit",
        unit_id,
        scope=SCOPE_SYSTEM_CATALOG,
    )
    return result


@router.post("/admin/units/{unit_id}/restore")
def admin_restore_unit(
    unit_id: int,
    auth: AuthContext = Depends(require_permission(PERMISSION_CATALOG_ARCHIVE)),
    service: AdminUnitsService = Depends(get_admin_units_service),
    audit: StandAuditRecorder = Depends(get_stand_audit),
) -> dict[str, Any]:
    _ = auth
    try:
        result = service.restore_unit(unit_id)
    except UnitAdminError as exc:
        _raise_admin(exc)
        raise
    audit.record(
        "fair_stand.unit.restored",
        "unit",
        unit_id,
        scope=SCOPE_SYSTEM_CATALOG,
    )
    return result


@router.get("/admin/items")
def admin_list_items(
    auth: AuthContext = Depends(require_any_permission(PERMISSION_CATALOG_READ, PERMISSION_CATALOG_UPDATE)),
    service: AdminCatalogService = Depends(get_admin_catalog_service),
) -> list[dict[str, Any]]:
    _ = auth
    return service.list_items()


@router.patch("/admin/items/{item_key}")
def admin_update_item_catalog(
    item_key: str,
    body: ItemCatalogUpdateBody,
    auth: AuthContext = Depends(require_permission(PERMISSION_CATALOG_UPDATE)),
    service: AdminCatalogService = Depends(get_admin_catalog_service),
    audit: StandAuditRecorder = Depends(get_stand_audit),
) -> dict[str, Any]:
    _ = auth
    try:
        result = service.update_item_catalog(
            item_key,
            catalog_visible=body.catalog_visible,
            category_id=body.category_id,
            category_id_provided="category_id" in body.model_fields_set,
            catalog_item_index=body.catalog_item_index,
            catalog_item_index_provided="catalog_item_index" in body.model_fields_set,
            preview_id=body.preview_id,
            preview_id_provided="preview_id" in body.model_fields_set,
        )
    except CatalogAdminError as exc:
        _raise_admin(exc)
        raise
    audit.record(
        "fair_stand.catalog_item.updated",
        "catalog_item",
        item_key,
        scope=SCOPE_SYSTEM_CATALOG,
        new_values=body.model_dump(exclude_unset=True),
    )
    return result


@router.get("/admin/previews")
def admin_list_previews(
    auth: AuthContext = Depends(require_permission(PERMISSION_CATALOG_READ)),
    service: AdminCatalogService = Depends(get_admin_catalog_service),
) -> list[dict[str, Any]]:
    _ = auth
    return service.list_previews()


@router.post("/admin/previews", status_code=status.HTTP_201_CREATED)
def admin_create_preview(
    body: PreviewCreateBody,
    auth: AuthContext = Depends(require_permission(PERMISSION_CATALOG_CREATE)),
    service: AdminCatalogService = Depends(get_admin_catalog_service),
    audit: StandAuditRecorder = Depends(get_stand_audit),
) -> dict[str, Any]:
    _ = auth
    try:
        result = service.create_preview(
            display_name=body.display_name,
            markup=body.markup,
            css_code=body.css_code,
            sort_index=body.sort_index,
            is_active=body.is_active,
        )
    except CatalogAdminError as exc:
        _raise_admin(exc)
        raise
    audit.record(
        "fair_stand.catalog_preview.created",
        "catalog_preview",
        _result_key(result, "id"),
        scope=SCOPE_SYSTEM_CATALOG,
        new_values=body.model_dump(),
    )
    return result


@router.patch("/admin/previews/{preview_id}")
def admin_update_preview(
    preview_id: int,
    body: PreviewUpdateBody,
    auth: AuthContext = Depends(require_permission(PERMISSION_CATALOG_UPDATE)),
    service: AdminCatalogService = Depends(get_admin_catalog_service),
    audit: StandAuditRecorder = Depends(get_stand_audit),
) -> dict[str, Any]:
    _ = auth
    try:
        result = service.update_preview(
            preview_id,
            display_name=body.display_name,
            markup=body.markup,
            css_code=body.css_code,
            sort_index=body.sort_index,
            is_active=body.is_active,
        )
    except CatalogAdminError as exc:
        _raise_admin(exc)
        raise
    audit.record(
        "fair_stand.catalog_preview.updated",
        "catalog_preview",
        preview_id,
        scope=SCOPE_SYSTEM_CATALOG,
        new_values=body.model_dump(exclude_unset=True),
    )
    return result


@router.post("/admin/previews/{preview_id}/archive")
def admin_archive_preview(
    preview_id: int,
    auth: AuthContext = Depends(require_permission(PERMISSION_CATALOG_ARCHIVE)),
    service: AdminCatalogService = Depends(get_admin_catalog_service),
    audit: StandAuditRecorder = Depends(get_stand_audit),
) -> dict[str, Any]:
    _ = auth
    try:
        result = service.archive_preview(preview_id)
    except CatalogAdminError as exc:
        _raise_admin(exc)
        raise
    audit.record(
        "fair_stand.catalog_preview.archived",
        "catalog_preview",
        preview_id,
        scope=SCOPE_SYSTEM_CATALOG,
    )
    return result


@router.post("/admin/previews/{preview_id}/restore")
def admin_restore_preview(
    preview_id: int,
    auth: AuthContext = Depends(require_permission(PERMISSION_CATALOG_ARCHIVE)),
    service: AdminCatalogService = Depends(get_admin_catalog_service),
    audit: StandAuditRecorder = Depends(get_stand_audit),
) -> dict[str, Any]:
    _ = auth
    try:
        result = service.restore_preview(preview_id)
    except CatalogAdminError as exc:
        _raise_admin(exc)
        raise
    audit.record(
        "fair_stand.catalog_preview.restored",
        "catalog_preview",
        preview_id,
        scope=SCOPE_SYSTEM_CATALOG,
    )
    return result


@router.get("/admin/settings")
def admin_get_settings(
    auth: AuthContext = Depends(require_permission(PERMISSION_SETTINGS_READ)),
    service: AdminSettingsService = Depends(get_admin_settings_service),
) -> dict[str, Any]:
    _ = auth
    return service.get_bundle()


@router.put("/admin/stand-dimensions")
def admin_update_stand_dimensions(
    body: StandDimensionsUpdateBody,
    auth: AuthContext = Depends(require_permission(PERMISSION_SETTINGS_UPDATE)),
    service: AdminSettingsService = Depends(get_admin_settings_service),
    audit: StandAuditRecorder = Depends(get_stand_audit),
) -> dict[str, Any]:
    _ = auth
    try:
        result = service.update_stand_dimensions(
            height_cm=body.height_cm,
            depth_cm=body.depth_cm,
            frame_width_cm=body.frame_width_cm,
            frame_depth_cm=body.frame_depth_cm,
            panel_rail_height_cm=body.panel_rail_height_cm,
        )
    except SettingsAdminError as exc:
        _raise_admin(exc)
        raise
    audit.record(
        "fair_stand.stand_dimensions.updated",
        "stand_dimensions",
        None,
        scope=SCOPE_SYSTEM_CATALOG,
        new_values=body.model_dump(),
    )
    return result


@router.put("/admin/runtime-settings")
def admin_update_runtime_settings(
    body: RuntimeSettingsUpdateBody,
    auth: AuthContext = Depends(require_permission(PERMISSION_SETTINGS_UPDATE)),
    service: AdminSettingsService = Depends(get_admin_settings_service),
    audit: StandAuditRecorder = Depends(get_stand_audit),
) -> dict[str, Any]:
    _ = auth
    try:
        result = service.update_runtime_settings(
            max_image_upload_mb=body.max_image_upload_mb,
            export_button_visible=body.export_button_visible,
            import_button_visible=body.import_button_visible,
            save_as_button_visible=body.save_as_button_visible,
        )
    except SettingsAdminError as exc:
        _raise_admin(exc)
        raise
    audit.record(
        "fair_stand.runtime_settings.updated",
        "runtime_settings",
        None,
        scope=SCOPE_SYSTEM_CATALOG,
        new_values=body.model_dump(),
    )
    return result


@router.get("/admin/item-records")
def admin_list_item_records(
    auth: AuthContext = Depends(require_permission(PERMISSION_ITEMS_READ)),
    service: AdminItemsService = Depends(get_admin_items_service),
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100, alias="pageSize")] = 25,
    search: Annotated[str | None, Query()] = None,
    sort_by: Annotated[str | None, Query(alias="sort_by")] = None,
    sort_order: Annotated[str | None, Query(alias="sort_order")] = None,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    catalog: Annotated[str | None, Query()] = None,
    render: Annotated[str | None, Query()] = None,
    item_type: Annotated[str | None, Query(alias="type")] = None,
) -> dict[str, Any]:
    _ = auth
    return service.list_item_records(
        page=page,
        page_size=page_size,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        status=status_filter,
        catalog=catalog,
        render=render,
        item_type=item_type,
    )


@router.get("/admin/item-records/{item_key}")
def admin_get_item_record(
    item_key: str,
    auth: AuthContext = Depends(require_permission(PERMISSION_ITEMS_READ)),
    service: AdminItemsService = Depends(get_admin_items_service),
) -> dict[str, Any]:
    _ = auth
    try:
        return service.get_item(item_key)
    except ItemAdminError as exc:
        _raise_admin(exc)
        raise


@router.post("/admin/item-records", status_code=status.HTTP_201_CREATED)
def admin_create_item_record(
    body: dict[str, Any],
    auth: AuthContext = Depends(require_permission(PERMISSION_ITEMS_CREATE)),
    service: AdminItemsService = Depends(get_admin_items_service),
    audit: StandAuditRecorder = Depends(get_stand_audit),
) -> dict[str, Any]:
    _ = auth
    try:
        result = service.create_item(body)
    except ItemAdminError as exc:
        _raise_admin(exc)
        raise
    audit.record(
        "fair_stand.item_record.created",
        "item_record",
        _result_key(result, "itemKey", "item_key"),
        scope=SCOPE_SYSTEM_CATALOG,
        new_values=body,
    )
    return result


@router.post("/admin/item-records/{item_key}/clone", status_code=status.HTTP_201_CREATED)
def admin_clone_item_record(
    item_key: str,
    body: dict[str, Any],
    auth: AuthContext = Depends(require_permission(PERMISSION_ITEMS_CREATE)),
    service: AdminItemsService = Depends(get_admin_items_service),
    audit: StandAuditRecorder = Depends(get_stand_audit),
) -> dict[str, Any]:
    _ = auth
    try:
        result = service.clone_item(item_key, body or {})
    except ItemAdminError as exc:
        _raise_admin(exc)
        raise
    audit.record(
        "fair_stand.item_record.cloned",
        "item_record",
        _result_key(result, "itemKey", "item_key"),
        scope=SCOPE_SYSTEM_CATALOG,
        new_values=body,
    )
    return result


@router.put("/admin/item-records/{item_key}")
def admin_update_item_record(
    item_key: str,
    body: dict[str, Any],
    auth: AuthContext = Depends(require_permission(PERMISSION_ITEMS_UPDATE)),
    service: AdminItemsService = Depends(get_admin_items_service),
    audit: StandAuditRecorder = Depends(get_stand_audit),
) -> dict[str, Any]:
    _ = auth
    try:
        result = service.update_item(item_key, body)
    except ItemAdminError as exc:
        _raise_admin(exc)
        raise
    audit.record(
        "fair_stand.item_record.updated",
        "item_record",
        item_key,
        scope=SCOPE_SYSTEM_CATALOG,
        new_values=body,
    )
    return result


@router.put("/admin/item-records/{item_key}/assembly")
def admin_replace_item_assembly(
    item_key: str,
    body: dict[str, Any],
    auth: AuthContext = Depends(require_permission(PERMISSION_ITEMS_UPDATE)),
    service: AdminItemsService = Depends(get_admin_items_service),
    audit: StandAuditRecorder = Depends(get_stand_audit),
) -> dict[str, Any]:
    _ = auth
    parts = body.get("parts") if isinstance(body, dict) else None
    if parts is None and isinstance(body, list):
        parts = body
    try:
        result = service.replace_assembly_parts(item_key, parts or [])
    except ItemAdminError as exc:
        _raise_admin(exc)
        raise
    audit.record(
        "fair_stand.item_record.assembly_replaced",
        "item_record",
        item_key,
        scope=SCOPE_SYSTEM_CATALOG,
        new_values={"part_count": len(parts or [])},
    )
    return result


@router.post("/admin/item-records/{item_key}/archive")
def admin_archive_item_record(
    item_key: str,
    auth: AuthContext = Depends(require_permission(PERMISSION_ITEMS_ARCHIVE)),
    service: AdminItemsService = Depends(get_admin_items_service),
    audit: StandAuditRecorder = Depends(get_stand_audit),
) -> dict[str, Any]:
    _ = auth
    try:
        result = service.archive_item(item_key)
    except ItemAdminError as exc:
        _raise_admin(exc)
        raise
    audit.record(
        "fair_stand.item_record.archived",
        "item_record",
        item_key,
        scope=SCOPE_SYSTEM_CATALOG,
    )
    return result


@router.post("/admin/item-records/{item_key}/restore")
def admin_restore_item_record(
    item_key: str,
    auth: AuthContext = Depends(require_permission(PERMISSION_ITEMS_ARCHIVE)),
    service: AdminItemsService = Depends(get_admin_items_service),
    audit: StandAuditRecorder = Depends(get_stand_audit),
) -> dict[str, Any]:
    _ = auth
    try:
        result = service.restore_item(item_key)
    except ItemAdminError as exc:
        _raise_admin(exc)
        raise
    audit.record(
        "fair_stand.item_record.restored",
        "item_record",
        item_key,
        scope=SCOPE_SYSTEM_CATALOG,
    )
    return result


@router.get("/admin/item-types")
def admin_list_item_types(
    auth: AuthContext = Depends(require_permission(PERMISSION_ITEMS_READ)),
    service: AdminSnapCatalogService = Depends(get_admin_snap_catalog_service),
) -> list[dict[str, Any]]:
    _ = auth
    return service.list_item_types()


@router.post("/admin/item-types", status_code=status.HTTP_201_CREATED)
def admin_create_item_type(
    body: ItemTypeCreateBody,
    auth: AuthContext = Depends(require_permission(PERMISSION_ITEMS_CREATE)),
    service: AdminSnapCatalogService = Depends(get_admin_snap_catalog_service),
    audit: StandAuditRecorder = Depends(get_stand_audit),
) -> dict[str, Any]:
    _ = auth
    try:
        result = service.create_item_type(**body.model_dump())
    except SnapCatalogAdminError as exc:
        _raise_admin(exc)
        raise
    audit.record(
        "fair_stand.item_type.created",
        "item_type",
        _result_key(result, "id"),
        scope=SCOPE_SYSTEM_CATALOG,
        new_values=body.model_dump(),
    )
    return result


@router.patch("/admin/item-types/{item_type_id}")
def admin_update_item_type(
    item_type_id: int,
    body: ItemTypeUpdateBody,
    auth: AuthContext = Depends(require_permission(PERMISSION_ITEMS_UPDATE)),
    service: AdminSnapCatalogService = Depends(get_admin_snap_catalog_service),
    audit: StandAuditRecorder = Depends(get_stand_audit),
) -> dict[str, Any]:
    _ = auth
    try:
        result = service.update_item_type(item_type_id, body.model_dump(exclude_unset=True))
    except SnapCatalogAdminError as exc:
        _raise_admin(exc)
        raise
    audit.record(
        "fair_stand.item_type.updated",
        "item_type",
        item_type_id,
        scope=SCOPE_SYSTEM_CATALOG,
        new_values=body.model_dump(exclude_unset=True),
    )
    return result


@router.post("/admin/item-types/{item_type_id}/archive")
def admin_archive_item_type(
    item_type_id: int,
    auth: AuthContext = Depends(require_permission(PERMISSION_ITEMS_ARCHIVE)),
    service: AdminSnapCatalogService = Depends(get_admin_snap_catalog_service),
    audit: StandAuditRecorder = Depends(get_stand_audit),
) -> dict[str, Any]:
    _ = auth
    try:
        result = service.archive_item_type(item_type_id)
    except SnapCatalogAdminError as exc:
        _raise_admin(exc)
        raise
    audit.record(
        "fair_stand.item_type.archived",
        "item_type",
        item_type_id,
        scope=SCOPE_SYSTEM_CATALOG,
    )
    return result


@router.post("/admin/item-types/{item_type_id}/restore")
def admin_restore_item_type(
    item_type_id: int,
    auth: AuthContext = Depends(require_permission(PERMISSION_ITEMS_ARCHIVE)),
    service: AdminSnapCatalogService = Depends(get_admin_snap_catalog_service),
    audit: StandAuditRecorder = Depends(get_stand_audit),
) -> dict[str, Any]:
    _ = auth
    try:
        result = service.restore_item_type(item_type_id)
    except SnapCatalogAdminError as exc:
        _raise_admin(exc)
        raise
    audit.record(
        "fair_stand.item_type.restored",
        "item_type",
        item_type_id,
        scope=SCOPE_SYSTEM_CATALOG,
    )
    return result


@router.get("/admin/rule-types")
def admin_list_rule_types(
    auth: AuthContext = Depends(require_permission(PERMISSION_ITEMS_READ)),
    service: AdminSnapCatalogService = Depends(get_admin_snap_catalog_service),
) -> list[dict[str, Any]]:
    _ = auth
    return service.list_rule_types()


@router.post("/admin/rule-types", status_code=status.HTTP_201_CREATED)
def admin_create_rule_type(
    body: RuleTypeCreateBody,
    auth: AuthContext = Depends(require_permission(PERMISSION_ITEMS_CREATE)),
    service: AdminSnapCatalogService = Depends(get_admin_snap_catalog_service),
    audit: StandAuditRecorder = Depends(get_stand_audit),
) -> dict[str, Any]:
    _ = auth
    try:
        result = service.create_rule_type(**body.model_dump())
    except SnapCatalogAdminError as exc:
        _raise_admin(exc)
        raise
    audit.record(
        "fair_stand.snap_rule_type.created",
        "snap_rule_type",
        _result_key(result, "id"),
        scope=SCOPE_SYSTEM_CATALOG,
        new_values=body.model_dump(),
    )
    return result


@router.patch("/admin/rule-types/{rule_type_id}")
def admin_update_rule_type(
    rule_type_id: int,
    body: RuleTypeUpdateBody,
    auth: AuthContext = Depends(require_permission(PERMISSION_ITEMS_UPDATE)),
    service: AdminSnapCatalogService = Depends(get_admin_snap_catalog_service),
    audit: StandAuditRecorder = Depends(get_stand_audit),
) -> dict[str, Any]:
    _ = auth
    try:
        result = service.update_rule_type(rule_type_id, body.model_dump(exclude_unset=True))
    except SnapCatalogAdminError as exc:
        _raise_admin(exc)
        raise
    audit.record(
        "fair_stand.snap_rule_type.updated",
        "snap_rule_type",
        rule_type_id,
        scope=SCOPE_SYSTEM_CATALOG,
        new_values=body.model_dump(exclude_unset=True),
    )
    return result


@router.post("/admin/rule-types/{rule_type_id}/archive")
def admin_archive_rule_type(
    rule_type_id: int,
    auth: AuthContext = Depends(require_permission(PERMISSION_ITEMS_ARCHIVE)),
    service: AdminSnapCatalogService = Depends(get_admin_snap_catalog_service),
    audit: StandAuditRecorder = Depends(get_stand_audit),
) -> dict[str, Any]:
    _ = auth
    try:
        result = service.archive_rule_type(rule_type_id)
    except SnapCatalogAdminError as exc:
        _raise_admin(exc)
        raise
    audit.record(
        "fair_stand.snap_rule_type.archived",
        "snap_rule_type",
        rule_type_id,
        scope=SCOPE_SYSTEM_CATALOG,
    )
    return result


@router.post("/admin/rule-types/{rule_type_id}/restore")
def admin_restore_rule_type(
    rule_type_id: int,
    auth: AuthContext = Depends(require_permission(PERMISSION_ITEMS_ARCHIVE)),
    service: AdminSnapCatalogService = Depends(get_admin_snap_catalog_service),
    audit: StandAuditRecorder = Depends(get_stand_audit),
) -> dict[str, Any]:
    _ = auth
    try:
        result = service.restore_rule_type(rule_type_id)
    except SnapCatalogAdminError as exc:
        _raise_admin(exc)
        raise
    audit.record(
        "fair_stand.snap_rule_type.restored",
        "snap_rule_type",
        rule_type_id,
        scope=SCOPE_SYSTEM_CATALOG,
    )
    return result


@router.get("/admin/rules")
def admin_list_rules(
    auth: AuthContext = Depends(require_permission(PERMISSION_ITEMS_READ)),
    service: AdminSnapCatalogService = Depends(get_admin_snap_catalog_service),
) -> list[dict[str, Any]]:
    _ = auth
    return service.list_rules()


@router.post("/admin/rules", status_code=status.HTTP_201_CREATED)
def admin_create_rule(
    body: RuleCreateBody,
    auth: AuthContext = Depends(require_permission(PERMISSION_ITEMS_CREATE)),
    service: AdminSnapCatalogService = Depends(get_admin_snap_catalog_service),
    audit: StandAuditRecorder = Depends(get_stand_audit),
) -> dict[str, Any]:
    _ = auth
    try:
        result = service.create_rule(**body.model_dump())
    except SnapCatalogAdminError as exc:
        _raise_admin(exc)
        raise
    audit.record(
        "fair_stand.snap_rule.created",
        "snap_rule",
        _result_key(result, "id"),
        scope=SCOPE_SYSTEM_CATALOG,
        new_values=body.model_dump(),
    )
    return result


@router.patch("/admin/rules/{rule_id}")
def admin_update_rule(
    rule_id: int,
    body: RuleUpdateBody,
    auth: AuthContext = Depends(require_permission(PERMISSION_ITEMS_UPDATE)),
    service: AdminSnapCatalogService = Depends(get_admin_snap_catalog_service),
    audit: StandAuditRecorder = Depends(get_stand_audit),
) -> dict[str, Any]:
    _ = auth
    try:
        result = service.update_rule(rule_id, body.model_dump(exclude_unset=True))
    except SnapCatalogAdminError as exc:
        _raise_admin(exc)
        raise
    audit.record(
        "fair_stand.snap_rule.updated",
        "snap_rule",
        rule_id,
        scope=SCOPE_SYSTEM_CATALOG,
        new_values=body.model_dump(exclude_unset=True),
    )
    return result


@router.post("/admin/rules/{rule_id}/archive")
def admin_archive_rule(
    rule_id: int,
    auth: AuthContext = Depends(require_permission(PERMISSION_ITEMS_ARCHIVE)),
    service: AdminSnapCatalogService = Depends(get_admin_snap_catalog_service),
    audit: StandAuditRecorder = Depends(get_stand_audit),
) -> dict[str, Any]:
    _ = auth
    try:
        result = service.archive_rule(rule_id)
    except SnapCatalogAdminError as exc:
        _raise_admin(exc)
        raise
    audit.record(
        "fair_stand.snap_rule.archived",
        "snap_rule",
        rule_id,
        scope=SCOPE_SYSTEM_CATALOG,
    )
    return result


@router.post("/admin/rules/{rule_id}/restore")
def admin_restore_rule(
    rule_id: int,
    auth: AuthContext = Depends(require_permission(PERMISSION_ITEMS_ARCHIVE)),
    service: AdminSnapCatalogService = Depends(get_admin_snap_catalog_service),
    audit: StandAuditRecorder = Depends(get_stand_audit),
) -> dict[str, Any]:
    _ = auth
    try:
        result = service.restore_rule(rule_id)
    except SnapCatalogAdminError as exc:
        _raise_admin(exc)
        raise
    audit.record(
        "fair_stand.snap_rule.restored",
        "snap_rule",
        rule_id,
        scope=SCOPE_SYSTEM_CATALOG,
    )
    return result
