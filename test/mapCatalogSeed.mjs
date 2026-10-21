import { CATALOG_PREVIEW_KIND_FIXTURE } from './fixtures/catalogPreviewKinds.mjs';
import { applyItemRotationFields } from './itemRotationSeed.mjs';
import { applyItemSurfaceFlags } from './itemSurfaceFlagsSeed.mjs';
import { applyItemSnapFields, SNAP_RULE_FIXTURE } from './itemSnapSeed.mjs';
import { applyItemScenePose } from './itemScenePoseSeed.mjs';
import { applyItemVerticalFields } from './itemVerticalSeed.mjs';
import { buildItemTypeBootstrapRows, ITEM_TYPE_BEHAVIOR_SLICE1 } from './itemTypeBehaviorSeed.mjs';

export const CANONICAL_STAND_DIMENSIONS = Object.freeze({
  heightCm: 350,
  depthCm: 10,
  frameWidthCm: 5.5,
  frameDepthCm: 10,
  panelRailHeightCm: 0.4,
});

export const CANONICAL_RUNTIME_SETTINGS = Object.freeze({
  maxImageUploadMb: 5,
  exportButtonVisible: true,
  importButtonVisible: true,
  saveAsButtonVisible: true,
});

export function mapCatalogSeedToBootstrap(seed) {
  const items = seed.items.map(mapItem);
  return {
    revision: 'e2e-fixture',
    categories: seed.categories.map((category) => ({
      id: category.catalog_index,
      catalogName: category.catalog_name,
      catalogIndex: category.catalog_index,
    })),
    previewKinds: CATALOG_PREVIEW_KIND_FIXTURE,
    items,
    itemTypes: buildItemTypeBootstrapRows([
      ...items.map((item) => item.type),
      ...Object.keys(ITEM_TYPE_BEHAVIOR_SLICE1),
    ]),
    rules: SNAP_RULE_FIXTURE,
    standDimensions: seed.standDimensions ?? CANONICAL_STAND_DIMENSIONS,
    settings: seed.settings ?? CANONICAL_RUNTIME_SETTINGS,
  };
}

function mapItem(row) {
  const item = {
    itemKey: row.item_key,
    name: row.name,
    type: row.item_type,
    catalogVisible: row.catalog_visible,
    categoryId: row.category_index ?? null,
    catalogItemIndex: row.catalog_item_index ?? null,
  };
  const assign = (key, value) => {
    if (value != null) item[key] = value;
  };
  assign('unit', row.unit);
  assign('previewId', row.preview_id);
  assign('material', row.material);
  assign('defaultColor', row.default_color);
  {
    const opacity = Number(row.default_opacity);
    item.defaultOpacity = Number.isFinite(opacity) ? opacity : 1;
  }
  assign('preserveModelScale', row.preserve_model_scale);
  assign('modelRotationYDeg', row.model_rotation_y_deg);
  assign('visualRotationYDeg', row.visual_rotation_y_deg);
  assign('paintable', row.paintable);
  assign('shape', row.shape);
  assign('variant', row.variant);
  assign('eyeCount', row.eye_count);
  if (row.dimensions) {
    const dimensions = {};
    const map = {
      widthCm: row.dimensions.width_cm,
      depthCm: row.dimensions.depth_cm,
      heightCm: row.dimensions.height_cm,
      mountHeightCm: row.dimensions.mount_height_cm,
      wallGapCm: row.dimensions.wall_gap_cm,
    };
    for (const [key, value] of Object.entries(map)) {
      if (value != null) dimensions[key] = value;
    }
    if (Object.keys(dimensions).length) item.dimensions = dimensions;
  }
  if (row.scene_dimensions) {
    const scene = {};
    const map = {
      widthCm: row.scene_dimensions.width_cm,
      depthCm: row.scene_dimensions.depth_cm,
      heightCm: row.scene_dimensions.height_cm,
    };
    for (const [key, value] of Object.entries(map)) {
      if (value != null) scene[key] = value;
    }
    if (Object.keys(scene).length) item.sceneDimensions = scene;
  }
  if (row.strip_occupancy) {
    item.stripOccupancy = {
      align: row.strip_occupancy.align,
      stripCount: row.strip_occupancy.strip_count,
    };
  }
  const model = (row.assets || []).find((asset) => asset.asset_role === 'model');
  if (model) item.modelFile = model.relative_path;
  const screen = (row.assets || []).find((asset) => asset.asset_role === 'default_screen');
  if (screen) item.defaultScreenFile = screen.relative_path;
  if ((row.components || []).length || row.composition_mode) {
    const composition = {};
    if (row.composition_mode != null) composition.mode = row.composition_mode;
    if ((row.components || []).length) {
      composition.items = row.components.map((component) => ({
        itemKey: component.child_item_key,
        quantity: component.quantity,
        ...(component.per_band ? { perBand: component.per_band } : {}),
        ...(component.height_matched ? { heightMatched: true } : {}),
      }));
    }
    item.composition = composition;
  }
  if ((row.width_variants || []).length) item.widthVariants = [...row.width_variants].sort();
  if (row.video_wall) {
    item.videoWall = {
      rows: row.video_wall.rows,
      cols: row.video_wall.cols,
      panelItemKey: row.video_wall.panel_item_key,
    };
  }
  if ((row.body_parts || []).length) {
    const body = Object.fromEntries(row.body_parts.map((part) => [part.body_role, part.child_item_key]));
    item.bodyItems = {
      sideItemKey: body.side,
      horizontalItemKey: body.horizontal,
      glassShelfItemKey: body.glass_shelf,
    };
  }
  assign('rotationStepDeg', row.rotation_step_deg);
  assign('defaultRotationDeg', row.default_rotation_deg);
  assign('sideInsertRotation', row.side_insert_rotation);
  applyItemRotationFields(item);
  applyItemVerticalFields(item);
  if (row.is_render != null) {
    item.isRender = Boolean(row.is_render);
    item.acceptsColor = Boolean(row.accepts_color);
    item.acceptsImage = Boolean(row.accepts_image);
    item.acceptsLightbox = Boolean(row.accepts_lightbox);
    item.acceptsGlass = Boolean(row.accepts_glass);
    item.acceptsMesh = Boolean(row.accepts_mesh);
  } else {
    applyItemSurfaceFlags(item);
  }
  item.isCostEnabled = Boolean(row.is_cost_enabled);
  const defaultZ = Number(row.default_z_cm ?? item.dimensions?.mountHeightCm);
  item.defaultZCm = Number.isFinite(defaultZ) ? defaultZ : 0;
  assign('snapRequires', row.snap_requires);
  assign('snapProvides', row.snap_provides);
  assign('snapRequiresRuleCode', row.snap_requires_rule_code);
  assign('snapProvidesRuleCode', row.snap_provides_rule_code);
  applyItemSnapFields(item);
  applyItemScenePose(item);
  return item;
}
