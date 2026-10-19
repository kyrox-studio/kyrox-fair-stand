from __future__ import annotations

from decimal import Decimal

from app.modules.fair_stand.domain.entities import (
    CatalogCategory,
    CatalogPreview,
    ItemAggregate,
    RuntimeSettings,
    StandDimensions,
)


def _composition_row(component) -> dict:
    row = {"itemKey": component.child_item_key, "quantity": _num(component.quantity)}
    per_band = _num(component.per_band) if component.per_band is not None else 0
    if per_band:
        row["perBand"] = per_band
    if component.height_matched:
        row["heightMatched"] = True
    return row


def _num(value: Decimal | None) -> float | None:
    if value is None:
        return None
    number = float(value)
    return int(number) if number.is_integer() else number


def map_preview(row) -> CatalogPreview:
    return CatalogPreview(
        id=int(row.id),
        display_name=row.display_name,
        markup=row.markup,
        css_code=row.css_code,
        sort_index=row.sort_index,
        is_active=row.is_active,
    )


def map_category(row) -> CatalogCategory:
    return CatalogCategory(
        id=int(row.id),
        catalog_name=row.catalog_name,
        catalog_index=row.catalog_index,
    )


def map_item(row) -> ItemAggregate:
    payload: dict = {
        "itemKey": row.item_key,
        "name": row.name,
        "type": row.item_type,
        "catalogVisible": row.catalog_visible,
        "categoryId": int(row.category_id) if row.category_id is not None else None,
        "catalogItemIndex": row.catalog_item_index,
    }
    if row.unit is not None:
        payload["unit"] = row.unit
    if row.preview_id is not None:
        payload["previewId"] = int(row.preview_id)
    if row.material is not None:
        payload["material"] = row.material
    if row.default_color is not None:
        payload["defaultColor"] = int(row.default_color)
    payload["defaultOpacity"] = _num(row.default_opacity) if row.default_opacity is not None else 1
    if row.preserve_model_scale is not None:
        payload["preserveModelScale"] = row.preserve_model_scale
    if row.model_rotation_y_deg is not None:
        payload["modelRotationYDeg"] = _num(row.model_rotation_y_deg)
    if row.visual_rotation_y_deg is not None:
        payload["visualRotationYDeg"] = _num(row.visual_rotation_y_deg)
    if row.rotation_step_deg is not None:
        payload["rotationStepDeg"] = _num(row.rotation_step_deg)
    if row.default_rotation_deg is not None:
        payload["defaultRotationDeg"] = _num(row.default_rotation_deg)
    if row.side_insert_rotation is not None:
        payload["sideInsertRotation"] = row.side_insert_rotation
    if row.paintable is not None:
        payload["paintable"] = row.paintable
    if row.shape is not None:
        payload["shape"] = row.shape
    if row.variant is not None:
        payload["variant"] = row.variant
    if row.eye_count is not None:
        payload["eyeCount"] = int(row.eye_count)
    payload["isRender"] = bool(row.is_render)
    payload["acceptsColor"] = bool(row.accepts_color)
    payload["acceptsImage"] = bool(row.accepts_image)
    payload["acceptsLightbox"] = bool(row.accepts_lightbox)
    payload["acceptsGlass"] = bool(row.accepts_glass)
    payload["acceptsMesh"] = bool(row.accepts_mesh)
    payload["isCostEnabled"] = bool(row.is_cost_enabled)
    payload["defaultZCm"] = _num(row.default_z_cm) if row.default_z_cm is not None else 0
    if row.snap_requires_rule_id is not None:
        payload["snapRequiresRuleId"] = int(row.snap_requires_rule_id)
        rule = row.snap_requires_rule
        if rule is not None:
            payload["snapRequires"] = rule.key
    if row.snap_provides_rule_id is not None:
        payload["snapProvidesRuleId"] = int(row.snap_provides_rule_id)
        rule = row.snap_provides_rule
        if rule is not None:
            payload["snapProvides"] = rule.key

    if row.dimensions is not None:
        dimensions = {}
        mapping = {
            "widthCm": row.dimensions.width_cm,
            "depthCm": row.dimensions.depth_cm,
            "heightCm": row.dimensions.height_cm,
            "mountHeightCm": row.dimensions.mount_height_cm,
            "wallGapCm": row.dimensions.wall_gap_cm,
        }
        for key, value in mapping.items():
            number = _num(value)
            if number is not None:
                dimensions[key] = number
        if dimensions:
            payload["dimensions"] = dimensions

    if row.scene_dimensions is not None:
        scene = {}
        mapping = {
            "widthCm": row.scene_dimensions.width_cm,
            "depthCm": row.scene_dimensions.depth_cm,
            "heightCm": row.scene_dimensions.height_cm,
        }
        for key, value in mapping.items():
            number = _num(value)
            if number is not None:
                scene[key] = number
        if scene:
            payload["sceneDimensions"] = scene

    if row.strip_occupancy is not None:
        payload["stripOccupancy"] = {
            "align": row.strip_occupancy.align,
            "stripCount": int(row.strip_occupancy.strip_count),
        }

    model_file = next(
        (asset.relative_path for asset in row.assets if asset.asset_role == "model" and asset.is_active),
        None,
    )
    if model_file:
        payload["modelFile"] = model_file
    default_screen = next(
        (
            asset.relative_path
            for asset in row.assets
            if asset.asset_role == "default_screen" and asset.is_active
        ),
        None,
    )
    if default_screen:
        payload["defaultScreenFile"] = default_screen

    components = sorted(row.components, key=lambda component: component.child_item_key)
    if components or row.composition_mode:
        composition: dict = {}
        if row.composition_mode is not None:
            composition["mode"] = row.composition_mode
        if components:
            composition["items"] = [
                _composition_row(component)
                for component in components
            ]
        payload["composition"] = composition

    assembly_rows = sorted(
        row.assembly_parts or [],
        key=lambda part: (part.child_item_key, int(part.instance_index)),
    )
    if assembly_rows:
        payload["assembly"] = {
            "parts": [
                {
                    "childItemKey": part.child_item_key,
                    "instanceIndex": int(part.instance_index),
                    "xCm": _num(part.x_cm),
                    "yCm": _num(part.y_cm),
                    "zCm": _num(part.z_cm),
                    "rotationXDeg": _num(part.rotation_x_deg),
                    "rotationYDeg": _num(part.rotation_y_deg),
                    "rotationZDeg": _num(part.rotation_z_deg),
                    "lockGroupId": int(part.lock_group_id) if part.lock_group_id is not None else None,
                }
                for part in assembly_rows
            ]
        }

    if row.video_wall is not None:
        payload["videoWall"] = {
            "rows": int(row.video_wall.rows),
            "cols": int(row.video_wall.cols),
            "panelItemKey": row.video_wall.panel_item_key,
        }

    if row.body_parts:
        body = {part.body_role: part.child_item_key for part in row.body_parts}
        payload["bodyItems"] = {
            "sideItemKey": body["side"],
            "horizontalItemKey": body["horizontal"],
            "glassShelfItemKey": body["glass_shelf"],
        }

    return ItemAggregate(payload=payload)


