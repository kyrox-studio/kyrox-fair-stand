import { normalizeStripOccupancy } from './stripOccupancy.js';
import { clearDuplicateLock } from './moduleLock.js';
import {
  resolveAutomaticWallFlatPanelItemKey,
  resolveFlatPanelStripCount,
  resolveShowcaseStripCount,
  getCommercialItemForType,
  getFurnitureClusterQuantity,
  getFurnitureItemForType,
  getItem,
  getTopLightItemForType,
  getShowcaseBodyDefinition,
  getShowcaseItemKeyForType,
  itemDefaultColorCss,
  getItemType,
  itemHasSceneRender,
  listEmbeddedRenderParts,
  requireSceneDimension,
  resolveItemKey,
  resolveSceneDimensions,
} from './items.js';
import { getItemSurfaceCapabilities } from './itemCapabilities.js';
import { resolveWallPanelBandPitchCm } from './wallPanelBand.js';
import { clampFloorRelativeBottomZCm } from './modulePlacement.js';

function separatorDefaultColor(widthCm) {
  const itemKey = Number(widthCm) === 50 ? 'separator_panel_48_5' : 'separator_panel_98';
  return itemDefaultColorCss(itemKey);
}

function createId(prefix) {
  const suffix = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${suffix}`;
}

function factoryDescriptorFromItem(item) {
  const scene = resolveSceneDimensions(item);
  const descriptor = {
    itemKey: item.itemKey,
    type: item.type,
  };
  if (scene.widthCm != null) descriptor.widthCm = scene.widthCm;
  if (scene.depthCm != null) descriptor.depthCm = scene.depthCm;
  if (scene.heightCm != null) descriptor.heightCm = scene.heightCm;
  if (item.videoWall) {
    descriptor.videoWallRows = item.videoWall.rows;
    descriptor.videoWallCols = item.videoWall.cols;
  }
  if (item.variant) descriptor.variant = item.variant;
  if (item.stripOccupancy) descriptor.stripOccupancy = item.stripOccupancy;
  if (item.eyeCount != null) descriptor.eyeCount = item.eyeCount;
  if (item.shape === 'L') descriptor.shape = 'L';
  if (item.modelFile) descriptor.modelFile = item.modelFile;
  if (item.modelRotationYDeg != null) descriptor.modelRotationYDeg = item.modelRotationYDeg;
  if (item.preserveModelScale != null) descriptor.preserveModelScale = item.preserveModelScale;
  if (item.unit != null) descriptor.unit = item.unit;
  if (item.visualRotationYDeg != null) descriptor.visualRotationYDeg = item.visualRotationYDeg;
  return descriptor;
}

function applySceneFootprint(state, item, requiredFields = []) {
  const scene = resolveSceneDimensions(item);
  for (const field of requiredFields) {
    requireSceneDimension(item, field);
  }
  if (scene.widthCm != null) state.widthCm = scene.widthCm;
  if (scene.depthCm != null) state.depthCm = scene.depthCm;
  if (scene.heightCm != null) state.heightCm = scene.heightCm;
  return state;
}

export function createDefaultImageTransform() {
  return {
    mode: 'single',
    offsetX: 0,
    offsetY: 0,
    repeatX: 1,
    repeatY: 1,
    rotation: 0,
  };
}

function itemDefaultColorHex(item) {
  return itemDefaultColorCss(item);
}

function recipeSurfaceColor(parentItem, partTypes) {
  const part = listEmbeddedRenderParts(parentItem)
    .find((row) => partTypes.includes(row.type) && Number.isInteger(row.defaultColor));
  if (part) return itemDefaultColorCss(part);
  if (Number.isInteger(parentItem?.defaultColor)) return itemDefaultColorCss(parentItem);
  throw new TypeError(`Missing canonical defaultColor for ${parentItem?.itemKey ?? 'unknown Item'}.`);
}

function createEditableItemSurfaceState(item, stripIndex = null) {
  const capabilities = getItemSurfaceCapabilities(item);
  if (!capabilities.color && !capabilities.image) {
    throw new TypeError(`Editable surface capability is required for ${item?.itemKey ?? 'unknown Item'}.`);
  }
  return {
    id: createId('surface'),
    itemKey: item.itemKey,
    stripIndex,
    ...(capabilities.color ? { color: itemDefaultColorHex(item) } : {}),
    ...(capabilities.image ? { imageAssetId: null, imageTransform: createDefaultImageTransform() } : {}),
  };
}

function createEmbeddedPartSurface(item, stripIndex = null) {
  const color = itemDefaultColorCss(item);
  const scene = resolveSceneDimensions(item);
  return {
    id: createId('surface'),
    itemKey: item.itemKey,
    stripIndex,
    color,
    widthCm: scene.widthCm ?? null,
    heightCm: scene.heightCm ?? null,
    depthCm: scene.depthCm ?? null,
    imageAssetId: null,
    imageTransform: createDefaultImageTransform(),
  };
}

function takeParts(parts, type) {
  const matched = [];
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    if (parts[index].type !== type) continue;
    matched.push(parts[index]);
    parts.splice(index, 1);
  }
  return matched.reverse();
}

function createEditablePanelState(stripIndex, color) {
  return {
    id: createId('surface'),
    stripIndex,
    color,
    imageAssetId: null,
    imageTransform: createDefaultImageTransform(),
  };
}

function renderPartSurfaces(parentItem, partTypes) {
  return listEmbeddedRenderParts(parentItem)
    .filter((part) => partTypes.includes(part.type))
    .map((part, index) => createEmbeddedPartSurface(part, index));
}

function embeddedRenderParts(parentItem, partTypes) {
  return listEmbeddedRenderParts(parentItem)
    .filter((part) => partTypes.includes(part.type));
}

function stampRenderParts(surfaces, parentItem, partTypes) {
  const parts = embeddedRenderParts(parentItem, partTypes);
  surfaces.forEach((surface, index) => {
    const part = parts[index];
    if (!part || !surface) return;
    const stamped = createEmbeddedPartSurface(part, surface.stripIndex ?? index);
    surface.itemKey = stamped.itemKey;
    surface.widthCm = stamped.widthCm;
    surface.heightCm = stamped.heightCm;
    surface.depthCm = stamped.depthCm;
    if (Number.isInteger(part.defaultColor)) surface.color = stamped.color;
  });
}

/** Saved strips keep the image. A missing panel identity comes from the parent recipe. */
function ensureMissingRenderPartMeasure(surfaces, parentItem, partTypes) {
  if (!Array.isArray(surfaces) || !parentItem) return;
  const parts = embeddedRenderParts(parentItem, partTypes);
  surfaces.forEach((surface, index) => {
    const part = parts[index];
    if (!part || !surface || typeof surface !== 'object' || surface.itemKey) return;
    const scene = resolveSceneDimensions(part);
    surface.itemKey = part.itemKey;
    if (!(Number(surface.widthCm) > 0)) surface.widthCm = scene.widthCm ?? null;
    if (!(Number(surface.heightCm) > 0)) surface.heightCm = scene.heightCm ?? null;
    if (!(Number(surface.depthCm) > 0)) surface.depthCm = scene.depthCm ?? null;
  });
}

function topRenderParts(parentItem) {
  return listEmbeddedRenderParts(parentItem)
    .filter((part) => part.type === 'base-top' || part.type === 'counter-top')
    .map((part) => createEmbeddedPartSurface(part, null));
}

function resolveFlatPanelItemKey(widthCmOrDescriptor) {
  if (widthCmOrDescriptor && typeof widthCmOrDescriptor === 'object' && !Array.isArray(widthCmOrDescriptor)) {
    const explicitKey = widthCmOrDescriptor.itemKey ?? null;
    if (explicitKey && getItem(explicitKey)?.type === 'flat-panel') return explicitKey;
    return resolveAutomaticWallFlatPanelItemKey(widthCmOrDescriptor.widthCm);
  }
  return resolveAutomaticWallFlatPanelItemKey(widthCmOrDescriptor);
}

export function createFlatPanelModuleState(widthCmOrDescriptor) {
  const itemKey = resolveFlatPanelItemKey(widthCmOrDescriptor);
  const item = itemKey ? getItem(itemKey) : null;
  if (!item || item.type !== 'flat-panel') return null;
  const occupancy = normalizeStripOccupancy(item.stripOccupancy);
  const pitchCm = Math.round(Number(resolveWallPanelBandPitchCm()));
  const stripCount = resolveFlatPanelStripCount(item);
  const moduleHeightCm = stripCount * pitchCm;

  const state = {
    id: createId('module'),
    itemKey: item.itemKey,
    type: item.type,
    heightCm: moduleHeightCm,
    ...(occupancy ? { stripOccupancy: occupancy } : {}),
    strips: Array.from(
      { length: stripCount },
      (_, stripIndex) => createEditablePanelState(
        stripIndex,
        recipeSurfaceColor(item, ['panel', 'separator-panel']),
      ),
    ),
  };
  stampRenderParts(state.strips, item, ['panel', 'separator-panel']);
  applySceneFootprint(state, item, ['widthCm']);
  state.heightCm = moduleHeightCm;
  return state;
}

const SEPARATOR_PLAIN_WIDTH_TO_ITEM_KEY = Object.freeze({
  50: 'wall_separator_50_350',
  100: 'wall_separator_100_350',
});

function resolveSeparatorItemKey(widthCmOrDescriptor, descriptor = {}) {
  if (widthCmOrDescriptor && typeof widthCmOrDescriptor === 'object' && !Array.isArray(widthCmOrDescriptor)) {
    const explicitKey = widthCmOrDescriptor.itemKey ?? null;
    if (explicitKey && getItem(explicitKey)?.type === 'separator') return explicitKey;
    if (widthCmOrDescriptor.modelFile) return null;
    return SEPARATOR_PLAIN_WIDTH_TO_ITEM_KEY[Number(widthCmOrDescriptor.widthCm)] ?? null;
  }

  if (descriptor.itemKey && getItem(descriptor.itemKey)?.type === 'separator') {
    return descriptor.itemKey;
  }

  return SEPARATOR_PLAIN_WIDTH_TO_ITEM_KEY[Number(widthCmOrDescriptor)] ?? null;
}

export function createSeparatorModuleState(widthCmOrDescriptor, descriptor = {}) {
  const itemKey = resolveSeparatorItemKey(widthCmOrDescriptor, descriptor);
  const item = itemKey ? getItem(itemKey) : null;
  if (!item || item.type !== 'separator') return null;

  const state = {
    id: createId('module'),
    itemKey: item.itemKey,
    type: item.type,
    modelFile: item.modelFile ?? null,
    surface: {
      id: createId('surface'),
      color: separatorDefaultColor(requireSceneDimension(item, 'widthCm')),
    },
  };
  stampRenderParts([state.surface], item, ['separator-panel', 'panel']);
  return applySceneFootprint(state, item, ['widthCm', 'depthCm', 'heightCm']);
}

export function createShowcaseModuleState(type, widthCm = 100) {
  const itemKey = getShowcaseItemKeyForType(type);
  if (!itemKey) return null;
  const showcaseItem = getItem(itemKey);
  const canonicalWidthCm = resolveSceneDimensions(showcaseItem).widthCm;
  if (!showcaseItem || canonicalWidthCm == null || Number(widthCm) !== Number(canonicalWidthCm)) {
    return null;
  }
  const bodyDefinition = getShowcaseBodyDefinition(showcaseItem);
  const pitchCm = Math.round(Number(resolveWallPanelBandPitchCm()));
  const stripCount = resolveShowcaseStripCount(showcaseItem);
  const ceilingHeightCm = requireSceneDimension(showcaseItem, 'heightCm');
  const moduleHeightCm = Math.min(stripCount * pitchCm, ceilingHeightCm);

  const state = {
    id: createId('module'),
    itemKey: showcaseItem.itemKey,
    type: showcaseItem.type,
    eyeCount: Number(showcaseItem.eyeCount),
    heightCm: moduleHeightCm,
    strips: Array.from(
      { length: stripCount },
      (_, stripIndex) => createEditablePanelState(
        stripIndex,
        recipeSurfaceColor(showcaseItem, ['panel', 'separator-panel']),
      ),
    ),
    bodySurface: {
      id: createId('surface'),
      color: itemDefaultColorHex(bodyDefinition.sideItem),
      itemKey: bodyDefinition.sideItem.itemKey,
    },
  };
  stampRenderParts(state.strips, showcaseItem, ['panel', 'separator-panel']);
  return applySceneFootprint(state, showcaseItem, ['widthCm']);
}

export function createDoorModuleState(widthCmOrDescriptor = 100) {
  const doorItem = getItem('wall_door_100_350');
  if (!doorItem || doorItem.type !== 'door') return null;
  const canonicalWidthCm = resolveSceneDimensions(doorItem).widthCm;
  if (canonicalWidthCm == null || !Number.isFinite(Number(canonicalWidthCm))) return null;
  const requestedWidthCm = typeof widthCmOrDescriptor === 'object' && widthCmOrDescriptor !== null
    ? (widthCmOrDescriptor.widthCm ?? canonicalWidthCm)
    : widthCmOrDescriptor;
  if (Number(requestedWidthCm) !== Number(canonicalWidthCm)) return null;
  const doorLeafItem = getItem('door_leaf_100');
  if (!doorLeafItem) throw new TypeError('Missing canonical door leaf Item door_leaf_100.');

  const state = applySceneFootprint({
    id: createId('module'),
    itemKey: doorItem.itemKey,
    type: doorItem.type,
    strips: Array.from(
      { length: 3 },
      (_, index) => createEditablePanelState(
        index + 4,
        recipeSurfaceColor(doorItem, ['panel', 'separator-panel']),
      ),
    ),
    surface: createEditableItemSurfaceState(doorLeafItem),
  }, doorItem, ['widthCm', 'depthCm', 'heightCm']);
  stampRenderParts(state.strips, doorItem, ['panel', 'separator-panel']);
  return state;
}

const COUNTER_WIDTH_SHAPE_TO_ITEM_KEY = Object.freeze({
  '100': 'desk_banko_100',
  '150': 'desk_banko_150',
  '200': 'desk_banko_200',
  '100_L': 'desk_banko_100_l',
  '150_L': 'desk_banko_150_l',
  '200_L': 'desk_banko_200_l',
});

function counterFaceUsesWidePanel(faceKey, parentItem) {
  if (parentItem?.shape === 'L') {
    return faceKey.startsWith('front') || faceKey.startsWith('right');
  }
  return faceKey.startsWith('front');
}

function counterPanelSpanCm(part) {
  const span = Number(resolveSceneDimensions(part)?.widthCm);
  return span > 0 ? span : null;
}

function selectCounterPanel(parts, wide) {
  let best = null;
  let bestSpan = wide ? -Infinity : Infinity;
  for (const part of parts) {
    const span = counterPanelSpanCm(part);
    if (!(span > 0)) continue;
    if (wide ? span > bestSpan : span < bestSpan) {
      best = part;
      bestSpan = span;
    }
  }
  return best;
}

/**
 * Banko yüzü panelini reçete listesinin sırasından almaz.
 * Katalog child satırını ada göre sıralayınca panel_48_5, panel_98'den önce gelir
 * ve indeks damgası ön yüze dar paneli yazar.
 * Düz bankoda ön geniş, yanlar dar. L bankoda ön ve sağ geniş, sol ve dönüş dar.
 * stamp oluştururken kimliği yazar. repair açılışta reçetedeki yanlış kimliği düzeltir;
 * reçetede olmayan itemKey, görsel, renk ve kumaş durur.
 */
export function applyCounterFacePanelIdentity(faces, parentItem, mode) {
  if (!faces || typeof faces !== 'object' || !parentItem) return;
  const parts = embeddedRenderParts(parentItem, ['panel', 'separator-panel']);
  const recipeKeys = new Set(parts.map((part) => part.itemKey));
  for (const [faceKey, surface] of Object.entries(faces)) {
    if (!surface || typeof surface !== 'object') continue;
    const part = selectCounterPanel(parts, counterFaceUsesWidePanel(faceKey, parentItem));
    if (!part) continue;
    if (mode === 'stamp') {
      const stamped = createEmbeddedPartSurface(part, surface.stripIndex ?? null);
      surface.itemKey = stamped.itemKey;
      surface.widthCm = stamped.widthCm;
      surface.heightCm = stamped.heightCm;
      surface.depthCm = stamped.depthCm;
      if (Number.isInteger(part.defaultColor)) surface.color = stamped.color;
      continue;
    }
    const current = surface.itemKey;
    if (current && current !== part.itemKey && !recipeKeys.has(current)) continue;
    const scene = resolveSceneDimensions(part);
    if (current === part.itemKey) {
      if (!(Number(surface.widthCm) > 0)) surface.widthCm = scene.widthCm ?? null;
      if (!(Number(surface.heightCm) > 0)) surface.heightCm = scene.heightCm ?? null;
      if (!(Number(surface.depthCm) > 0)) surface.depthCm = scene.depthCm ?? null;
      continue;
    }
    surface.itemKey = part.itemKey;
    surface.widthCm = scene.widthCm ?? null;
    surface.heightCm = scene.heightCm ?? null;
    surface.depthCm = scene.depthCm ?? null;
  }
}

function resolveCounterItemKey(widthCmOrDescriptor, options = {}) {
  if (widthCmOrDescriptor && typeof widthCmOrDescriptor === 'object' && !Array.isArray(widthCmOrDescriptor)) {
    const explicitKey = widthCmOrDescriptor.itemKey ?? null;
    if (explicitKey && getItem(explicitKey)?.type === 'counter') return explicitKey;
    const width = Number(widthCmOrDescriptor.widthCm);
    const shape = widthCmOrDescriptor.shape === 'L' || options.shape === 'L' ? 'L' : 'straight';
    const mapKey = shape === 'L' ? `${width}_L` : String(width);
    return COUNTER_WIDTH_SHAPE_TO_ITEM_KEY[mapKey] ?? null;
  }
  const width = Number(widthCmOrDescriptor);
  const shape = options.shape === 'L' ? 'L' : 'straight';
  const mapKey = shape === 'L' ? `${width}_L` : String(width);
  return COUNTER_WIDTH_SHAPE_TO_ITEM_KEY[mapKey] ?? null;
}

export function createCounterModuleState(widthCmOrDescriptor, options = {}) {
  const itemKey = resolveCounterItemKey(widthCmOrDescriptor, options);
  const item = itemKey ? getItem(itemKey) : null;
  if (!item || item.type !== 'counter') return null;
  const shape = item.shape === 'L' ? 'L' : 'straight';
  const counterFaceColor = recipeSurfaceColor(item, ['panel', 'separator-panel']);
  const faces = {
    frontLower: createEditablePanelState(null, counterFaceColor),
    frontUpper: createEditablePanelState(null, counterFaceColor),
    leftLower: createEditablePanelState(null, counterFaceColor),
    leftUpper: createEditablePanelState(null, counterFaceColor),
    rightLower: createEditablePanelState(null, counterFaceColor),
    rightUpper: createEditablePanelState(null, counterFaceColor),
  };
  if (shape === 'L') {
    faces.returnLower = createEditablePanelState(null, counterFaceColor);
    faces.returnUpper = createEditablePanelState(null, counterFaceColor);
  }
  applyCounterFacePanelIdentity(faces, item, 'stamp');
  const state = applySceneFootprint({
    id: createId('module'),
    itemKey: item.itemKey,
    type: item.type,
    shape,
    faces,
  }, item, ['widthCm', 'depthCm', 'heightCm']);
  state.renderParts = { tops: topRenderParts(item) };
  return state;
}

const BASE_WIDTH_TO_ITEM_KEY = Object.freeze({
  100: 'base_100',
  150: 'base_150',
  200: 'base_200',
});

function resolveBaseItemKey(widthCmOrDescriptor) {
  if (widthCmOrDescriptor && typeof widthCmOrDescriptor === 'object' && !Array.isArray(widthCmOrDescriptor)) {
    const explicitKey = widthCmOrDescriptor.itemKey ?? null;
    if (explicitKey && getItem(explicitKey)?.type === 'base') return explicitKey;
    return BASE_WIDTH_TO_ITEM_KEY[Number(widthCmOrDescriptor.widthCm)] ?? null;
  }
  return BASE_WIDTH_TO_ITEM_KEY[Number(widthCmOrDescriptor)] ?? null;
}

export function createBaseModuleState(widthCmOrDescriptor) {
  const itemKey = resolveBaseItemKey(widthCmOrDescriptor);
  const item = itemKey ? getItem(itemKey) : null;
  if (!item || item.type !== 'base') return null;
  const baseFaceColor = recipeSurfaceColor(item, ['panel', 'separator-panel']);

  const faces = {
    front: createEditablePanelState(null, baseFaceColor),
    left: createEditablePanelState(null, baseFaceColor),
    right: createEditablePanelState(null, baseFaceColor),
  };
  stampRenderParts(Object.values(faces), item, ['panel', 'separator-panel']);
  const state = applySceneFootprint({
    id: createId('module'),
    itemKey: item.itemKey,
    type: item.type,
    faces,
  }, item, ['widthCm', 'depthCm', 'heightCm']);
  state.renderParts = { tops: topRenderParts(item) };
  return state;
}

function createFurnitureModuleState(type) {
  const item = getFurnitureItemForType(type);
  if (!item) return null;
  const state = {
    id: createId('module'),
    itemKey: item.itemKey,
    type: item.type,
  };
  applySceneFootprint(state, item, ['widthCm', 'depthCm', 'heightCm']);
  if (type !== 'table-glass' && type !== 'coffee-table-classic') {
    state.surface = {
      id: createId('surface'),
      color: itemDefaultColorCss(item),
    };
  }
  if (Object.hasOwn(item, 'visualRotationYDeg')) {
    state.visualRotationYDeg = item.visualRotationYDeg;
  }
  const chairCount = getFurnitureClusterQuantity(item, 'chair_eames');
  if (chairCount != null) state.chairCount = chairCount;
  return state;
}

export function createBeigeSofaSetModuleState() {
  return createFurnitureModuleState('sofa-set-classic');
}

export function createSofaSingleClassicModuleState() {
  return createFurnitureModuleState('sofa-single-classic');
}

export function createSofaDoubleClassicModuleState() {
  return createFurnitureModuleState('sofa-double-classic');
}

export function createCoffeeTableClassicModuleState() {
  return createFurnitureModuleState('coffee-table-classic');
}

export function createEamesTableChairSetModuleState() {
  return createFurnitureModuleState('table-chair-set-eames');
}

export function createEamesChairModuleState() {
  return createFurnitureModuleState('chair');
}

export function createGlassTableModuleState() {
  return createFurnitureModuleState('table-glass');
}

export function createBarStoolModuleState() {
  return createFurnitureModuleState('bar-stool');
}

function createCommercialModuleState(type) {
  const item = getCommercialItemForType(type);
  const state = {
    id: createId('module'), itemKey: item.itemKey,
    type: item.type,
  };
  applySceneFootprint(state, item, ['widthCm', 'depthCm', 'heightCm']);
  if (Object.hasOwn(item, 'preserveModelScale')) {
    state.modelFile = item.modelFile;
    state.modelRotationYDeg = item.modelRotationYDeg;
    state.visualRotationYDeg = item.visualRotationYDeg;
    state.preserveModelScale = item.preserveModelScale;
  }
  return state;
}

export function createMiniFridgeModuleState() {
  return createCommercialModuleState('mini-fridge');
}

export function createKettleModuleState() {
  return createCommercialModuleState('kettle');
}

export function createCoatRackModuleState() {
  return createCommercialModuleState('coat-rack');
}

export function createUprightModuleState(descriptor = {}) {
  const itemKey = descriptor.itemKey ?? 'upright_346_5';
  const item = getItem(itemKey);
  if (!item || item.type !== 'upright') return null;
  return applySceneFootprint({
    id: createId('module'),
    itemKey: item.itemKey,
    type: item.type,
  }, item, ['widthCm', 'depthCm', 'heightCm']);
}

export function createProfileModuleState(descriptor = {}) {
  const itemKey = descriptor.itemKey ?? null;
  const item = itemKey ? getItem(itemKey) : null;
  if (!item || item.type !== 'profile') return null;
  return applySceneFootprint({
    id: createId('module'),
    itemKey: item.itemKey,
    type: item.type,
  }, item, ['widthCm', 'depthCm', 'heightCm']);
}

export function createPlasticTrashBinModuleState() {
  return createCommercialModuleState('plastic-trash-bin');
}

export const BOX_BLOCK_FACE_SLOTS = Object.freeze(['front', 'right', 'back', 'left']);

function boxBlockFaceSizeCm(moduleState, slot) {
  const heightCm = Math.max(1, Number(moduleState?.heightCm) || 50);
  const spanCm = slot === 'right' || slot === 'left'
    ? Math.max(1, Number(moduleState?.depthCm) || 50)
    : Math.max(1, Number(moduleState?.widthCm) || 100);
  return { widthCm: spanCm, heightCm };
}

export function ensureBoxBlockFaces(moduleState, item = null) {
  if (!moduleState || typeof moduleState !== 'object') return moduleState;
  const fallbackColor = typeof moduleState.surface?.color === 'string' && moduleState.surface.color
    ? moduleState.surface.color
    : itemDefaultColorCss(item ?? moduleState.itemKey);
  if (!moduleState.faces || typeof moduleState.faces !== 'object' || Array.isArray(moduleState.faces)) {
    moduleState.faces = {};
  }
  for (const slot of BOX_BLOCK_FACE_SLOTS) {
    const size = boxBlockFaceSizeCm(moduleState, slot);
    const existing = moduleState.faces[slot];
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
      moduleState.faces[slot] = {
        id: createId('surface'),
        color: fallbackColor,
        ...size,
      };
      continue;
    }
    if (!existing.id) existing.id = createId('surface');
    if (typeof existing.color !== 'string' || !existing.color) existing.color = fallbackColor;
    existing.widthCm = size.widthCm;
    existing.heightCm = size.heightCm;
  }
  return moduleState;
}

function clampOpacity(value, fallback = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(1, Math.max(0, number));
}

export function createTulleFabricModuleState(descriptor = {}) {
  const itemKey = descriptor?.itemKey ?? 'tulle_fabric';
  const item = getItem(itemKey);
  if (!item || item.type !== 'tulle-fabric') return null;

  const state = {
    id: createId('module'),
    itemKey: item.itemKey,
    type: item.type,
    surface: {
      id: createId('surface'),
      color: itemDefaultColorCss(item),
    },
  };
  applySceneFootprint(state, item, ['widthCm', 'depthCm', 'heightCm']);
  const widthCm = Number(descriptor.widthCm);
  const heightCm = Number(descriptor.heightCm);
  if (Number.isFinite(widthCm) && widthCm > 0) state.widthCm = widthCm;
  if (Number.isFinite(heightCm) && heightCm > 0) state.heightCm = heightCm;
  state.depthCm = requireSceneDimension(item, 'depthCm');
  return state;
}

export function createBoxBlockModuleState(descriptor = {}) {
  const itemKey = descriptor?.itemKey ?? 'box_block';
  const item = getItem(itemKey);
  if (!item || item.type !== 'box-block') return null;

  const defaultOpacity = clampOpacity(item.defaultOpacity, 1);
  const state = {
    id: createId('module'),
    itemKey: item.itemKey,
    type: item.type,
    opacity: clampOpacity(descriptor.opacity, defaultOpacity),
    surface: {
      id: createId('surface'),
      color: itemDefaultColorCss(item),
    },
  };
  applySceneFootprint(state, item, ['widthCm', 'depthCm', 'heightCm']);
  const widthCm = Number(descriptor.widthCm);
  const depthCm = Number(descriptor.depthCm);
  const heightCm = Number(descriptor.heightCm);
  if (Number.isFinite(widthCm) && widthCm > 0) state.widthCm = widthCm;
  if (Number.isFinite(depthCm) && depthCm > 0) state.depthCm = depthCm;
  if (Number.isFinite(heightCm) && heightCm > 0) state.heightCm = heightCm;
  ensureBoxBlockFaces(state, item);
  return state;
}

function isIndoorPlantItem(item) {
  return item?.type === 'indoor-plant-1' && Boolean(item?.itemKey);
}

function resolveIndoorPlantItemKey(descriptor = {}) {
  if (descriptor && typeof descriptor === 'object' && !Array.isArray(descriptor)) {
    const explicitKey = descriptor.itemKey ?? null;
    if (explicitKey && isIndoorPlantItem(getItem(explicitKey))) return explicitKey;
  }
  return null;
}

export function createIndoorPlantModuleState(descriptor = {}) {
  const hasDescriptorFields = descriptor
    && typeof descriptor === 'object'
    && !Array.isArray(descriptor)
    && (
      descriptor.itemKey
      || descriptor.modelFile
      || descriptor.widthCm != null
      || descriptor.depthCm != null
      || descriptor.heightCm != null
    );
  const itemKey = hasDescriptorFields
    ? resolveIndoorPlantItemKey(descriptor)
    : 'extra_indoor_plant_1';
  const item = itemKey ? getItem(itemKey) : null;
  if (!isIndoorPlantItem(item)) return null;

  const modelFile = item.modelFile;
  const isLongPlanter = item.preserveModelScale === true;
  const state = {
    id: createId('module'),
    itemKey: item.itemKey,
    type: item.type,
    modelFile,
    modelRotationYDeg: Number(item.modelRotationYDeg) || 0,
    preserveModelScale: Boolean(item.preserveModelScale),
    ...(isLongPlanter ? {
      surface: {
        id: createId('surface'),
        color: itemDefaultColorCss(item),
      },
    } : {}),
  };
  return applySceneFootprint(state, item, ['widthCm', 'depthCm', 'heightCm']);
}

export function createIlluminatedFoamModuleState(imageAssetId, descriptor = {}) {
  const item = getItem('illuminated-foam');
  const scene = resolveSceneDimensions(item);
  const widthCm = Math.max(10, Number(descriptor.widthCm) || scene.widthCm);
  const heightCm = Math.max(5, Number(descriptor.heightCm) || scene.heightCm);
  return {
    id: createId('module'),
    itemKey: item.itemKey,
    type: item.type,
    imageAssetId,
    widthCm,
    heightCm,
    depthCm: requireSceneDimension(item, 'depthCm'),
    wallGapCm: Number(item.dimensions.wallGapCm),
    haloColor: /^#[0-9a-fA-F]{6}$/.test(String(descriptor.haloColor ?? '')) ? String(descriptor.haloColor).toLowerCase() : '#ffffff',
  };
}

export function createTvModuleState(descriptor = {}) {
  const itemKey = descriptor?.itemKey ?? null;
  const item = itemKey ? getItem(itemKey) : null;
  if (item?.type !== 'tv') return null;
  const state = {
    id: createId('module'),
    itemKey: item.itemKey,
    type: item.type,
    videoWallRows: item.videoWall?.rows ?? 1,
    videoWallCols: item.videoWall?.cols ?? 1,
  };
  return applySceneFootprint(state, item, ['widthCm', 'depthCm', 'heightCm']);
}

export function createShelfModuleState(descriptor = {}) {
  const itemKey = descriptor?.itemKey;
  const item = itemKey ? getItem(itemKey) : null;
  if (item?.type !== 'shelf') return null;
  const state = {
    id: createId('module'),
    itemKey: item.itemKey,
    type: item.type,
    shelfLightingOn: Boolean(descriptor.shelfLightingOn),
  };
  return applySceneFootprint(state, item, ['widthCm', 'depthCm', 'heightCm']);
}

export function createLedFloodlightModuleState() {
  const item = getTopLightItemForType('led-floodlight');
  return applySceneFootprint({
    id: createId('module'),
    itemKey: item.itemKey,
    type: item.type,
    surface: {
      id: createId('surface'),
      color: itemDefaultColorCss(item),
    },
  }, item, ['widthCm', 'depthCm', 'heightCm']);
}

const MODULE_STATE_FACTORIES = Object.freeze({
  'flat-panel': (descriptor) => createFlatPanelModuleState(descriptor),
  base: (descriptor) => createBaseModuleState(descriptor),
  counter: (descriptor) => createCounterModuleState(descriptor),
  separator: (descriptor) => createSeparatorModuleState(descriptor),
  'sofa-set-classic': () => createBeigeSofaSetModuleState(),
  'sofa-single-classic': () => createSofaSingleClassicModuleState(),
  'sofa-double-classic': () => createSofaDoubleClassicModuleState(),
  'coffee-table-classic': () => createCoffeeTableClassicModuleState(),
  'table-chair-set-eames': () => createEamesTableChairSetModuleState(),
  chair: () => createEamesChairModuleState(),
  'table-glass': () => createGlassTableModuleState(),
  'bar-stool': () => createBarStoolModuleState(),
  'mini-fridge': () => createMiniFridgeModuleState(),
  kettle: () => createKettleModuleState(),
  'coat-rack': () => createCoatRackModuleState(),
  upright: (descriptor) => createUprightModuleState(descriptor),
  profile: (descriptor) => createProfileModuleState(descriptor),
  'plastic-trash-bin': () => createPlasticTrashBinModuleState(),
  'box-block': (descriptor) => createBoxBlockModuleState(descriptor),
  'tulle-fabric': (descriptor) => createTulleFabricModuleState(descriptor),
  'indoor-plant-1': (descriptor) => createIndoorPlantModuleState(descriptor),
  tv: (descriptor) => createTvModuleState(descriptor),
  shelf: (descriptor) => createShelfModuleState(descriptor),
  'led-floodlight': () => createLedFloodlightModuleState(),
  door: (descriptor) => createDoorModuleState(descriptor),
  'showcase-2': (descriptor) => createShowcaseModuleState(descriptor.type, descriptor.widthCm),
  'showcase-3': (descriptor) => createShowcaseModuleState(descriptor.type, descriptor.widthCm),
  'illuminated-foam': (descriptor, options) => createIlluminatedFoamModuleState(
    options.imageAssetId ?? descriptor.imageAssetId ?? null,
    descriptor,
  ),
});

export const MODULE_STATE_TYPES = Object.freeze(Object.keys(MODULE_STATE_FACTORIES));

function assertSceneCapableType(type) {
  if (!type) return;
  const dbType = getItemType(type);
  if (dbType && typeof dbType.placement !== 'string') {
    throw new TypeError(`Item type "${type}" has no scene behavior.`);
  }
}

export function createModuleStateFromDescriptor(
  descriptor,
  { itemKey = null, preservePlacement = false, imageAssetId = null } = {},
) {
  if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) return null;

  const resolvedItemKey = resolveItemKey({
    ...descriptor,
    itemKey: itemKey ?? descriptor.itemKey ?? null,
  });
  const item = resolvedItemKey ? getItem(resolvedItemKey) : null;
  assertSceneCapableType(item?.type ?? descriptor.type);
  if (item && !itemHasSceneRender(item)) return null;
  const merged = item
    ? Object.assign({}, factoryDescriptorFromItem(item), descriptor, {
      itemKey: item.itemKey,
      type: item.type,
    })
    : { ...descriptor };

  const factory = MODULE_STATE_FACTORIES[merged.type];
  if (!factory) return null;

  const state = factory(merged, { imageAssetId });
  if (!state) return null;

  if (item) state.itemKey = item.itemKey;
  if (state.type === 'shelf' && !hasCanonicalModuleItemKey(state)) return null;

  if (preservePlacement && descriptor.placement) {
    state.placement = { ...descriptor.placement };
  }
  return state;
}

export function createModuleStateFromCatalogKey(moduleKey, options = {}) {
  const item = typeof moduleKey === 'string' && moduleKey ? getItem(moduleKey) : null;
  if (item) assertSceneCapableType(item.type);
  if (!itemHasSceneRender(item)) return null;
  return createModuleStateFromDescriptor(item, {
    ...options,
    itemKey: item.itemKey,
  });
}

export function hasCanonicalModuleItemKey(moduleState) {
  if (!moduleState || typeof moduleState !== 'object') return false;
  const item = moduleState.itemKey ? getItem(moduleState.itemKey) : null;
  if (!item) return false;
  if (moduleState.type && item.type !== moduleState.type) return false;
  return true;
}


const LEGACY_WALL_SHORT_ITEM_KEYS = Object.freeze({
  wall_200_short_up_1: 'wall_200_short_1',
  wall_150_short_up_1: 'wall_150_short_1',
  wall_100_short_up_1: 'wall_100_short_1',
  wall_50_short_up_1: 'wall_50_short_1',
  wall_200_short_up_2: 'wall_200_short_2',
  wall_150_short_up_2: 'wall_150_short_2',
  wall_100_short_up_2: 'wall_100_short_2',
  wall_50_short_up_2: 'wall_50_short_2',
});

const LEGACY_WALL_SHORT_VARIANTS = Object.freeze({
  'short-up-1': 'wall-short-1',
  'short-up-2': 'wall-short-2',
});

function canonicalizeLegacyWallShortIdentity(moduleState) {
  const itemKey = LEGACY_WALL_SHORT_ITEM_KEYS[moduleState.itemKey];
  if (itemKey) moduleState.itemKey = itemKey;
  const variant = LEGACY_WALL_SHORT_VARIANTS[moduleState.variant];
  if (variant) moduleState.variant = variant;
}

/**
 * Kayıtlı alt Item kimliğini, kullanıcı ezmelerini silmeden düzeltir.
 * Eski kapı projeleri yüzey state'inde fiziksel kanat itemKey taşımıyordu.
 * wall short legacy itemKey/variant, katalog getItem çağrısından önce çevrilir.
 */
export function normalizeModuleItemState(moduleState) {
  if (!moduleState) return moduleState;
  canonicalizeLegacyWallShortIdentity(moduleState);

  if (moduleState.type === 'tv') {
    const resolvedKey = resolveItemKey(moduleState);
    const item = resolvedKey ? getItem(resolvedKey) : null;
    if (item?.type === 'tv') {
      moduleState.itemKey = item.itemKey;
      moduleState.videoWallRows = item.videoWall?.rows ?? 1;
      moduleState.videoWallCols = item.videoWall?.cols ?? 1;
      applySceneFootprint(moduleState, item, ['widthCm', 'depthCm', 'heightCm']);
    }
    return moduleState;
  }

  if (moduleState.type === 'shelf') {
    const item = moduleState.itemKey ? getItem(moduleState.itemKey) : null;
    if (item?.type === 'shelf') {
      moduleState.itemKey = item.itemKey;
      if (!Object.hasOwn(moduleState, 'shelfLightingOn')) {
        moduleState.shelfLightingOn = false;
      }
      applySceneFootprint(moduleState, item, ['widthCm', 'depthCm', 'heightCm']);
    }
    return moduleState;
  }

  if (moduleState.type === 'base') {
    const resolvedKey = resolveItemKey(moduleState);
    if (resolvedKey && getItem(resolvedKey)?.type === 'base') {
      moduleState.itemKey = resolvedKey;
      ensureMissingRenderPartMeasure(
        Object.values(moduleState.faces || {}),
        getItem(resolvedKey),
        ['panel', 'separator-panel'],
      );
    }
    return moduleState;
  }

  if (moduleState.type === 'counter') {
    const resolvedKey = resolveItemKey(moduleState);
    if (resolvedKey && getItem(resolvedKey)?.type === 'counter') {
      moduleState.itemKey = resolvedKey;
      applyCounterFacePanelIdentity(moduleState.faces, getItem(resolvedKey), 'repair');
    }
    return moduleState;
  }

  if (moduleState.type === 'flat-panel') {
    const resolvedKey = resolveItemKey(moduleState) ?? moduleState.itemKey;
    const item = resolvedKey ? getItem(resolvedKey) : null;
    if (item?.type === 'flat-panel') {
      moduleState.itemKey = item.itemKey;
      const occupancy = normalizeStripOccupancy(item.stripOccupancy);
      if (occupancy) moduleState.stripOccupancy = occupancy;
      applySceneFootprint(moduleState, item, ['widthCm', 'heightCm']);
      ensureMissingRenderPartMeasure(moduleState.strips, item, ['panel', 'separator-panel']);
    }
    return moduleState;
  }

  if (moduleState.type === 'separator') {
    const resolvedKey = resolveItemKey(moduleState);
    const item = resolvedKey ? getItem(resolvedKey) : null;
    if (item?.type === 'separator') {
      moduleState.itemKey = resolvedKey;
      applySceneFootprint(moduleState, item, ['widthCm', 'depthCm', 'heightCm']);
      if (moduleState.surface) {
        ensureMissingRenderPartMeasure([moduleState.surface], item, ['separator-panel', 'panel']);
      }
    }
    return moduleState;
  }

  if (moduleState.type === 'indoor-plant-1') {
    const resolvedKey = resolveIndoorPlantItemKey(moduleState);
    if (resolvedKey && isIndoorPlantItem(getItem(resolvedKey))) {
      moduleState.itemKey = resolvedKey;
    }
    return moduleState;
  }

  if (
    moduleState.type === 'sofa-set-classic'
    || moduleState.type === 'sofa-single-classic'
    || moduleState.type === 'sofa-double-classic'
    || moduleState.type === 'coffee-table-classic'
    || moduleState.type === 'table-chair-set-eames'
    || moduleState.type === 'chair'
    || moduleState.type === 'table-glass'
    || moduleState.type === 'bar-stool'
  ) {
    const resolvedKey = resolveItemKey(moduleState);
    if (resolvedKey && getFurnitureItemForType(moduleState.type)?.itemKey === resolvedKey) {
      moduleState.itemKey = resolvedKey;
      const item = getItem(resolvedKey);
      if (Object.hasOwn(item, 'visualRotationYDeg') && !Object.hasOwn(moduleState, 'visualRotationYDeg')) {
        moduleState.visualRotationYDeg = item.visualRotationYDeg;
      }
    }
    return moduleState;
  }

  if (moduleState.type === 'led-floodlight') {
    const item = getTopLightItemForType('led-floodlight');
    if (item) moduleState.itemKey = item.itemKey;
    return moduleState;
  }

  if (moduleState.type === 'tulle-fabric') {
    const item = moduleState.itemKey ? getItem(moduleState.itemKey) : null;
    if (item?.type === 'tulle-fabric') {
      moduleState.itemKey = item.itemKey;
      moduleState.depthCm = requireSceneDimension(item, 'depthCm');
    }
    if (moduleState.placement) {
      moduleState.placement = {
        ...moduleState.placement,
        zCm: clampFloorRelativeBottomZCm(moduleState.placement.zCm, Number(moduleState.depthCm) || 0),
      };
    }
    return moduleState;
  }

  if (moduleState.type === 'box-block') {
    const item = moduleState.itemKey ? getItem(moduleState.itemKey) : null;
    if (item?.type === 'box-block') moduleState.itemKey = item.itemKey;
    ensureBoxBlockFaces(moduleState, item);
    if (moduleState.placement) {
      moduleState.placement = {
        ...moduleState.placement,
        zCm: clampFloorRelativeBottomZCm(moduleState.placement.zCm, Number(moduleState.heightCm) || 0),
      };
    }
    return moduleState;
  }

  if (moduleState.type === 'illuminated-foam') {
    const item = getItem('illuminated-foam');
    if (item) moduleState.itemKey = item.itemKey;
    return moduleState;
  }

  if (moduleState.type === 'profile') {
    const resolvedKey = resolveItemKey(moduleState) ?? moduleState.itemKey;
    const item = resolvedKey ? getItem(resolvedKey) : null;
    if (item?.type === 'profile') {
      moduleState.itemKey = item.itemKey;
      applySceneFootprint(moduleState, item, ['widthCm', 'depthCm', 'heightCm']);
    }
    return moduleState;
  }

  if (moduleState.type === 'door') {
  const doorItem = moduleState.itemKey ? getItem(moduleState.itemKey) : null;
  if (doorItem?.type !== 'door') return moduleState;
  applySceneFootprint(moduleState, doorItem, ['widthCm', 'depthCm', 'heightCm']);
  ensureMissingRenderPartMeasure(moduleState.strips, doorItem, ['panel', 'separator-panel']);
    const doorLeafItem = getItem('door_leaf_100');
    if (!doorLeafItem) return moduleState;
    if (!moduleState.surface) {
      moduleState.surface = createEditableItemSurfaceState(doorLeafItem);
      return moduleState;
    }
    const surface = moduleState.surface;
    surface.itemKey = doorLeafItem.itemKey;
    if (!surface.color) surface.color = itemDefaultColorHex(doorLeafItem);
    if (!Object.hasOwn(surface, 'imageAssetId')) surface.imageAssetId = null;
    if (!surface.imageTransform) surface.imageTransform = createDefaultImageTransform();
    return moduleState;
  }

  const showcaseItem = moduleState.itemKey ? getItem(moduleState.itemKey) : null;
  if (showcaseItem?.type !== 'showcase-2' && showcaseItem?.type !== 'showcase-3') return moduleState;
  const bodyDefinition = getShowcaseBodyDefinition(showcaseItem);
  moduleState.itemKey = showcaseItem.itemKey;
  moduleState.eyeCount = Number(showcaseItem.eyeCount);
  applySceneFootprint(moduleState, showcaseItem, ['widthCm']);
  ensureMissingRenderPartMeasure(moduleState.strips, showcaseItem, ['panel', 'separator-panel']);
  if (!moduleState.bodySurface) {
    moduleState.bodySurface = {
      id: createId('surface'),
      color: itemDefaultColorHex(bodyDefinition.sideItem),
    };
  } else {
    if (!moduleState.bodySurface.id) moduleState.bodySurface.id = createId('surface');
    if (!moduleState.bodySurface.color) moduleState.bodySurface.color = itemDefaultColorHex(bodyDefinition.sideItem);
    delete moduleState.bodySurface.imageAssetId;
    delete moduleState.bodySurface.imageTransform;
  }
  return moduleState;
}

export function duplicateModuleState(moduleState) {
  if (!moduleState) return null;
  const duplicate = JSON.parse(JSON.stringify(moduleState));
  duplicate.id = createId('module');
  // Kilit yerinde sabitlenmiş bu örneğe aittir; kopya kilitsiz doğar.
  clearDuplicateLock(duplicate);
  // Tek öğe kopyası gruba girmez; grup çoğaltma kopyaları yeni gruba kendisi alır.
  delete duplicate.group;
  if (Array.isArray(duplicate.strips)) {
    duplicate.strips = duplicate.strips.map((strip, stripIndex) => ({
      ...strip,
      id: createId('surface'),
      stripIndex: Number.isInteger(strip.stripIndex) ? strip.stripIndex : stripIndex,
      imageTransform: strip.imageTransform ? { ...strip.imageTransform } : createDefaultImageTransform(),
    }));
  }
  if (Array.isArray(duplicate.renderParts?.tops)) {
    duplicate.renderParts.tops = duplicate.renderParts.tops.map((part) => ({
      ...part,
      id: createId('surface'),
    }));
  }
  if (duplicate.faces) {
    duplicate.faces = Object.fromEntries(
      Object.entries(duplicate.faces).map(([faceKey, face]) => [
        faceKey,
        {
          ...face,
          id: createId('surface'),
          imageTransform: face.imageTransform
            ? { ...face.imageTransform }
            : createDefaultImageTransform(),
        },
      ]),
    );
  }
  if (duplicate.bodySurface) {
    duplicate.bodySurface = {
      ...duplicate.bodySurface,
      id: createId('surface'),
    };
  }
  if (duplicate.surface) {
    duplicate.surface = {
      ...duplicate.surface,
      id: createId('surface'),
      ...(
        'imageAssetId' in duplicate.surface
          ? {
              imageTransform: duplicate.surface.imageTransform
                ? { ...duplicate.surface.imageTransform }
                : createDefaultImageTransform(),
            }
          : {}
      ),
    };
  }
  renewMetalSeparatorGroups(duplicate);
  return duplicate;
}

/**
 * Kopya modül orijinalin metal separatör grup kimliğini paylaşmamalı: aksi halde
 * BOM iki modülü tek levha sayar ve kopyada separatörü kapatmak orijinali de kapatır.
 * Kopya içindeki aynı gruptaki yüzeyler yeni, ortak bir kimlikte kalır.
 */
function renewMetalSeparatorGroups(moduleState) {
  const renamed = new Map();
  const renew = (surface) => {
    const groupId = surface?.metalSeparatorGroupId;
    if (!groupId) return;
    if (!renamed.has(groupId)) renamed.set(groupId, createId('metal'));
    surface.metalSeparatorGroupId = renamed.get(groupId);
  };
  if (Array.isArray(moduleState.strips)) moduleState.strips.forEach(renew);
  if (moduleState.faces) Object.values(moduleState.faces).forEach(renew);
  renew(moduleState.surface);
  renew(moduleState.bodySurface);
}

/**
 * Bir panele renk uygulamak, o hücrede atanmış görselin yerini alır.
 * Renk-only modüllerde (ör. separatör) görsel state'i oluşturulmaz.
 */
export function applyColorOverride(surfaceState, color) {
  if (!surfaceState) return null;
  surfaceState.color = color;
  if ('imageAssetId' in surfaceState) {
    surfaceState.imageAssetId = null;
    surfaceState.imageTransform = createDefaultImageTransform();
  }
  return surfaceState;
}

/**
 * Otomatik duvar yeniden oluşturulurken aynı sıradaki aynı genişlikteki
 * modülleri tekrar kullanır. Böylece mevcut renk/görsel state'i korunur.
 */
export function reconcileWallModules(previousModules, widthsCm) {
  return widthsCm.map((widthCm, index) => {
    const previous = previousModules[index];
    if (previous?.type === 'flat-panel' && previous.widthCm === widthCm) {
      return previous;
    }
    return createFlatPanelModuleState(widthCm);
  });
}

export function totalWallWidthCm(modules) {
  return modules.reduce(
    (sum, module) => sum + (module?.type === 'led-floodlight' ? 0 : Number(module?.widthCm) || 0),
    0,
  );
}

export function moduleWidths(modules) {
  return modules
    .filter((module) => module?.type !== 'led-floodlight')
    .map((module) => module.widthCm);
}
