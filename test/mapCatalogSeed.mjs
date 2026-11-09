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

const BOOTH_TYPE_FIXTURE = [
  { key: 'maxima', name: 'Maksima Stand', active: true },
  { key: 'custom', name: 'Özel Tasarım', active: false },
  { key: 'package', name: 'Paket Stand', active: false },
];
// 0091 kuralı: Extra (5) ile Elektronik & Aydınlatma (6) ve katalogda görünmeyenler null.
const ALL_BOOTH_TYPES_CATEGORY_INDEXES = new Set([5, 6]);
// 0093: katalogda görünmeyen Maksima Item'ları (backend booth_type_seed.HIDDEN_MAXIMA_ITEM_KEYS).
const HIDDEN_MAXIMA_ITEM_KEYS = new Set([
  'base_150',
  'base_200',
  'base_top_107_50',
  'base_top_157_50',
  'base_top_206_50',
  'connector_corner',
  'connector_double',
  'connector_single',
  'connector_start',
  'counter_top_102_60',
  'counter_top_110_60',
  'counter_top_150_60',
  'counter_top_160_60',
  'counter_top_210_60',
  'counter_top_52_60',
  'desk_banko_150',
  'desk_banko_150_l',
  'desk_banko_200',
  'desk_banko_200_l',
  'panel_147_5',
  'panel_197',
  'panel_48_5',
  'panel_98',
  'panel_cam_147_5',
  'panel_cam_197',
  'panel_cam_48_5',
  'panel_cam_98',
  'panel_corner_142_5',
  'panel_corner_192',
  'panel_corner_42_5',
  'panel_corner_92',
  'panel_corner_cam_142_5',
  'panel_corner_cam_192',
  'panel_corner_cam_42_5',
  'panel_corner_cam_92',
  'profile_140_5',
  'profile_190',
  'profile_239_5',
  'profile_346_5',
  'profile_388',
  'profile_41_5',
  'profile_437_5',
  'profile_487',
  'profile_8',
  'profile_91',
  'separator_panel_48_5',
  'separator_panel_98',
  'shelf_100',
  'shelf_100_self',
  'shelf_150',
  'shelf_150_self',
  'shelf_200',
  'shelf_200_self',
  'shelf_leg',
  'shelf_row_2',
  'shelf_row_2_100',
  'shelf_row_2_150',
  'shelf_row_2_200',
  'shelf_row_3',
  'shelf_row_3_100',
  'shelf_row_3_150',
  'shelf_row_3_200',
  'showcase_2_body',
  'showcase_horizontal_87_4_30',
  'showcase_side_143_5_30',
  'showcase_side_94_6_30',
  'upright_247_5',
  'upright_297',
  'upright_396',
  'upright_445_5',
  'upright_495',
  'upright_49_5',
  'upright_99',
  'wall_150_350',
  'wall_150_short_1',
  'wall_150_short_2',
  'wall_200_350',
  'wall_200_short_1',
  'wall_200_short_2',
  'wall_50_350',
  'wall_50_short_1',
  'wall_50_short_2',
  'wall_separator_100_350_sarmasik',
  'wall_separator_50_350',
  'wall_separator_50_350_sarmasik',
  'wall_showcase_100_2_350',
]);

export function mapCatalogSeedToBootstrap(seed) {
  const items = seed.items.map(mapItem);
  return {
    revision: 'e2e-fixture',
    boothTypes: BOOTH_TYPE_FIXTURE,
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
    boothTypeKeys: (row.catalog_visible && !ALL_BOOTH_TYPES_CATEGORY_INDEXES.has(row.category_index))
      || HIDDEN_MAXIMA_ITEM_KEYS.has(row.item_key) ? ['maxima'] : null,
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
  // 0079: sıralı parça bölünüşü (sıra korunur).
  if ((row.length_parts || []).length) item.lengthParts = [...row.length_parts];
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