def map_stand_dimensions(row) -> StandDimensions:
    return StandDimensions(
        height_cm=_num(row.height_cm),
        depth_cm=_num(row.depth_cm),
        frame_width_cm=_num(row.frame_width_cm),
        frame_depth_cm=_num(row.frame_depth_cm),
        panel_rail_height_cm=_num(row.panel_rail_height_cm),
    )


def stand_dimensions_payload(dimensions: StandDimensions) -> dict:
    return {
        "heightCm": dimensions.height_cm,
        "depthCm": dimensions.depth_cm,
        "frameWidthCm": dimensions.frame_width_cm,
        "frameDepthCm": dimensions.frame_depth_cm,
        "panelRailHeightCm": dimensions.panel_rail_height_cm,
    }


def map_runtime_settings(row) -> RuntimeSettings:
    return RuntimeSettings(
        max_image_upload_mb=int(row.max_image_upload_mb),
        export_button_visible=bool(row.export_button_visible),
        import_button_visible=bool(row.import_button_visible),
        save_as_button_visible=bool(row.save_as_button_visible),
    )


def runtime_settings_payload(settings: RuntimeSettings) -> dict:
    return {
        "maxImageUploadMb": settings.max_image_upload_mb,
        "exportButtonVisible": settings.export_button_visible,
        "importButtonVisible": settings.import_button_visible,
        "saveAsButtonVisible": settings.save_as_button_visible,
    }
