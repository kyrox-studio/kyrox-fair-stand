import { STAND_DIMENSIONS, getStandDimensions } from './standDimensions.js';
import { getItem, getWidthVariantFamily, resolveWidthVariantItemKey, resolveShelfRows, isWallShortFamilyDescriptor, resolveItemDefaultZCm, resolveSceneDimensions } from './items.js';
import {
  allowsThinWallEndpointContact,
  canModulesOverlapByBehavior,
  getModuleBehavior,
  countsTowardWallCapacity,
  getModuleCollisionHeightRangeCm,
  getModuleCollisionStrategy,
  getModuleMagneticSnapStrategy,
  getModuleMoveSnapCm,
  isUprightJointSnapTarget,
  resolveSideInsertRotationDeg,
  usesLogicalFixtureEndpoint,
  usesWallBackboneCollisionDepth,
  usesWallInnerFaceBoundary,
} from './moduleBehavior.js';
import { getStandStripMetrics } from './stripOccupancy.js';
import {
  WALL_PANEL_BAND_PITCH_CM,
  listFlatPanelModuleSeamHeightsCm,
  listInternalSeamHeightsCm,
} from './wallPanelBand.js';

export const MODULE_PLACEMENT_SNAP_CM = 50;
export const MODULE_PLACEMENT_ROTATIONS = Object.freeze([0, 45, 90, 135, 180, 225, 270, 315]);
export const MODULE_WALL_SNAP_DISTANCE_CM = 50;
export const MODULE_NEIGHBOR_SNAP_DISTANCE_CM = 30;

function standWallDepthCm() {
  return Math.max(0, Number(STAND_DIMENSIONS.depth) * 100 || 0);
}

const EPSILON_CM = 0.001;

const WALL_AXIS = Object.freeze({
  back: 'x',
  left: 'y',
  right: 'y',
  free: null,
});

const STAND_WALLS = Object.freeze({
  'back-wall': Object.freeze(['back', 'free']),
  'l-left': Object.freeze(['back', 'left', 'free']),
  'l-right': Object.freeze(['back', 'right', 'free']),
  'u-stand': Object.freeze(['back', 'left', 'right', 'free']),
  island: Object.freeze(['free']),
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function nearlyEqual(a, b) {
  return Math.abs(Number(a) - Number(b)) <= EPSILON_CM;
}

function hasStrictDepthBounds(depthCm) {
  const depth = Number(depthCm);
  return Number.isFinite(depth) && depth > standWallDepthCm() + EPSILON_CM;
}

function snapDepthCenterCm(value, depthCm, stepCm = MODULE_PLACEMENT_SNAP_CM) {
  const depth = Number(depthCm);
  const halfDepth = depth / 2;
  return halfDepth + snapCm(Number(value) - halfDepth, stepCm);
}

export function normalizeModuleRotationZDeg(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  const steps = Math.round(number / 15);
  return ((steps * 15) % 360 + 360) % 360;
}

export function rotateModuleRotationZDeg(value, deltaDeg = 90) {
  return normalizeModuleRotationZDeg(
    normalizeModuleRotationZDeg(value) + Number(deltaDeg || 0),
  );
}

export function rotateModulePlacementAroundCenter(placement, widthCm, deltaDeg = 90, depthCm = null) {
  if (!placement) return null;
  const width = Number(widthCm);
  if (!Number.isFinite(width) || width <= 0) return null;
  const center = getPlacementCenterCm(placement, width);
  if (!center) return null;

  const nextRotation = rotateModuleRotationZDeg(placement.rotationZDeg, deltaDeg);
  return placementFromCenterCm({
    centerXCm: center.xCm,
    centerYCm: center.yCm,
    widthCm: width,
    rotationZDeg: nextRotation,
    template: placement,
  });
}

export function isVerticalModuleRotation(rotationZDeg) {
  const rotation = normalizeModuleRotationZDeg(rotationZDeg);
  return rotation === 90 || rotation === 270;
}

function isCardinalModuleRotation(rotationZDeg) {
  return normalizeModuleRotationZDeg(rotationZDeg) % 90 === 0;
}

function getPlacementCenterCm(placement, widthCm) {
  if (!placement) return null;
  const width = Number(widthCm);
  const x = Number(placement.xCm);
  const y = Number(placement.yCm);
  if (![width, x, y].every(Number.isFinite) || width <= 0) return null;
  const vertical = isVerticalModuleRotation(placement.rotationZDeg);
  return {
    xCm: x + (vertical ? 0 : width / 2),
    yCm: y + (vertical ? width / 2 : 0),
  };
}

function placementFromCenterCm({ centerXCm, centerYCm, widthCm, rotationZDeg, template = {} }) {
  const width = Number(widthCm);
  const vertical = isVerticalModuleRotation(rotationZDeg);
  return createModulePlacement({
    ...template,
    xCm: vertical ? centerXCm : centerXCm - width / 2,
    yCm: vertical ? centerYCm - width / 2 : centerYCm,
    rotationZDeg,
    wallId: template.wallId ?? 'free',
  });
}

function getRotatedHalfExtentsCm(widthCm, depthCm, rotationZDeg) {
  const width = Number(widthCm);
  const depth = Number(depthCm);
  const radians = normalizeModuleRotationZDeg(rotationZDeg) * Math.PI / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  return {
    halfX: (cos * width + sin * depth) / 2,
    halfY: (sin * width + cos * depth) / 2,
  };
}

export function snapCm(value, stepCm = MODULE_PLACEMENT_SNAP_CM) {
  const number = Number(value);
  const step = Number(stepCm);
  if (!Number.isFinite(number) || !Number.isFinite(step) || step <= 0) return null;
  return Math.round(number / step) * step;
}

// Duvar-üst katman yüksekliği sabit görsel merkez kullanır (175 cm). Snap ortak
// adım ızgarasında kalır, ama son sınır geometriktir; her ekran boyutu snap katına
// erken takılmadan duvar üst/altına sıfır bitebilir.
export const WALL_OVERLAY_DEFAULT_CENTER_CM = 175;

export function getWallOverlayZBoundsCm(heightCm, wallHeightCm = STAND_DIMENSIONS.height * 100) {
  const halfHeightCm = Math.max(1, Number(heightCm) || 52.3) / 2;
  const wallCm = Number(wallHeightCm);
  return {
    minZCm: halfHeightCm - WALL_OVERLAY_DEFAULT_CENTER_CM,
    maxZCm: wallCm - halfHeightCm - WALL_OVERLAY_DEFAULT_CENTER_CM,
  };
}

export function clampWallOverlayZCm(
  rawOffsetCm,
  heightCm,
  stepCm = MODULE_PLACEMENT_SNAP_CM,
  wallHeightCm = STAND_DIMENSIONS.height * 100,
) {
  const { minZCm, maxZCm } = getWallOverlayZBoundsCm(heightCm, wallHeightCm);
  const snapped = snapCm(rawOffsetCm, stepCm);
  const value = Number.isFinite(snapped) ? snapped : Number(rawOffsetCm);
  if (!Number.isFinite(value)) return 0;
  return Math.min(maxZCm, Math.max(minZCm, value));
}

// Yerden taban Z (wall-short, kutu, tül…): taban ≥ 0, tepe (taban + dikey ölçü) ≤ stand tavanı.
// Overlay merkez-ofset Z bu kurala girmez.
export function getWallShortFloorZBoundsCm(heightCm, standHeightCm = getStandDimensions().heightCm) {
  const bodyCm = Number(heightCm);
  const ceilingCm = Number(standHeightCm);
  if (!Number.isFinite(bodyCm) || bodyCm < 0 || !Number.isFinite(ceilingCm) || ceilingCm < 0) {
    throw new TypeError('Floor-relative Z bounds require heightCm and stand heightCm.');
  }
  return Object.freeze({
    minZCm: 0,
    maxZCm: Math.max(0, ceilingCm - bodyCm),
  });
}

/** Yerden taban Z’yi stand tavanına sıkıştırır: hiçbir şey tavanı aşamaz. */
export function clampFloorRelativeBottomZCm(
  zCm,
  verticalExtentCm,
  standHeightCm = getStandDimensions().heightCm,
) {
  const { minZCm, maxZCm } = getWallShortFloorZBoundsCm(verticalExtentCm, standHeightCm);
  const value = Number(zCm);
  if (!Number.isFinite(value)) return minZCm;
  return Math.min(maxZCm, Math.max(minZCm, value));
}

/**
 * Üst montaj (projektör `placement=top`): zCm = taban/montaj kotu.
 * Taban 0…tavan arasındadır; gövde yüksekliği max’ı düşürmez (TV/kutu formülü değil).
 * TODO(DB): z_frame / z_max tip davranışına taşınacak — şimdilik kodda `top`.
 */
export function getMountBottomZBoundsCm(standHeightCm = getStandDimensions().heightCm) {
  const ceilingCm = Number(standHeightCm);
  if (!Number.isFinite(ceilingCm) || ceilingCm < 0) {
    throw new TypeError('Mount-bottom Z bounds require stand heightCm.');
  }
  return Object.freeze({
    minZCm: 0,
    maxZCm: ceilingCm,
  });
}

export function clampMountBottomZCm(zCm, standHeightCm = getStandDimensions().heightCm) {
  const { minZCm, maxZCm } = getMountBottomZBoundsCm(standHeightCm);
  const value = Number(zCm);
  if (!Number.isFinite(value)) return minZCm;
  return Math.min(maxZCm, Math.max(minZCm, value));
}

export function stepMountBottomZCm(
  currentZCm,
  deltaCm,
  standHeightCm = getStandDimensions().heightCm,
) {
  const current = Number(currentZCm);
  const delta = Number(deltaCm);
  const { minZCm } = getMountBottomZBoundsCm(standHeightCm);
  const base = Number.isFinite(current) ? current : minZCm;
  const shift = Number.isFinite(delta) ? delta : 0;
  return clampMountBottomZCm(base + shift, standHeightCm);
}

/**
 * Tül Z adımı. Dikey ölçü levha kalınlığıdır (`depthCm`); tepe tavanı geçemez.
 * Adım çağıran yerin moveSnapCm değeridir.
 */
export function stepTulleFabricZCm(
  currentZCm,
  direction,
  stepCm,
  verticalExtentCm,
  standHeightCm = getStandDimensions().heightCm,
) {
  const step = Number(stepCm);
  if (!Number.isFinite(step) || step <= 0) {
    throw new TypeError('Tulle Z step requires moveSnapCm.');
  }
  const current = Number(currentZCm);
  const base = Number.isFinite(current) ? current : 0;
  const sign = direction === 'up' ? 1 : direction === 'down' ? -1 : 0;
  if (!sign) return clampFloorRelativeBottomZCm(base, verticalExtentCm, standHeightCm);
  return clampFloorRelativeBottomZCm(base + sign * step, verticalExtentCm, standHeightCm);
}

export function stepWallShortFloorZCm(
  currentZCm,
  deltaCm,
  heightCm,
  standHeightCm = getStandDimensions().heightCm,
) {
  const current = Number(currentZCm);
  const delta = Number(deltaCm);
  const { minZCm } = getWallShortFloorZBoundsCm(heightCm, standHeightCm);
  const base = Number.isFinite(current) ? current : minZCm;
  const shift = Number.isFinite(delta) ? delta : 0;
  return clampFloorRelativeBottomZCm(base + shift, heightCm, standHeightCm);
}

export function getPanelSeamSnapWindowCm() {
  return WALL_PANEL_BAND_PITCH_CM / 4;
}

export function overlayZCmFromSeamHeight(seamHeightCm, panelThicknessCm) {
  return Number(seamHeightCm) + Number(panelThicknessCm) / 2 - WALL_OVERLAY_DEFAULT_CENTER_CM;
}

// Overlay'in alt kenarı birleşime oturur; tamamı (çok sıralı rafta üst tahta dahil) duvarın içinde kalmalı.
function seamsFittingOverlayHeight(validSeams, occupancyRange, heightCm) {
  const maxCm = Number(occupancyRange?.maxCm);
  if (!Number.isFinite(maxCm)) return validSeams;
  return validSeams.filter((seam) => seam + Number(heightCm) <= maxCm + EPSILON_CM);
}

export function listInternalSeamsInOccupancyRange(occupancyRange, hostModule = null) {
  const minCm = Number(occupancyRange?.minCm);
  const maxCm = Number(occupancyRange?.maxCm);
  if (Array.isArray(hostModule?.strips)) {
    return listFlatPanelModuleSeamHeightsCm(hostModule, { minCm, maxCm });
  }
  const pitchCm = WALL_PANEL_BAND_PITCH_CM;
  const stripCount = Number.isFinite(maxCm) && maxCm > 0
    ? Math.max(1, Math.floor(maxCm / pitchCm))
    : getStandStripMetrics().stripCount;
  return listInternalSeamHeightsCm({
    stripCount,
    pitchCm,
    minCm: Number.isFinite(minCm) ? minCm : 0,
    maxCm: Number.isFinite(maxCm) ? maxCm : Number.POSITIVE_INFINITY,
  });
}

function listFittingWallCapacityHosts({
  modules = [],
  widthCm,
  wallId,
  supportModuleId = null,
} = {}) {
  const width = Number(widthCm);
  if (!Number.isFinite(width) || width <= 0) return [];
  return modules.filter((module) => {
    if (!countsTowardWallCapacity(module)) return false;
    const hostWidth = Number(module.widthCm);
    if (!Number.isFinite(hostWidth) || hostWidth + EPSILON_CM < width) return false;
    if (supportModuleId) return module.id === supportModuleId;
    return module?.placement?.wallId === wallId;
  });
}

function pointerOnHostSpan(wallPoint, host) {
  const hostInterval = getPlacementInterval(host?.placement, host?.widthCm);
  if (!hostInterval) return false;
  const pointerCm = hostInterval.axis === 'y'
    ? Number(wallPoint?.pointerYCm)
    : Number(wallPoint?.pointerXCm);
  if (!Number.isFinite(pointerCm)) return false;
  return pointerCm >= hostInterval.startCm - EPSILON_CM
    && pointerCm <= hostInterval.endCm + EPSILON_CM;
}

function clampPlacementToHost(placement, widthCm, host) {
  const interval = getPlacementInterval(placement, widthCm);
  const hostInterval = getPlacementInterval(host?.placement, host?.widthCm);
  if (!interval || !hostInterval || interval.axis !== hostInterval.axis) return null;
  const maxStart = hostInterval.endCm - Number(widthCm);
  if (maxStart + EPSILON_CM < hostInterval.startCm) return null;
  const nextStart = clamp(interval.startCm, hostInterval.startCm, maxStart);
  return createModulePlacement({
    ...placement,
    xCm: interval.axis === 'x' ? nextStart : placement.xCm,
    yCm: interval.axis === 'y' ? nextStart : placement.yCm,
  });
}

function placementFitsHost(placement, widthCm, host) {
  const inner = getPlacementInterval(placement, widthCm);
  const outer = getPlacementInterval(host?.placement, host?.widthCm);
  if (!inner || !outer || inner.axis !== outer.axis) return false;
  return inner.startCm >= outer.startCm - EPSILON_CM
    && inner.endCm <= outer.endCm + EPSILON_CM;
}

function pointerDistanceToHostCm(wallPoint, host) {
  const center = getPlacementCenterCm(host.placement, host.widthCm);
  if (!center) return Number.POSITIVE_INFINITY;
  const pointerX = Number(wallPoint?.pointerXCm);
  const pointerY = Number(wallPoint?.pointerYCm);
  if (![pointerX, pointerY].every(Number.isFinite)) return Number.POSITIVE_INFINITY;
  return Math.hypot(pointerX - center.xCm, pointerY - center.yCm);
}

function overlayPlacementFromPointer(moduleState, wallPoint) {
  const widthCm = Number(moduleState?.widthCm);
  const heightCm = Number(moduleState?.heightCm);
  const pointerX = Number(wallPoint?.pointerXCm);
  const pointerY = Number(wallPoint?.pointerYCm);
  const rotationZDeg = Number(wallPoint?.rotationZDeg) || 0;
  const vertical = isVerticalModuleRotation(rotationZDeg);
  const hitHeightCm = Number(wallPoint?.absoluteHeightCm);
  const zCm = Number.isFinite(hitHeightCm)
    ? hitHeightCm - WALL_OVERLAY_DEFAULT_CENTER_CM
    : Number(wallPoint?.zCm) || 0;
  return createModulePlacement({
    xCm: vertical ? pointerX : pointerX - widthCm / 2,
    yCm: vertical ? pointerY - widthCm / 2 : pointerY,
    zCm,
    rotationZDeg,
    wallId: wallPoint?.wallId ?? 'back',
  });
}

function shelfBoardHeightRanges(moduleState, placement) {
  const item = getItem(moduleState?.itemKey);
  const rows = resolveShelfRows(item);
  if (!rows) return [];
  const thickness = Number(resolveSceneDimensions(rows.rowItem).heightCm);
  const height = rows.count === 1 ? thickness : Number(resolveSceneDimensions(item).heightCm);
  const pitch = rows.count > 1 ? (height - thickness) / (rows.count - 1) : 0;
  const bottom = Number(placement.zCm || 0) + WALL_OVERLAY_DEFAULT_CENTER_CM - height / 2;
  return Array.from({ length: rows.count }, (_, index) => ({
    minCm: bottom + index * pitch, maxCm: bottom + index * pitch + thickness,
  }));
}

function overlapsPlacedShelf(moduleState, placement, modules) {
  const span = getPlacementInterval(placement, moduleState.widthCm);
  if (!span) return false;
  const rows = shelfBoardHeightRanges(moduleState, placement);
  return modules.some((other) => {
    if (other.id === moduleState.id || other.type !== 'shelf' || !other.placement) return false;
    if (normalizeModuleRotationZDeg(other.placement.rotationZDeg) !== normalizeModuleRotationZDeg(placement.rotationZDeg)) return false;
    const otherSpan = getPlacementInterval(other.placement, other.widthCm);
    if (!otherSpan || otherSpan.axis !== span.axis) return false;
    const crossField = span.axis === 'x' ? 'yCm' : 'xCm';
    if (Math.abs(Number(other.placement[crossField]) - Number(placement[crossField])) > EPSILON_CM) return false;
    if (Math.min(span.endCm, otherSpan.endCm) - Math.max(span.startCm, otherSpan.startCm) <= EPSILON_CM) return false;
    const occupiedRows = shelfBoardHeightRanges(other, other.placement);
    return rows.some((row) => occupiedRows.some((occupied) => (
      Math.min(row.maxCm, occupied.maxCm) - Math.max(row.minCm, occupied.minCm) > EPSILON_CM
    )));
  });
}

export function snapPanelSeamOverlayPlacement({
  moduleState,
  wallPoint,
  modules = [],
} = {}) {
  let widthCm = Number(moduleState?.widthCm);
  let heightCm = Number(moduleState?.heightCm);
  const family = getWidthVariantFamily(moduleState?.itemKey);
  let resolvedModuleState = moduleState;
  const hitHeightCm = Number(wallPoint?.absoluteHeightCm);
  let fallback = overlayPlacementFromPointer(moduleState, wallPoint);
  const invalidMessage = 'Rafı iki panel arasındaki birleşime bırak.';
  const missingHostMessage = 'Rafı sığdığı duvar veya panel üzerine bırak.';

  if (
    !wallPoint
    || !Number.isFinite(widthCm)
    || widthCm <= 0
    || !Number.isFinite(heightCm)
    || heightCm <= 0
  ) {
    return { ok: false, placement: fallback, seamHeightCm: null, message: missingHostMessage };
  }

  const hosts = listFittingWallCapacityHosts({
    modules,
    widthCm: family ? EPSILON_CM : widthCm,
    wallId: wallPoint.wallId,
    supportModuleId: wallPoint.supportModuleId ?? null,
  });
  let target = null;
  let bestHostDistance = Number.POSITIVE_INFINITY;
  for (const host of hosts) {
    if (!pointerOnHostSpan(wallPoint, host)) continue;
    const distance = pointerDistanceToHostCm(wallPoint, host);
    if (distance < bestHostDistance) {
      bestHostDistance = distance;
      target = host;
    }
  }

  if (family && target) {
    const itemKey = resolveWidthVariantItemKey(family, target.widthCm);
    if (!itemKey) {
      return { ok: false, placement: fallback, seamHeightCm: null, message: 'Bu duvar genişliğine uygun raf yok.' };
    }
    const dimensions = resolveSceneDimensions(getItem(itemKey));
    resolvedModuleState = { ...moduleState, itemKey, ...dimensions };
    widthCm = Number(resolvedModuleState.widthCm);
    heightCm = Number(resolvedModuleState.heightCm);
    fallback = overlayPlacementFromPointer(resolvedModuleState, wallPoint);
  }
  const clamped = target ? clampPlacementToHost(fallback, widthCm, target) : null;
  if (!target?.placement || !clamped) {
    return { ok: false, placement: fallback, seamHeightCm: null, message: missingHostMessage };
  }

  const occupancyRange = getModuleCollisionHeightRangeCm(target);
  const validSeams = seamsFittingOverlayHeight(
    listInternalSeamsInOccupancyRange(occupancyRange, target),
    occupancyRange,
    heightCm,
  );

  let seamHeightCm = null;
  let seamDistanceCm = Number.POSITIVE_INFINITY;
  if (Number.isFinite(hitHeightCm)) {
    for (const seam of validSeams) {
      const distance = Math.abs(hitHeightCm - seam);
      if (distance < seamDistanceCm) {
        seamDistanceCm = distance;
        seamHeightCm = seam;
      }
    }
  }

  const windowCm = getPanelSeamSnapWindowCm();
  const snapped = Boolean(
    seamHeightCm != null
    && Number.isFinite(seamDistanceCm)
    && seamDistanceCm <= windowCm,
  );

  const placement = createModulePlacement({
    ...clamped,
    zCm: snapped
      ? overlayZCmFromSeamHeight(seamHeightCm, heightCm)
      : (Number.isFinite(hitHeightCm)
        ? hitHeightCm - WALL_OVERLAY_DEFAULT_CENTER_CM
        : overlayZCmFromSeamHeight(validSeams[0] ?? 0, heightCm)),
  });

  const occupied = snapped && overlapsPlacedShelf(resolvedModuleState, placement, modules);
  return {
    ok: snapped && !occupied,
    resolvedModuleState,
    placement,
    seamHeightCm: snapped ? seamHeightCm : null,
    message: occupied ? 'Bu panel birleşiminde zaten raf var.' : (snapped ? null : invalidMessage),
  };
}

export function stepPanelSeamOverlayPlacement({
  moduleState,
  modules = [],
  seamDelta = 0,
  horizontalDeltaCm = 0,
} = {}) {
  const widthCm = Number(moduleState?.widthCm);
  const heightCm = Number(moduleState?.heightCm);
  const placement = moduleState?.placement;
  if (!placement || !Number.isFinite(widthCm) || !Number.isFinite(heightCm)) return null;

  const hosts = listFittingWallCapacityHosts({
    modules,
    widthCm,
    wallId: placement.wallId,
    supportModuleId: placement.supportModuleId ?? null,
  });
  const target = hosts.find((host) => placementFitsHost(placement, widthCm, host)) ?? null;
  if (!target) return null;

  if (Number(horizontalDeltaCm)) {
    const interval = getPlacementInterval(placement, widthCm);
    const hostInterval = getPlacementInterval(target.placement, target.widthCm);
    if (!interval || !hostInterval || interval.axis !== hostInterval.axis) return null;
    const maxStart = hostInterval.endCm - widthCm;
    const nextStart = clamp(interval.startCm + Number(horizontalDeltaCm), hostInterval.startCm, maxStart);
    if (!Number.isFinite(nextStart) || nearlyEqual(nextStart, interval.startCm)) return null;
    const next = createModulePlacement({
      ...placement,
      xCm: interval.axis === 'x' ? nextStart : placement.xCm,
      yCm: interval.axis === 'y' ? nextStart : placement.yCm,
    });
    return overlapsPlacedShelf(moduleState, next, modules) ? null : next;
  }

  const targetRange = getModuleCollisionHeightRangeCm(target);
  const validSeams = seamsFittingOverlayHeight(
    listInternalSeamsInOccupancyRange(targetRange, target),
    targetRange,
    heightCm,
  );
  if (!validSeams.length) return null;

  const currentBottomCm = Number(placement.zCm) + WALL_OVERLAY_DEFAULT_CENTER_CM - heightCm / 2;
  let index = validSeams.findIndex((seam) => nearlyEqual(seam, currentBottomCm));
  if (index < 0) {
    index = validSeams.reduce((bestIndex, seam, seamIndex) => (
      Math.abs(seam - currentBottomCm) < Math.abs(validSeams[bestIndex] - currentBottomCm)
        ? seamIndex
        : bestIndex
    ), 0);
  }
  const nextIndex = index + Number(seamDelta);
  if (nextIndex < 0 || nextIndex >= validSeams.length) return null;

  const next = createModulePlacement({
    ...placement,
    zCm: overlayZCmFromSeamHeight(validSeams[nextIndex], heightCm),
  });
  return overlapsPlacedShelf(moduleState, next, modules) ? null : next;
}

export function getModulePlacementSnapCm(moduleType) {
  return getModuleMoveSnapCm(moduleType);
}

export function getAllowedWallIds(standType) {
  return [...(STAND_WALLS[standType] ?? [])];
}

export function getWallAxis(wallId) {
  return WALL_AXIS[wallId] ?? null;
}

export function createModulePlacement({
  xCm = 0,
  yCm = 0,
  zCm,
  rotationZDeg = 0,
  wallId = 'back',
  itemKey = null,
} = {}) {
  return {
    xCm: Number(xCm) || 0,
    yCm: Number(yCm) || 0,
    zCm: zCm === undefined || zCm === null
      ? resolveItemDefaultZCm(itemKey)
      : (Number(zCm) || 0),
    rotationZDeg: normalizeModuleRotationZDeg(rotationZDeg),
    wallId,
  };
}

export function getPlacementInterval(placement, widthCm) {
  if (!placement || !Number.isFinite(Number(widthCm))) return null;
  const axis = getWallAxis(placement.wallId)
    ?? (isVerticalModuleRotation(placement.rotationZDeg) ? 'y' : 'x');
  const startCm = axis === 'y' ? Number(placement.yCm) : Number(placement.xCm);
  return {
    axis,
    startCm,
    endCm: startCm + Number(widthCm),
  };
}

function getGroundSegment(module) {
  const placement = module?.placement;
  const widthCm = Number(module?.widthCm);
  if (!placement || !Number.isFinite(widthCm) || widthCm <= 0) return null;

  const rotation = normalizeModuleRotationZDeg(placement.rotationZDeg);
  const x = Number(placement.xCm);
  const y = Number(placement.yCm);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  if (isVerticalModuleRotation(rotation)) {
    return {
      axis: 'y',
      fixedCm: x,
      startCm: y,
      endCm: y + widthCm,
    };
  }

  return {
    axis: 'x',
    fixedCm: y,
    startCm: x,
    endCm: x + widthCm,
  };
}

function isLCounterModule(module) {
  return module?.type === 'counter' && module?.shape === 'L';
}

function createGroundSegmentFromWorldPoints(startPoint, endPoint) {
  const dx = Number(endPoint.xCm) - Number(startPoint.xCm);
  const dy = Number(endPoint.yCm) - Number(startPoint.yCm);
  if (![dx, dy].every(Number.isFinite)) return null;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      axis: 'x',
      fixedCm: (Number(startPoint.yCm) + Number(endPoint.yCm)) / 2,
      startCm: Math.min(Number(startPoint.xCm), Number(endPoint.xCm)),
      endCm: Math.max(Number(startPoint.xCm), Number(endPoint.xCm)),
    };
  }

  return {
    axis: 'y',
    fixedCm: (Number(startPoint.xCm) + Number(endPoint.xCm)) / 2,
    startCm: Math.min(Number(startPoint.yCm), Number(endPoint.yCm)),
    endCm: Math.max(Number(startPoint.yCm), Number(endPoint.yCm)),
  };
}

function getLCounterCollisionSegments(module) {
  if (!isLCounterModule(module)) return [];
  const placement = module?.placement;
  const widthCm = Number(module?.widthCm);
  const depthCm = Number(module?.depthCm);
  if (!placement || !Number.isFinite(widthCm) || !Number.isFinite(depthCm) || widthCm <= 0 || depthCm <= 0) {
    return [];
  }

  const armCm = 50;
  const rotationDeg = normalizeModuleRotationZDeg(placement.rotationZDeg);
  const vertical = isVerticalModuleRotation(rotationDeg);
  const placementX = Number(placement.xCm);
  const placementY = Number(placement.yCm);
  if (!Number.isFinite(placementX) || !Number.isFinite(placementY)) return [];
  const centerX = placementX + (vertical ? 0 : widthCm / 2);
  const centerY = placementY + (vertical ? widthCm / 2 : 0);
  const radians = rotationDeg * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const toWorld = (localX, localY) => ({
    xCm: centerX + localX * cos + localY * sin,
    yCm: centerY - localX * sin + localY * cos,
  });
  const createLocalSegment = (x1, y1, x2, y2) => createGroundSegmentFromWorldPoints(
    toWorld(x1, y1),
    toWorld(x2, y2),
  );

  const armModule = { ...module, depthCm: armCm, shape: null };
  return [
    createLocalSegment(
      -widthCm / 2,
      -depthCm / 2 + armCm / 2,
      widthCm / 2,
      -depthCm / 2 + armCm / 2,
    ),
    createLocalSegment(
      widthCm / 2 - armCm / 2,
      -depthCm / 2,
      widthCm / 2 - armCm / 2,
      depthCm / 2,
    ),
  ].filter(Boolean).map((segment) => ({ segment, module: armModule }));
}

function getModuleCollisionSegments(module) {
  const lSegments = getLCounterCollisionSegments(module);
  if (lSegments.length) return lSegments;
  const segment = getGroundSegment(module);
  return segment ? [{ segment, module }] : [];
}

/** Öğenin zemindeki çizgi izleri (ince duvar: tek çizgi; L banko: iki kol). */
export function getModuleGroundSegments(module) {
  return getModuleCollisionSegments(module).map((entry) => ({ ...entry.segment }));
}

function pointIsSegmentEndpoint(segment, coordinateCm) {
  return nearlyEqual(coordinateCm, segment.startCm)
    || nearlyEqual(coordinateCm, segment.endCm);
}

export function getWallUsedCm(modules = [], wallId = 'back') {
  return modules.reduce((sum, module) => (
    module?.placement?.wallId === wallId && countsTowardWallCapacity(module)
      ? sum + (Number(module.widthCm) || 0)
      : sum
  ), 0);
}

export function getWallExtentCm(modules = [], wallId = 'back') {
  return modules.reduce((max, module) => {
    if (module?.placement?.wallId !== wallId || !countsTowardWallCapacity(module)) return max;
    const interval = getPlacementInterval(module.placement, module.widthCm);
    return interval ? Math.max(max, interval.endCm) : max;
  }, 0);
}

export function validateModulePlacement({
  placement,
  widthCm,
  depthCm = null,
  standType,
  standXCm,
  standYCm,
} = {}) {
  if (!placement) return { ok: false, message: 'Modül yerleşimi eksik.' };

  const width = Number(widthCm);
  const xLimit = Number(standXCm);
  const yLimit = Number(standYCm);
  if (![width, xLimit, yLimit].every(Number.isFinite) || width <= 0 || xLimit <= 0 || yLimit <= 0) {
    return { ok: false, message: 'Geçerli modül ve stand ölçüleri gerekli.' };
  }

  const allowedWalls = getAllowedWallIds(standType);
  if (!allowedWalls.includes(placement.wallId)) {
    return { ok: false, message: 'Bu stand tipinde bu konuma modül yerleştirilemez.' };
  }

  const rotation = normalizeModuleRotationZDeg(placement.rotationZDeg);
  const vertical = isVerticalModuleRotation(rotation);
  const x = Number(placement.xCm);
  const y = Number(placement.yCm);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return { ok: false, message: 'Modül koordinatları geçersiz.' };
  }

  if (placement.wallId === 'back') {
    if (vertical || y !== 0) return { ok: false, message: 'Sırt duvar modülü X yönünde olmalı.' };
    if (x < 0 || x + width > xLimit) return { ok: false, message: 'Modül X stand sınırını aşıyor.' };
  } else if (placement.wallId === 'left') {
    if (!vertical || x !== 0) return { ok: false, message: 'Sol duvar modülü Y yönünde olmalı.' };
    if (y < 0 || y + width > yLimit) return { ok: false, message: 'Modül Y stand sınırını aşıyor.' };
  } else if (placement.wallId === 'right') {
    if (!vertical || x !== xLimit) return { ok: false, message: 'Sağ duvar modülü Y yönünde olmalı.' };
    if (y < 0 || y + width > yLimit) return { ok: false, message: 'Modül Y stand sınırını aşıyor.' };
  } else {
    const strictDepth = hasStrictDepthBounds(depthCm);
    if (strictDepth) {
      const center = getPlacementCenterCm(placement, width);
      const extents = getRotatedHalfExtentsCm(width, depthCm, rotation);
      if (
        !center
        || center.xCm - extents.halfX < -EPSILON_CM
        || center.xCm + extents.halfX > xLimit + EPSILON_CM
        || center.yCm - extents.halfY < -EPSILON_CM
        || center.yCm + extents.halfY > yLimit + EPSILON_CM
      ) {
        return { ok: false, message: 'Modül aktif stand alanını aşıyor.' };
      }
    } else {
      const endX = x + (!vertical ? width : 0);
      const endY = y + (vertical ? width : 0);
      if (x < 0 || y < 0 || endX > xLimit || endY > yLimit) {
        return { ok: false, message: 'Modül aktif stand alanını aşıyor.' };
      }
    }
  }

  return { ok: true };
}

function getModuleCollisionDepthCm(module) {
  // Panel Bazalı fiziksel olarak 50 cm baza taşır ama bağlantı omurgası Panel'dir.
  // Corner/T/snap hesabında baza çıkıntısını değil 10 cm Maxima duvar hattını kullan.
  if (usesWallBackboneCollisionDepth(module)) return standWallDepthCm();
  const explicitDepthCm = Number(module?.depthCm);
  if (Number.isFinite(explicitDepthCm) && explicitDepthCm > 0) return explicitDepthCm;
  const sceneDepthCm = resolveSceneDimensions(getItem(module?.itemKey)).depthCm;
  if (sceneDepthCm != null) return sceneDepthCm;
  // LEGACY: Item scene depth MISSING ise genel stand omurga derinliği.
  return standWallDepthCm();
}

function collisionSegmentsOverlap(a, moduleA, b, moduleB) {
  const depthA = getModuleCollisionDepthCm(moduleA);
  const depthB = getModuleCollisionDepthCm(moduleB);

  if (a.axis === b.axis) {
    const longitudinalOverlap = a.startCm < b.endCm - EPSILON_CM
      && b.startCm < a.endCm - EPSILON_CM;
    if (!longitudinalOverlap) return false;

    const centerLineGapCm = Math.abs(a.fixedCm - b.fixedCm);
    const requiredGapCm = (depthA + depthB) / 2;
    return centerLineGapCm < requiredGapCm - EPSILON_CM;
  }

  const horizontal = a.axis === 'x' ? a : b;
  const vertical = a.axis === 'y' ? a : b;
  const horizontalModule = a.axis === 'x' ? moduleA : moduleB;
  const verticalModule = a.axis === 'y' ? moduleA : moduleB;
  const horizontalDepth = getModuleCollisionDepthCm(horizontalModule);
  const verticalDepth = getModuleCollisionDepthCm(verticalModule);
  const intersectionX = vertical.fixedCm;
  const intersectionY = horizontal.fixedCm;
  const onHorizontal = intersectionX >= horizontal.startCm - EPSILON_CM
    && intersectionX <= horizontal.endCm + EPSILON_CM;
  const onVertical = intersectionY >= vertical.startCm - EPSILON_CM
    && intersectionY <= vertical.endCm + EPSILON_CM;

  if (onHorizontal && onVertical) {
    const horizontalEndpoint = pointIsSegmentEndpoint(horizontal, intersectionX);
    const verticalEndpoint = pointIsSegmentEndpoint(vertical, intersectionY);

    const fixtureModule = usesLogicalFixtureEndpoint(horizontalModule)
      ? horizontalModule
      : (usesLogicalFixtureEndpoint(verticalModule) ? verticalModule : null);
    if (fixtureModule) {
      const fixtureIsHorizontal = fixtureModule === horizontalModule;
      const fixtureSegment = fixtureIsHorizontal ? horizontal : vertical;
      const thinModule = fixtureIsHorizontal ? verticalModule : horizontalModule;
      const fixtureIntersectionCm = fixtureIsHorizontal ? intersectionX : intersectionY;
      const thinDepthCm = getModuleCollisionDepthCm(thinModule);
      const logicalFixtureEndpointJoin = thinDepthCm <= standWallDepthCm() + EPSILON_CM
        && pointIsSegmentEndpoint(fixtureSegment, fixtureIntersectionCm);
      if (logicalFixtureEndpointJoin) return false;
    }

    const endpointContactModule = allowsThinWallEndpointContact(horizontalModule)
      ? horizontalModule
      : (allowsThinWallEndpointContact(verticalModule) ? verticalModule : null);
    if (endpointContactModule) {
      const contactIsHorizontal = endpointContactModule === horizontalModule;
      const contactSegment = contactIsHorizontal ? horizontal : vertical;
      const otherModule = contactIsHorizontal ? verticalModule : horizontalModule;
      const contactIntersectionCm = contactIsHorizontal ? intersectionX : intersectionY;
      const otherDepthCm = getModuleCollisionDepthCm(otherModule);
      const allowedEndpointJoin = otherDepthCm <= standWallDepthCm() + EPSILON_CM
        && pointIsSegmentEndpoint(contactSegment, contactIntersectionCm);
      if (allowedEndpointJoin) return false;
    }

    const thinEndpointJoin = horizontalDepth <= standWallDepthCm() + EPSILON_CM
      && verticalDepth <= standWallDepthCm() + EPSILON_CM;
    if (!thinEndpointJoin) return true;
    // Profil profile her noktada dik bağlanır (iki profilin arasına, ortasına): birinin ucu yeter;
    // birbirinin ortasından geçen iki profil (X) çakışır.
    if (isProfilePair(horizontalModule, verticalModule)) return !(horizontalEndpoint || verticalEndpoint);
    // Profil duvarın üst / alt rayına (duvarın kendi profili) dik bağlanır: profilin ucu rayın her
    // noktasına gelebilir; rayı kesen profil (X) çakışır. Duvarın ucu profilin ortasına gelemez.
    if (profileOnWallRail(horizontalModule, verticalModule)) return !horizontalEndpoint;
    if (profileOnWallRail(verticalModule, horizontalModule)) return !verticalEndpoint;
    // Duvarda dik bağlantı yalnız dikme olan noktada: ikisinin de ucu birleşimdeyse L ya da T (komşu
    // duvarla ortak dikme). Yalnız birinin ucu diğerinin ortasındaysa orada dikme yoktur; çakışma sayılır.
    return !(horizontalEndpoint && verticalEndpoint);
  }

  const verticalHalfDepth = verticalDepth / 2;
  const horizontalHalfDepth = horizontalDepth / 2;
  const physicalXOverlap = intersectionX > horizontal.startCm - verticalHalfDepth + EPSILON_CM
    && intersectionX < horizontal.endCm + verticalHalfDepth - EPSILON_CM;
  const physicalYOverlap = intersectionY > vertical.startCm - horizontalHalfDepth + EPSILON_CM
    && intersectionY < vertical.endCm + horizontalHalfDepth - EPSILON_CM;
  return physicalXOverlap && physicalYOverlap;
}

function getOrientedFootprint(module) {
  const placement = module?.placement;
  const width = Number(module?.widthCm);
  const depth = getModuleCollisionDepthCm(module);
  if (!placement || !Number.isFinite(width) || width <= 0 || !Number.isFinite(depth) || depth <= 0) return null;
  const center = getPlacementCenterCm(placement, width);
  if (!center) return null;
  const radians = normalizeModuleRotationZDeg(placement.rotationZDeg) * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    center,
    axes: [
      { x: cos, y: -sin },
      { x: sin, y: cos },
    ],
    half: [width / 2, depth / 2],
  };
}

/** Modülün zemindeki izinin eksene hizalı sınırları (cm); ölçü yoksa null. */
export function getModuleFootprintBoundsCm(module) {
  const footprint = getOrientedFootprint(module);
  if (!footprint) return null;
  const [halfW, halfD] = footprint.half;
  const [axisW, axisD] = footprint.axes;
  const extentX = Math.abs(axisW.x) * halfW + Math.abs(axisD.x) * halfD;
  const extentY = Math.abs(axisW.y) * halfW + Math.abs(axisD.y) * halfD;
  return {
    minXCm: footprint.center.xCm - extentX,
    maxXCm: footprint.center.xCm + extentX,
    minYCm: footprint.center.yCm - extentY,
    maxYCm: footprint.center.yCm + extentY,
  };
}

function orientedFootprintsOverlap(moduleA, moduleB) {
  const a = getOrientedFootprint(moduleA);
  const b = getOrientedFootprint(moduleB);
  if (!a || !b) return false;
  const delta = {
    x: b.center.xCm - a.center.xCm,
    y: b.center.yCm - a.center.yCm,
  };
  const axes = [...a.axes, ...b.axes];
  return axes.every((axis) => {
    const centerDistance = Math.abs(delta.x * axis.x + delta.y * axis.y);
    const radiusA = a.half[0] * Math.abs(a.axes[0].x * axis.x + a.axes[0].y * axis.y)
      + a.half[1] * Math.abs(a.axes[1].x * axis.x + a.axes[1].y * axis.y);
    const radiusB = b.half[0] * Math.abs(b.axes[0].x * axis.x + b.axes[0].y * axis.y)
      + b.half[1] * Math.abs(b.axes[1].x * axis.x + b.axes[1].y * axis.y);
    return centerDistance < radiusA + radiusB - EPSILON_CM;
  });
}

function collisionHeightsOverlap(moduleA, moduleB) {
  const rangeA = getModuleCollisionHeightRangeCm(moduleA);
  const rangeB = getModuleCollisionHeightRangeCm(moduleB);
  return rangeA.minCm < rangeB.maxCm - EPSILON_CM
    && rangeB.minCm < rangeA.maxCm - EPSILON_CM;
}

const WALL_SHORT_PROFILE_SNAP_KINDS = new Set([
  'end-to-end',
  'corner',
  'tee',
  'face',
  'fixture-side',
  'corner-face',
]);

function isProfileModule(module) {
  if (module?.type === 'profile') return true;
  const item = module?.itemKey ? getItem(module.itemKey) : null;
  return item?.type === 'profile';
}

function isWallShortProfileSnapPair(moving, target, snapKind) {
  if (!WALL_SHORT_PROFILE_SNAP_KINDS.has(snapKind)) return false;
  if (!moving || !target) return false;
  const movingShort = isWallShortFamilyDescriptor(moving);
  const targetShort = isWallShortFamilyDescriptor(target);
  const movingProfile = isProfileModule(moving);
  const targetProfile = isProfileModule(target);
  return (movingShort && targetProfile) || (movingProfile && targetShort);
}

function segmentsShareCollidingBody(moduleA, moduleB) {
  const segmentA = getGroundSegment(moduleA);
  const segmentB = getGroundSegment(moduleB);
  if (!segmentA || !segmentB || segmentA.axis !== segmentB.axis) return false;
  const longitudinalOverlap = segmentA.startCm < segmentB.endCm - EPSILON_CM
    && segmentB.startCm < segmentA.endCm - EPSILON_CM;
  if (!longitudinalOverlap) return false;
  const centerLineGapCm = Math.abs(segmentA.fixedCm - segmentB.fixedCm);
  const requiredGapCm = (
    getModuleCollisionDepthCm(moduleA) + getModuleCollisionDepthCm(moduleB)
  ) / 2;
  return centerLineGapCm < requiredGapCm - EPSILON_CM;
}

function profileTouchesWallRailLine(wall, profile) {
  const wallRange = getModuleCollisionHeightRangeCm(wall);
  const profileRange = getModuleCollisionHeightRangeCm(profile);
  const touchesBottom = profileRange.minCm <= wallRange.minCm + EPSILON_CM
    && profileRange.maxCm > wallRange.minCm + EPSILON_CM;
  const touchesTop = profileRange.maxCm >= wallRange.maxCm - EPSILON_CM
    && profileRange.minCm < wallRange.maxCm - EPSILON_CM;
  return touchesBottom || touchesTop;
}

function isWallShortProfileRailJoint(wall, profile) {
  if (!isWallShortFamilyDescriptor(wall) || !isProfileModule(profile)) return false;
  if (!segmentsShareCollidingBody(wall, profile)) return false;
  return profileTouchesWallRailLine(wall, profile);
}

function wallShortProfileRailPlacement({
  target,
  movingAxis,
  pointerX,
  pointerY,
  width,
  rotationZDeg,
  standType,
  standXCm,
  itemKey,
}) {
  const alongCenter = movingAxis === 'x' ? Number(pointerX) : Number(pointerY);
  const start = alongCenter - width / 2;
  const end = start + width;
  if (!(start < target.endCm - EPSILON_CM && target.startCm < end - EPSILON_CM)) return null;
  const placement = createModulePlacement({
    xCm: movingAxis === 'x' ? start : target.fixedCm,
    yCm: movingAxis === 'y' ? start : target.fixedCm,
    zCm: resolveItemDefaultZCm(itemKey),
    rotationZDeg,
    wallId: 'free',
  });
  placement.wallId = inferPlacementWallId({ placement, standType, standXCm });
  return placement;
}

function namedWallShortProfileIsExempt(candidate, named, snapKind) {
  if (!isWallShortProfileSnapPair(candidate, named, snapKind)) return false;
  if (snapKind !== 'face') return true;
  const wall = isWallShortFamilyDescriptor(candidate) ? candidate : named;
  const profile = wall === candidate ? named : candidate;
  return isWallShortProfileRailJoint(wall, profile);
}

function wallShortProfileExemptIds(candidate, modules, snapTargetModuleId, snapKind) {
  const exempt = new Set();
  const named = modules.find((module) => module?.id === snapTargetModuleId);
  if (named && namedWallShortProfileIsExempt(candidate, named, snapKind)) exempt.add(named.id);
  if (isWallShortFamilyDescriptor(candidate)) {
    modules.forEach((module) => {
      if (!module || module.id === candidate.id) return;
      if (isWallShortProfileRailJoint(candidate, module)) exempt.add(module.id);
    });
    return exempt;
  }
  if (!isProfileModule(candidate)) return exempt;
  modules.forEach((module) => {
    if (!module || module.id === candidate.id) return;
    if (isWallShortProfileRailJoint(module, candidate)) exempt.add(module.id);
  });
  return exempt;
}

export const MID_WALL_TEE_MESSAGE = 'Dik bağlantı yalnız dikme olan noktaya yapılır.';

/** Profil ile profil: dik bağlantı (T) hedefin her noktasına yapılabilir. */
function isProfilePair(moduleA, moduleB) {
  return isProfileModule(moduleA) && isProfileModule(moduleB);
}

export const PROFILE_WALL_RAIL_MESSAGE = 'Profil duvara yalnız üst ya da alt ray hizasında dik bağlanır.';

// Ürün kararı (2026-11-11): T bağlantıyı yalnız profil yapar; profile, dikmeye ya da duvarın üst / alt
// rayına (o da profildir). Profilin yüksekliği duvarın üst ya da alt bağlantı çizgisine değmelidir.
function profileOnWallRail(profile, wall) {
  if (!isProfileModule(profile) || isProfileModule(wall)) return false;
  if (getModuleCollisionDepthCm(wall) > standWallDepthCm() + EPSILON_CM) return false;
  return profileTouchesWallRailLine(wall, profile);
}

/** Bırakılan profil hedefin ara noktalarına da (10 cm adım) yapışır: hedef profil ya da ince duvar (ray). */
function profileTeeInteriorStepCm(moduleType, target) {
  if (moduleType !== 'profile' || !target) return null;
  if (isProfileModule(target)) return PROFILE_TEE_SNAP_STEP_CM;
  return getModuleCollisionDepthCm(target) <= standWallDepthCm() + EPSILON_CM ? PROFILE_TEE_SNAP_STEP_CM : null;
}

// İki ince duvar dik kesişir ve yalnız birinin ucu diğerinin ortasına (dikmesiz yere) gelir.
function isMidWallTeeContact(moduleA, moduleB) {
  if (isProfilePair(moduleA, moduleB)) return false;
  const segmentsA = getModuleCollisionSegments(moduleA);
  const segmentsB = getModuleCollisionSegments(moduleB);
  return segmentsA.some(({ segment: a, module: ma }) => segmentsB.some(({ segment: b, module: mb }) => {
    if (a.axis === b.axis) return false;
    if (getModuleCollisionDepthCm(ma) > standWallDepthCm() + EPSILON_CM) return false;
    if (getModuleCollisionDepthCm(mb) > standWallDepthCm() + EPSILON_CM) return false;
    const horizontal = a.axis === 'x' ? a : b;
    const vertical = a.axis === 'y' ? a : b;
    const onHorizontal = vertical.fixedCm >= horizontal.startCm - EPSILON_CM && vertical.fixedCm <= horizontal.endCm + EPSILON_CM;
    const onVertical = horizontal.fixedCm >= vertical.startCm - EPSILON_CM && horizontal.fixedCm <= vertical.endCm + EPSILON_CM;
    if (!onHorizontal || !onVertical) return false;
    return pointIsSegmentEndpoint(horizontal, vertical.fixedCm) !== pointIsSegmentEndpoint(vertical, horizontal.fixedCm);
  }));
}

export function placementsOverlap(moduleA, moduleB) {
  if (canModulesOverlapByBehavior(moduleA, moduleB)) return false;
  if (getModuleCollisionStrategy(moduleA) === 'none' || getModuleCollisionStrategy(moduleB) === 'none') {
    return false;
  }
  if (!collisionHeightsOverlap(moduleA, moduleB)) return false;
  const angleA = normalizeModuleRotationZDeg(moduleA?.placement?.rotationZDeg);
  const angleB = normalizeModuleRotationZDeg(moduleB?.placement?.rotationZDeg);
  if (!isLCounterModule(moduleA) && !isLCounterModule(moduleB) && (!isCardinalModuleRotation(angleA) || !isCardinalModuleRotation(angleB))) {
    return orientedFootprintsOverlap(moduleA, moduleB);
  }
  const segmentsA = getModuleCollisionSegments(moduleA);
  const segmentsB = getModuleCollisionSegments(moduleB);
  if (!segmentsA.length || !segmentsB.length) return false;

  return segmentsA.some((entryA) => segmentsB.some((entryB) => collisionSegmentsOverlap(
    entryA.segment,
    entryA.module,
    entryB.segment,
    entryB.module,
  )));
}

/**
 * Dikme baza köşesinin üstünde (kullanıcı kararı 2026-11-11): gerçekte dikme ile baza birleştiği yerde
 * dikme durur, bazanın köşe dikmesinin (49,5) yerini alır, profil ve paneller ona bağlanır. Dikme
 * bazanın içinde, iki dış yüzüyle hizalı köşede duruyorsa bazayla çakışma sayılmaz; bazanın ortası
 * ya da yarım taşan dikme çakışmadır.
 */
function isUprightOnBaseCorner(upright, base) {
  if (upright?.type !== 'upright' || base?.type !== 'base') return false;
  if (!upright.placement || !base.placement) return false;
  if (!isCardinalModuleRotation(normalizeModuleRotationZDeg(upright.placement.rotationZDeg))) return false;
  if (!isCardinalModuleRotation(normalizeModuleRotationZDeg(base.placement.rotationZDeg))) return false;
  const center = getPlacementCenterCm(upright.placement, upright.widthCm);
  const bounds = getModuleFootprintBoundsCm(base);
  if (!center || !bounds) return false;
  const half = Number(upright.widthCm) / 2;
  const minX = center.xCm - half;
  const maxX = center.xCm + half;
  const minY = center.yCm - half;
  const maxY = center.yCm + half;
  const inside = minX >= bounds.minXCm - EPSILON_CM && maxX <= bounds.maxXCm + EPSILON_CM
    && minY >= bounds.minYCm - EPSILON_CM && maxY <= bounds.maxYCm + EPSILON_CM;
  if (!inside) return false;
  const onX = nearlyEqual(minX, bounds.minXCm) || nearlyEqual(maxX, bounds.maxXCm);
  const onY = nearlyEqual(minY, bounds.minYCm) || nearlyEqual(maxY, bounds.maxYCm);
  return onX && onY;
}

/**
 * Profil köşede dış yüzden hizalı (2026-11-12, short'un dikme kuralıyla aynı):
 * - Short'a dik gelen profil short ucundaki dikmenin üstüne biner; ucu short'un dış yüzünde, ekseni
 *   dikmenin ekseninde, ray hizasındadır.
 * - Profile dik gelen profil (L köşe) de aynı biçimde: ucu diğer profilin dış yüzünde, ekseni onun
 *   ucundaki kesit karesinin ortasında, aynı yükseklikte (kullanıcı kararı 2026-11-12, bütün profiller).
 * Böylece çerçeve bazayla birebir hizalanır (eskiden eksen ucuna bağlanıp 5 cm taşıyordu). Kesişim
 * yalnız hedefin ucundaki kesit karesiyse çakışma sayılmaz.
 */
export function isProfileFlushOnFrameEnd(profile, wall) {
  if (!isProfileModule(profile)) return false;
  if (isProfileModule(wall)) {
    if (!collisionHeightsOverlap(profile, wall)) return false;
  } else if (!isWallShortFamilyDescriptor(wall) || !profileTouchesWallRailLine(wall, profile)) {
    return false;
  }
  const profileSegment = getGroundSegment(profile);
  const wallSegment = getGroundSegment(wall);
  if (!profileSegment || !wallSegment || profileSegment.axis === wallSegment.axis) return false;
  const wallDepthCm = getModuleCollisionDepthCm(wall);
  const profileDepthCm = getModuleCollisionDepthCm(profile);
  if (!nearlyEqual(wallDepthCm, profileDepthCm)) return false;
  const half = wallDepthCm / 2;
  const atWallEnd = nearlyEqual(profileSegment.fixedCm, wallSegment.startCm + half)
    || nearlyEqual(profileSegment.fixedCm, wallSegment.endCm - half);
  if (!atWallEnd) return false;
  const wallMin = wallSegment.fixedCm - half;
  const wallMax = wallSegment.fixedCm + half;
  return (nearlyEqual(profileSegment.startCm, wallMin) && profileSegment.endCm > wallMax + EPSILON_CM)
    || (nearlyEqual(profileSegment.endCm, wallMax) && profileSegment.startCm < wallMin - EPSILON_CM);
}

/**
 * Profil gerçek boyundaki aralığa sığar (kullanıcı kararı 2026-11-13, proje 452d4cc1): aralık iki
 * ucun (dikme, duvar uç dikmesi, dik profil) eksenden eksene uzaklığıdır; Profil 190 eksenleri 190
 * cm aralıklı iki uç arasına girer. Sahne boyu (200) iki uçtaki düğüm karelerini örter; çizimde o
 * uçlar kısalır. Profil uçla aynı hatta ve uca yalnız ucundan, en çok kare kadar giriyorsa çakışma
 * sayılmaz; toplam giriş iki sahne fazlasını aşamaz (eksenleri 180 aralıklı iki uca Profil 190
 * girmez). Duvarda profil üst / alt ray hizasında olmalı; short hariç.
 */
export function getProfileSceneSlackCm(module) {
  if (!isProfileModule(module)) return 0;
  const realWidthCm = Number(getItem(module.itemKey)?.dimensions?.widthCm);
  const sceneWidthCm = Number(module.widthCm);
  if (!Number.isFinite(realWidthCm) || !Number.isFinite(sceneWidthCm)) return 0;
  return Math.max(0, sceneWidthCm - realWidthCm);
}

function profilePostOverlapAlong(profile, post) {
  if (!isProfileModule(profile) || !profile.placement || !post?.placement) return null;
  const isUpright = post.type === 'upright';
  const isCrossProfile = isProfileModule(post);
  if (!isUpright && !isCrossProfile && (!isWallFamilyModule(post) || isWallShortFamilyDescriptor(post))) return null;
  const slackCm = getProfileSceneSlackCm(profile);
  if (!(slackCm > EPSILON_CM)) return null;
  const profileSegment = getGroundSegment(profile);
  if (!profileSegment) return null;
  let square = null;
  if (isCrossProfile) {
    // Dik duran profilin yüzü de uçtur (profil profilin her noktasına dik bağlanır).
    const crossSegment = getGroundSegment(post);
    if (!crossSegment || crossSegment.axis === profileSegment.axis) return null;
    if (!collisionHeightsOverlap(profile, post)) return null;
    const half = getModuleCollisionDepthCm(post) / 2;
    if (profileSegment.fixedCm < crossSegment.startCm + half - EPSILON_CM
      || profileSegment.fixedCm > crossSegment.endCm - half + EPSILON_CM) return null;
    square = { from: crossSegment.fixedCm - half, to: crossSegment.fixedCm + half, center: profileSegment.fixedCm };
  } else if (isUpright) {
    const bounds = getModuleFootprintBoundsCm(post);
    if (!bounds) return null;
    square = profileSegment.axis === 'x'
      ? { from: bounds.minXCm, to: bounds.maxXCm, center: (bounds.minYCm + bounds.maxYCm) / 2 }
      : { from: bounds.minYCm, to: bounds.maxYCm, center: (bounds.minXCm + bounds.maxXCm) / 2 };
    if (!collisionHeightsOverlap(profile, post)) return null;
  } else {
    const wallSegment = getGroundSegment(post);
    if (!wallSegment || wallSegment.axis !== profileSegment.axis) return null;
    if (!profileTouchesWallRailLine(post, profile)) return null;
    const depthCm = getModuleCollisionDepthCm(post);
    // Profil duvarın dışından gelir, yalnız o uçtaki kareye girer (duvar boyunca uzanan profil değil).
    square = profileSegment.startCm < wallSegment.startCm - EPSILON_CM
      ? { from: wallSegment.startCm, to: wallSegment.startCm + depthCm, center: wallSegment.fixedCm, side: 'start' }
      : { from: wallSegment.endCm - depthCm, to: wallSegment.endCm, center: wallSegment.fixedCm, side: 'end' };
  }
  if (!nearlyEqual(profileSegment.fixedCm, square.center)) return null;
  const fromStart = square.side !== 'end'
    && profileSegment.endCm > square.from + EPSILON_CM && profileSegment.endCm <= square.to + EPSILON_CM
    && profileSegment.startCm < square.from - EPSILON_CM;
  const fromEnd = square.side !== 'start'
    && profileSegment.startCm < square.to - EPSILON_CM && profileSegment.startCm >= square.from - EPSILON_CM
    && profileSegment.endCm > square.to + EPSILON_CM;
  if (!fromStart && !fromEnd) return null;
  const overlapCm = fromStart ? profileSegment.endCm - square.from : square.to - profileSegment.startCm;
  return overlapCm <= square.to - square.from + EPSILON_CM ? overlapCm : null;
}

/**
 * Aynı hattaki iki profil bir düğümde buluşur (T ya da düz devam, kullanıcı projesi 452d4cc1): ikisi
 * de sahnede düğüm karesini örter. Örtüşme yalnız uçlarda, en çok kesit kalınlığı kadar ve orada bir
 * düğüm (dikme, dik profil, duvar ucu) varsa çakışma sayılmaz; ortadan geçen profiller çakışır.
 */
function isCollinearProfileNodeShare(profileA, profileB, modules) {
  if (!isProfileModule(profileA) || !isProfileModule(profileB)) return false;
  if (!collisionHeightsOverlap(profileA, profileB)) return false;
  const a = getGroundSegment(profileA);
  const b = getGroundSegment(profileB);
  if (!a || !b || a.axis !== b.axis || !nearlyEqual(a.fixedCm, b.fixedCm)) return false;
  const from = Math.max(a.startCm, b.startCm);
  const to = Math.min(a.endCm, b.endCm);
  const depthCm = Math.min(getModuleCollisionDepthCm(profileA), getModuleCollisionDepthCm(profileB));
  if (!(to - from > EPSILON_CM) || to - from > depthCm + EPSILON_CM) return false;
  // Uç uca: biri öbürünün içinden geçmiyor.
  if (!((nearlyEqual(from, b.startCm) && nearlyEqual(to, a.endCm)) || (nearlyEqual(from, a.startCm) && nearlyEqual(to, b.endCm)))) return false;
  const half = a.fixedCm;
  return modules.some((node) => {
    if (!node?.placement || node.id === profileA.id || node.id === profileB.id) return false;
    if (node.type !== 'upright' && !isProfileModule(node) && !isWallFamilyModule(node)) return false;
    if (!collisionHeightsOverlap(profileA, node)) return false;
    const bounds = getModuleFootprintBoundsCm(node);
    if (!bounds) return false;
    const [alongMin, alongMax, acrossMin, acrossMax] = a.axis === 'x'
      ? [bounds.minXCm, bounds.maxXCm, bounds.minYCm, bounds.maxYCm]
      : [bounds.minYCm, bounds.maxYCm, bounds.minXCm, bounds.maxXCm];
    return alongMin <= from + EPSILON_CM && alongMax >= to - EPSILON_CM
      && acrossMin <= half + EPSILON_CM && acrossMax >= half - EPSILON_CM
      && !(isProfileModule(node) && getGroundSegment(node)?.axis === a.axis);
  });
}

function isProfileEndInPost(profile, post) {
  return profilePostOverlapAlong(profile, post) !== null;
}

/**
 * Duvar (wall ailesi) bazanın arka kenarının içinde (kullanıcı kararı 2026-11-11, dikmeyle aynı kural):
 * duvar bazanın arka yüzüyle hizalı, bazanın arka şeridinde durur; baza o tarafta duvarın iskeletine
 * bağlanır. Bu durum çakışma sayılmaz; bazanın ön tarafındaki ya da ortasındaki duvar çakışmadır.
 * Bazanın ön yönü `baseRunBom.js` frontNormal ile aynıdır (0° → +y).
 */
// Wall ailesi: duvara yerleşen ince parça (düz duvar, kapı, vitrin, separatör; davranış `placement: wall`).
// Profil ve dikme duvar ailesi değildir: davranışları da duvara yerleşir ama ucu dikme sayılmaz
// (2026-11-13: profil ucu dikme sayılınca L köşe bırakma sırasına göre iki ayrı kurala oturuyordu).
function isWallFamilyModule(module) {
  if (!module?.type || module.type === 'base' || module.type === 'profile' || module.type === 'upright') return false;
  if (getModuleBehavior(module).placement !== 'wall') return false;
  return getModuleCollisionDepthCm(module) <= standWallDepthCm() + EPSILON_CM;
}

// Stand kenarındaki duvar: orta çizgisi stand sınırında (yarısı dışarıda).
function wallCenterLineOnStandEdge(segment, standXCm, standYCm) {
  const limit = segment.axis === 'x' ? Number(standYCm) : Number(standXCm);
  return nearlyEqual(segment.fixedCm, 0) || (Number.isFinite(limit) && nearlyEqual(segment.fixedCm, limit));
}

/**
 * Stand kenarındaki duvara yaslanan baza (kullanıcı kararı 2026-11-12): sınır dikmeler içindir,
 * bazanın ahşabı sınırı geçebilir. Duvarın orta çizgisi stand sınırındaysa (yarısı dışarıda) ve
 * duvar bazanın arka şeridindeyse (`isWallInBaseBack`, iç duvardaki gibi arka yüzler hizalı),
 * baza o tarafta duvarın yarı kalınlığı kadar sınır dışına taşabilir.
 */
function baseOverhangsEdgeWall({ placement, widthCm, depthCm, moduleType, shape = null, modules, standType, standXCm, standYCm }) {
  if (!isWallBackedFixture({ type: moduleType, shape }) || !placement) return false;
  const base = { type: moduleType, shape, widthCm, depthCm, placement };
  return modules.some((wall) => {
    if (!wall?.placement || !isWallInBaseBack(wall, base)) return false;
    const segment = getGroundSegment(wall);
    if (!segment || !wallCenterLineOnStandEdge(segment, standXCm, standYCm)) return false;
    const half = getModuleCollisionDepthCm(wall) / 2;
    // Duvarın içteki yarısı kadar içeri kaydırılmış baza sınıra sığıyorsa taşma yalnız duvar arkasındadır.
    const inward = nearlyEqual(segment.fixedCm, 0) ? half : -half;
    const shifted = {
      ...placement,
      xCm: segment.axis === 'y' ? Number(placement.xCm) + inward : placement.xCm,
      yCm: segment.axis === 'x' ? Number(placement.yCm) + inward : placement.yCm,
    };
    return validateModulePlacement({ placement: shifted, widthCm, depthCm, standType, standXCm, standYCm }).ok;
  });
}

// Duvara sırtını veren derin öğe: baza ve düz banko aynı kural (kullanıcı kararı 2026-11-12).
// L banko köşeli olduğu için dışarıda.
function isWallBackedFixture(module) {
  if (module?.type === 'base') return true;
  return module?.type === 'counter' && module?.shape !== 'L';
}

function isWallInBaseBack(wall, base) {
  if (!isWallBackedFixture(base) || !isWallFamilyModule(wall)) return false;
  if (!wall.placement || !base.placement) return false;
  if (!isCardinalModuleRotation(normalizeModuleRotationZDeg(base.placement.rotationZDeg))) return false;
  if (!isCardinalModuleRotation(normalizeModuleRotationZDeg(wall.placement.rotationZDeg))) return false;
  const baseSegment = getGroundSegment(base);
  const wallSegment = getGroundSegment(wall);
  if (!baseSegment || !wallSegment || baseSegment.axis !== wallSegment.axis) return false;
  const overlapsAlong = baseSegment.startCm < wallSegment.endCm - EPSILON_CM
    && wallSegment.startCm < baseSegment.endCm - EPSILON_CM;
  if (!overlapsAlong) return false;
  const theta = normalizeModuleRotationZDeg(base.placement.rotationZDeg) * Math.PI / 180;
  const frontAcross = baseSegment.axis === 'x' ? Math.cos(theta) : Math.sin(theta);
  if (Math.abs(frontAcross) < 0.5) return false;
  const front = Math.sign(frontAcross);
  const baseDepthCm = getModuleCollisionDepthCm(base);
  const wallDepthCm = getModuleCollisionDepthCm(wall);
  const backFaceCm = baseSegment.fixedCm - front * (baseDepthCm / 2);
  return nearlyEqual(wallSegment.fixedCm, backFaceCm + front * (wallDepthCm / 2));
}

export function validatePlacementAgainstModules({
  placement,
  widthCm,
  depthCm = null,
  moduleId = null,
  moduleType = null,
  itemKey = null,
  heightCm = null,
  shape = null,
  modules = [],
  standType,
  standXCm,
  standYCm,
  snapTargetModuleId = null,
  snapKind = null,
} = {}) {
  const moduleDescriptor = { type: moduleType, itemKey, heightCm, shape, widthCm, depthCm };
  const effectiveDepthCm = usesWallBackboneCollisionDepth(moduleDescriptor)
    ? standWallDepthCm()
    : depthCm;
  const boundary = validateModulePlacement({
    placement,
    widthCm,
    depthCm: effectiveDepthCm,
    standType,
    standXCm,
    standYCm,
  });
  if (!boundary.ok && !baseOverhangsEdgeWall({
    placement, widthCm, depthCm: effectiveDepthCm, moduleType, shape, modules, standType, standXCm, standYCm,
  })) return boundary;

  const candidate = {
    id: moduleId,
    type: moduleType,
    itemKey,
    heightCm,
    shape,
    widthCm,
    depthCm: effectiveDepthCm,
    placement,
  };
  const exemptIds = wallShortProfileExemptIds(
    candidate,
    modules,
    snapTargetModuleId,
    snapKind,
  );
  // Profilin uçlara toplam girişi iki sahne fazlasını aşamaz (eksenleri 180 aralıklı iki uca
  // Profil 190 girmez; eksenleri 190 aralıklı iki uca girer, iki kareyi örter).
  let postOverlapLeftCm = 2 * getProfileSceneSlackCm(candidate);
  const collision = modules.find((module) => {
    if (!module || module.id === moduleId) return false;
    if (exemptIds.has(module.id)) return false;
    if (isUprightOnBaseCorner(candidate, module) || isUprightOnBaseCorner(module, candidate)) return false;
    if (isProfileFlushOnFrameEnd(candidate, module) || isProfileFlushOnFrameEnd(module, candidate)) return false;
    if (isProfileEndInPost(module, candidate)) return false;
    if (isCollinearProfileNodeShare(candidate, module, modules)) return false;
    if (isWallInBaseBack(candidate, module) || isWallInBaseBack(module, candidate)) return false;
    const postOverlapCm = profilePostOverlapAlong(candidate, module);
    if (postOverlapCm !== null) {
      postOverlapLeftCm -= postOverlapCm;
      return postOverlapLeftCm < -EPSILON_CM;
    }
    return placementsOverlap(candidate, module);
  });

  if (collision) {
    return {
      ok: false,
      message: isMidWallTeeContact(candidate, collision)
        ? (isProfileModule(candidate) && !isProfileModule(collision) ? PROFILE_WALL_RAIL_MESSAGE : MID_WALL_TEE_MESSAGE)
        : 'Başka bir modülle çakışıyor.',
      collisionModuleId: collision.id,
    };
  }

  return { ok: true };
}

function getPlacementCenter(placement, widthCm) {
  const width = Number(widthCm);
  const x = Number(placement?.xCm);
  const y = Number(placement?.yCm);
  if (![width, x, y].every(Number.isFinite) || width <= 0) return null;
  const vertical = isVerticalModuleRotation(placement.rotationZDeg);
  return {
    xCm: x + (vertical ? 0 : width / 2),
    yCm: y + (vertical ? width / 2 : 0),
  };
}

function inferPlacementWallId({ placement, standType, standXCm } = {}) {
  if (!placement) return 'free';
  const allowedWalls = getAllowedWallIds(standType);
  const vertical = isVerticalModuleRotation(placement.rotationZDeg);
  const xCm = Number(placement.xCm);
  const yCm = Number(placement.yCm);
  const xLimit = Number(standXCm);

  if (!vertical && nearlyEqual(yCm, 0) && allowedWalls.includes('back')) return 'back';
  if (vertical && nearlyEqual(xCm, 0) && allowedWalls.includes('left')) return 'left';
  if (vertical && nearlyEqual(xCm, xLimit) && allowedWalls.includes('right')) return 'right';
  return 'free';
}

export function inferStandEdgeWallId(placement, standType, standXCm) {
  if (!placement) return 'free';
  if (placement.wallId && placement.wallId !== 'free') return placement.wallId;
  const allowedWalls = getAllowedWallIds(standType);
  const vertical = isVerticalModuleRotation(placement.rotationZDeg);
  const xCm = Number(placement.xCm);
  const yCm = Number(placement.yCm);
  const xLimit = Number(standXCm);
  const snap = MODULE_WALL_SNAP_DISTANCE_CM;
  if (!vertical && allowedWalls.includes('back') && Math.abs(yCm) <= snap) return 'back';
  if (vertical && allowedWalls.includes('left') && Math.abs(xCm) <= snap) return 'left';
  if (
    vertical
    && allowedWalls.includes('right')
    && Number.isFinite(xLimit)
    && Math.abs(xCm - xLimit) <= snap
  ) return 'right';
  return 'free';
}

export function withStandEdgeWallIds(modules = [], standType, standXCm) {
  return modules.map((module) => {
    const wallId = inferStandEdgeWallId(module?.placement, standType, standXCm);
    if (!module?.placement || wallId === 'free' || wallId === module.placement.wallId) return module;
    return {
      ...module,
      placement: { ...module.placement, wallId },
    };
  });
}

// Dik bağlantı noktası yalnız dikme olan yerdir: hedef modülün iki ucu. Modülün ortasında dikme
// yoktur; T, iki duvarın birleştiği uçta (ortak dikme) kurulur.
// Profil profile dik bağlanırken hedef profilin uçlarına ek olarak bu adımla ara noktalar aday olur.
export const PROFILE_TEE_SNAP_STEP_CM = 10;

function getSegmentSnapCoordinates(segment, { interiorStepCm = null } = {}) {
  if (nearlyEqual(segment.startCm, segment.endCm)) return [segment.startCm];
  const coordinates = [segment.startCm, segment.endCm];
  if (interiorStepCm > 0) {
    for (let cm = segment.startCm + interiorStepCm; cm < segment.endCm - EPSILON_CM; cm += interiorStepCm) {
      coordinates.push(cm);
    }
  }
  return coordinates;
}

function createEndpointConnectionPlacement({
  axis,
  pointXCm,
  pointYCm,
  widthCm,
  rotationZDeg,
  movingEndpoint,
  standType,
  standXCm,
}) {
  const width = Number(widthCm);
  const placement = createModulePlacement({
    xCm: axis === 'x'
      ? pointXCm - (movingEndpoint === 'end' ? width : 0)
      : pointXCm,
    yCm: axis === 'y'
      ? pointYCm - (movingEndpoint === 'end' ? width : 0)
      : pointYCm,
    zCm: 0,
    rotationZDeg,
    wallId: 'free',
  });
  placement.wallId = inferPlacementWallId({ placement, standType, standXCm });
  return placement;
}

function snapUprightToShortUpJoints({
  moduleId = null,
  widthCm,
  depthCm = null,
  pointerXCm,
  pointerYCm,
  modules = [],
  standType,
  standXCm,
  standYCm,
  snapDistanceCm = MODULE_NEIGHBOR_SNAP_DISTANCE_CM,
} = {}) {
  const width = Number(widthCm);
  const pointerX = Number(pointerXCm);
  const pointerY = Number(pointerYCm);
  const threshold = Number(snapDistanceCm);
  if (
    ![width, pointerX, pointerY, threshold].every(Number.isFinite)
    || width <= 0
    || threshold < 0
  ) return null;

  const candidates = [];
  const uprightHeightCm = Number(getItem('upright_346_5').dimensions.heightCm);
  const halfUprightCm = width / 2;
  modules.forEach((targetModule) => {
    if (!targetModule?.placement || targetModule.id === moduleId) return;
    // Baza / banko köşesi (bacak): bazada dikme köşenin üstünde, bankoda yan yüze ya da uç yüze
    // sıfır yaslı; kenarı köşeyle hizalı. 10 cm serbest ızgara dikme merkezini 55 gibi noktalara getiremiyordu.
    if (usesLogicalFixtureEndpoint(targetModule) && !isLCounterModule(targetModule)
      && hasStrictDepthBounds(getModuleCollisionDepthCm(targetModule))
      && isCardinalModuleRotation(normalizeModuleRotationZDeg(targetModule.placement.rotationZDeg))) {
      const bounds = getModuleFootprintBoundsCm(targetModule);
      if (bounds) {
        [[bounds.minXCm, -1], [bounds.maxXCm, 1]].forEach(([cornerXCm, sx]) => {
          [[bounds.minYCm, -1], [bounds.maxYCm, 1]].forEach(([cornerYCm, sy]) => {
            // Sınırlar dönüş trigonometrisinden gelir (ör. 55,000000000000014): 0,01 cm'ye yuvarlanır.
            const round = (value) => Math.round(value * 100) / 100;
            // Baza: dikme köşenin içinde, iki dış yüzüyle hizalı durur (kullanıcı kararı 2026-11-11;
            // bazanın köşe dikmesinin yerini alır). Banko: yan yüze ya da uç yüze sıfır yaslanır.
            const centers = targetModule.type === 'base'
              ? [{ xCm: round(cornerXCm - sx * halfUprightCm), yCm: round(cornerYCm - sy * halfUprightCm) }]
              : [
                { xCm: round(cornerXCm + sx * halfUprightCm), yCm: round(cornerYCm - sy * halfUprightCm) },
                { xCm: round(cornerXCm - sx * halfUprightCm), yCm: round(cornerYCm + sy * halfUprightCm) },
              ];
            centers.forEach((center) => {
              const distanceCm = Math.hypot(center.xCm - pointerX, center.yCm - pointerY);
              if (distanceCm > threshold + EPSILON_CM) return;
              const placement = placementFromCenterCm({
                centerXCm: center.xCm,
                centerYCm: center.yCm,
                widthCm: width,
                rotationZDeg: 0,
                template: { zCm: 0, wallId: 'free' },
              });
              const validation = validatePlacementAgainstModules({
                placement,
                widthCm: width,
                depthCm,
                moduleId,
                moduleType: 'upright',
                itemKey: 'upright_346_5',
                heightCm: uprightHeightCm,
                modules,
                standType,
                standXCm,
                standYCm,
              });
    if (!validation.ok) return;
              candidates.push({
                placement,
                targetModuleId: targetModule.id,
                snapKind: 'fixture-corner',
                priority: 0,
                distanceCm,
              });
            });
          });
        });
      }
    }
    if (!isUprightJointSnapTarget(targetModule)) return;
    const targetSegments = isLCounterModule(targetModule)
      ? getLCounterCollisionSegments(targetModule).map((entry) => entry.segment)
      : [getGroundSegment(targetModule)].filter(Boolean);
    const targetRotation = normalizeModuleRotationZDeg(targetModule.placement.rotationZDeg);
    const xLimit = Number(standXCm);
    const yLimit = Number(standYCm);
    targetSegments.forEach((target) => {
      if (!target) return;
      [target.startCm, target.endCm].forEach((endpointCm) => {
      const jointXCm = target.axis === 'x' ? endpointCm : target.fixedCm;
      const jointYCm = target.axis === 'y' ? endpointCm : target.fixedCm;
      const placement = placementFromCenterCm({
        centerXCm: jointXCm,
        centerYCm: jointYCm,
        widthCm: width,
        rotationZDeg: targetRotation,
        template: { zCm: 0, wallId: 'free' },
      });
      const vertical = isVerticalModuleRotation(targetRotation);
      placement.xCm = vertical
        ? clamp(Number(placement.xCm), 0, xLimit)
        : clamp(Number(placement.xCm), 0, xLimit - width);
      placement.yCm = vertical
        ? clamp(Number(placement.yCm), 0, yLimit - width)
        : clamp(Number(placement.yCm), 0, yLimit);
      placement.wallId = 'free';
      const distanceCm = Math.hypot(jointXCm - pointerX, jointYCm - pointerY);
      if (distanceCm > threshold + EPSILON_CM) return;

      const validation = validatePlacementAgainstModules({
        placement,
        widthCm: width,
        depthCm,
        moduleId,
        moduleType: 'upright',
        itemKey: 'upright_346_5',
        heightCm: Number(getItem('upright_346_5').dimensions.heightCm),
        modules,
        standType,
        standXCm,
        standYCm,
      });
    if (!validation.ok) return;

      candidates.push({
        placement,
        targetModuleId: targetModule.id,
        snapKind: 'short-up-joint',
        priority: 0,
        distanceCm,
      });
      });
    });
  });

  if (!candidates.length) return null;
  candidates.sort((a, b) => (
    a.distanceCm - b.distanceCm
    || String(a.targetModuleId).localeCompare(String(b.targetModuleId))
  ));
  const best = candidates[0];
  return {
    ok: true,
    mode: 'module-snap',
    placement: { ...best.placement },
    targetModuleId: best.targetModuleId,
    snapKind: best.snapKind,
    distanceCm: best.distanceCm,
  };
}

export function snapPlacementToModules({
  moduleId = null,
  moduleType = null,
  itemKey = null,
  heightCm = null,
  shape = null,
  widthCm,
  depthCm = null,
  pointerXCm,
  pointerYCm,
  rotationZDeg = 0,
  // Taşınan modülün bırakılınca alacağı taban Z'si (yalnız yüksekliğe bağlı adaylar kullanır).
  zCm = null,
  modules = [],
  standType,
  standXCm,
  standYCm,
  snapDistanceCm = MODULE_NEIGHBOR_SNAP_DISTANCE_CM,
} = {}) {
  const movingDescriptor = { type: moduleType, itemKey, heightCm, shape, widthCm, depthCm };
  if (getModuleMagneticSnapStrategy(movingDescriptor) === 'none') return null;
  if (getModuleMagneticSnapStrategy(movingDescriptor) === 'short-up-joint') {
    return snapUprightToShortUpJoints({
      moduleId,
      widthCm,
      depthCm,
      pointerXCm,
      pointerYCm,
      modules,
      standType,
      standXCm,
      standYCm,
      snapDistanceCm,
    });
  }

  const width = Number(widthCm);
  const pointerX = Number(pointerXCm);
  const pointerY = Number(pointerYCm);
  const threshold = Number(snapDistanceCm);
  if (
    ![width, pointerX, pointerY, threshold].every(Number.isFinite)
    || width <= 0
    || threshold < 0
  ) return null;

  const resolvedRotation = normalizeModuleRotationZDeg(rotationZDeg);
  if (!isCardinalModuleRotation(resolvedRotation)) return null;
  const movingAxis = isVerticalModuleRotation(resolvedRotation) ? 'y' : 'x';
  const effectiveMovingDepthCm = usesWallBackboneCollisionDepth(movingDescriptor)
    ? standWallDepthCm()
    : depthCm;
  const strictMovingDepth = hasStrictDepthBounds(effectiveMovingDepthCm);
  const movingDepthCm = strictMovingDepth
    ? Number(effectiveMovingDepthCm)
    : standWallDepthCm();
  const freePlacement = strictMovingDepth ? createFreePlacement({
    moduleType,
    widthCm: width,
    depthCm,
    pointerXCm: pointerX,
    pointerYCm: pointerY,
    standXCm,
    standYCm,
    standType,
    rotationZDeg: resolvedRotation,
  }) : null;
  const candidates = [];
  const counterCornerFaces = [];
  const isCounter = usesLogicalFixtureEndpoint(movingDescriptor);

  const addCandidate = (
    placement,
    targetModuleId,
    snapKind,
    priority = 0,
    distanceOverrideCm = null,
  ) => {
    const center = getPlacementCenter(placement, width);
    if (!center) return;
    const hasDistanceOverride = distanceOverrideCm !== null && distanceOverrideCm !== undefined;
    const overrideDistance = hasDistanceOverride ? Number(distanceOverrideCm) : Number.NaN;
    const distanceCm = Number.isFinite(overrideDistance)
      ? overrideDistance
      : Math.hypot(center.xCm - pointerX, center.yCm - pointerY);
    if (distanceCm > threshold + EPSILON_CM) return;

    const validation = validatePlacementAgainstModules({
      placement,
      widthCm: width,
      depthCm,
      moduleId,
      moduleType,
      itemKey,
      heightCm,
      shape,
      modules,
      standType,
      standXCm,
      standYCm,
      snapTargetModuleId: targetModuleId,
      snapKind,
    });
    if (!validation.ok) return;

    candidates.push({
      placement,
      targetModuleId,
      snapKind,
      priority,
      distanceCm,
    });
  };

  const rememberCounterFace = (placement, targetModule, constrainedAxis) => {
    if (!isCounter || !placement || !targetModule) return;
    counterCornerFaces.push({
      placement: { ...placement },
      targetModule,
      constrainedAxis,
    });
  };

  const addThinTargetCandidates = (target, targetModuleForDepth, targetModuleId) => {
    if (!target) return;

    if (target.axis === movingAxis) {
      if (movingAxis === 'x') {
        addCandidate(createEndpointConnectionPlacement({
          axis: 'x', pointXCm: target.endCm, pointYCm: target.fixedCm,
          widthCm: width, rotationZDeg: resolvedRotation, movingEndpoint: 'start',
          standType, standXCm,
        }), targetModuleId, 'end-to-end', 0);
        addCandidate(createEndpointConnectionPlacement({
          axis: 'x', pointXCm: target.startCm, pointYCm: target.fixedCm,
          widthCm: width, rotationZDeg: resolvedRotation, movingEndpoint: 'end',
          standType, standXCm,
        }), targetModuleId, 'end-to-end', 0);
      } else {
        addCandidate(createEndpointConnectionPlacement({
          axis: 'y', pointXCm: target.fixedCm, pointYCm: target.endCm,
          widthCm: width, rotationZDeg: resolvedRotation, movingEndpoint: 'start',
          standType, standXCm,
        }), targetModuleId, 'end-to-end', 0);
        addCandidate(createEndpointConnectionPlacement({
          axis: 'y', pointXCm: target.fixedCm, pointYCm: target.startCm,
          widthCm: width, rotationZDeg: resolvedRotation, movingEndpoint: 'end',
          standType, standXCm,
        }), targetModuleId, 'end-to-end', 0);
      }
      return;
    }

    const targetDepthCm = getModuleCollisionDepthCm(targetModuleForDepth);
    const thinMovingModule = movingDepthCm <= standWallDepthCm() + EPSILON_CM;
    const matchesFixtureSide = thinMovingModule
      && usesLogicalFixtureEndpoint(targetModuleForDepth)
      && targetDepthCm > standWallDepthCm() + EPSILON_CM
      && nearlyEqual(width, targetDepthCm);

    if (matchesFixtureSide) {
      [target.startCm, target.endCm].forEach((endpointCm) => {
        const placement = createModulePlacement({
          xCm: movingAxis === 'y' ? endpointCm : target.fixedCm - width / 2,
          yCm: movingAxis === 'y' ? target.fixedCm - width / 2 : endpointCm,
          zCm: 0,
          rotationZDeg: resolvedRotation,
          wallId: 'free',
        });
        placement.wallId = inferPlacementWallId({ placement, standType, standXCm });
        addCandidate(placement, targetModuleId, 'fixture-side', -2);
      });
    }

    getSegmentSnapCoordinates(target, {
      interiorStepCm: profileTeeInteriorStepCm(moduleType, targetModuleForDepth),
    }).forEach((coordinateCm) => {
      const pointXCm = target.axis === 'x' ? coordinateCm : target.fixedCm;
      const pointYCm = target.axis === 'y' ? coordinateCm : target.fixedCm;
      const targetEndpoint = nearlyEqual(coordinateCm, target.startCm)
        || nearlyEqual(coordinateCm, target.endCm);
      const snapKind = targetEndpoint ? 'corner' : 'tee';
      const priority = targetEndpoint ? 1 : 2;

      addCandidate(createEndpointConnectionPlacement({
        axis: movingAxis,
        pointXCm,
        pointYCm,
        widthCm: width,
        rotationZDeg: resolvedRotation,
        movingEndpoint: 'start',
        standType,
        standXCm,
      }), targetModuleId, snapKind, priority);

      addCandidate(createEndpointConnectionPlacement({
        axis: movingAxis,
        pointXCm,
        pointYCm,
        widthCm: width,
        rotationZDeg: resolvedRotation,
        movingEndpoint: 'end',
        standType,
        standXCm,
      }), targetModuleId, snapKind, priority);
    });
  };

  modules.forEach((targetModule) => {
    if (!targetModule?.placement || targetModule.id === moduleId) return;
    if (!strictMovingDepth && isLCounterModule(targetModule)) {
      getLCounterCollisionSegments(targetModule).forEach(({ segment, module: armModule }) => {
        addThinTargetCandidates(segment, armModule, targetModule.id);
      });
      return;
    }
    const target = getGroundSegment(targetModule);
    if (!target) return;

    if (strictMovingDepth) {
      if (!freePlacement) return;
      // Baza / banko yalnız dokunabileceği yükseklikteki öğeye yaslanır; tepedeki profil ya da
      // yukarıdaki kısa panel yüzüne mıknatıslanırsa stand kenarına sıfır oturamaz.
      if (!collisionHeightsOverlap(movingDescriptor, targetModule)) return;

      const targetDepthCm = getModuleCollisionDepthCm(targetModule);

      if (target.axis !== movingAxis) {
        const targetHalfDepthCm = targetDepthCm / 2;
        const logicalEndpointContact = isCounter
          && targetDepthCm <= standWallDepthCm() + EPSILON_CM;
        const endpointOffsetCm = logicalEndpointContact ? 0 : targetHalfDepthCm;
        const crossCenterCm = movingAxis === 'x'
          ? Number(freePlacement.yCm)
          : Number(freePlacement.xCm);
        const sideMinCm = crossCenterCm - movingDepthCm / 2;
        const sideMaxCm = crossCenterCm + movingDepthCm / 2;
        const crossOverlap = sideMinCm < target.endCm - EPSILON_CM
          && target.startCm < sideMaxCm - EPSILON_CM;
        if (!crossOverlap) return;

        [
          target.fixedCm + endpointOffsetCm,
          target.fixedCm - endpointOffsetCm - width,
        ].forEach((startCm) => {
          const placement = createModulePlacement({
            ...freePlacement,
            xCm: movingAxis === 'x' ? startCm : freePlacement.xCm,
            yCm: movingAxis === 'y' ? startCm : freePlacement.yCm,
            rotationZDeg: resolvedRotation,
            wallId: 'free',
          });
          const center = getPlacementCenter(placement, width);
          if (!center) return;
          const alongAxisDistanceCm = movingAxis === 'x'
            ? Math.abs(center.xCm - pointerX)
            : Math.abs(center.yCm - pointerY);
          rememberCounterFace(placement, targetModule, movingAxis);
          addCandidate(placement, targetModule.id, 'face', -1, alongAxisDistanceCm);
        });
        return;
      }

      // Aynı derinlikteki baza/banko uç uca aynı merkez çizgisinde durur.
      // Duvar yüzüne yaslı komşunun 30 cm çizgisi, 50 cm ızgaranın 25 cm'ine düşmez.
      if (hasStrictDepthBounds(targetDepthCm)) {
        const connect = (pointXCm, pointYCm, movingEndpoint) => {
          addCandidate(createEndpointConnectionPlacement({
            axis: movingAxis,
            pointXCm,
            pointYCm,
            widthCm: width,
            rotationZDeg: resolvedRotation,
            movingEndpoint,
            standType,
            standXCm,
          }), targetModule.id, 'end-to-end', -1);
        };
        if (movingAxis === 'x') {
          connect(target.endCm, target.fixedCm, 'start');
          connect(target.startCm, target.fixedCm, 'end');
        } else {
          connect(target.fixedCm, target.endCm, 'start');
          connect(target.fixedCm, target.startCm, 'end');
        }
      }

      // Baza duvara (wall ailesi) yaslanınca duvar bazanın arka kenarının içine girer, arka yüzler
      // hizalı (kullanıcı kararı 2026-11-11); çakışma istisnası `isWallInBaseBack` yalnız arka tarafı
      // geçirir. Diğer derin modüller yüzün önüne yaslanır.
      const baseIntoWall = isWallBackedFixture({ type: moduleType, shape }) && isWallFamilyModule(targetModule);
      const faceGapCm = baseIntoWall
        ? (movingDepthCm - targetDepthCm) / 2
        : (movingDepthCm + targetDepthCm) / 2;

      [-1, 1].forEach((direction) => {
        const placement = createModulePlacement({
          ...freePlacement,
          xCm: movingAxis === 'y'
            ? target.fixedCm + (direction * faceGapCm)
            : freePlacement.xCm,
          yCm: movingAxis === 'x'
            ? target.fixedCm + (direction * faceGapCm)
            : freePlacement.yCm,
          rotationZDeg: resolvedRotation,
          wallId: 'free',
        });

        const movingSegment = getGroundSegment({ widthCm: width, depthCm, placement });
        if (!movingSegment) return;
        const longitudinalOverlap = movingSegment.startCm < target.endCm - EPSILON_CM
          && target.startCm < movingSegment.endCm - EPSILON_CM;
        if (!longitudinalOverlap) return;

        const perpendicularDistanceCm = movingAxis === 'x'
          ? Math.abs(Number(placement.yCm) - pointerY)
          : Math.abs(Number(placement.xCm) - pointerX);
        rememberCounterFace(
          placement,
          targetModule,
          movingAxis === 'x' ? 'y' : 'x',
        );
        addCandidate(placement, targetModule.id, 'face', -1, perpendicularDistanceCm);

        // Yüze yaslanan derin modül hedefin ucuna da oturur (kullanıcı kararı 2026-11-12): ucu hedefin
        // ucuna yapışma mesafesinden yakınsa ızgarada kalmaz, hedefin başına ya da sonuna hizalanır.
        // Önce gelir (aynı dik mesafede öncelik −2), böylece baza duvarla birebir hizalanır.
        const alongField = movingAxis === 'x' ? 'xCm' : 'yCm';
        [target.startCm - movingSegment.startCm, target.endCm - movingSegment.endCm].forEach((shiftCm) => {
          if (Math.abs(shiftCm) < EPSILON_CM || Math.abs(shiftCm) > threshold + EPSILON_CM) return;
          const aligned = { ...placement, [alongField]: Math.round((Number(placement[alongField]) + shiftCm) * 100) / 100 };
          addCandidate(aligned, targetModule.id, 'face', -2, perpendicularDistanceCm);
        });
      });
      return;
    }

    if (target.axis === movingAxis) {
      if (isWallShortFamilyDescriptor(movingDescriptor) && isProfileModule(targetModule)) {
        const railPlacement = wallShortProfileRailPlacement({
          target,
          movingAxis,
          pointerX,
          pointerY,
          width,
          rotationZDeg: resolvedRotation,
          standType,
          standXCm,
          itemKey,
        });
        if (railPlacement) addCandidate(railPlacement, targetModule.id, 'face', -1);
      }
      // Aynı doğrultuda yalnızca gerçek uç-uca bağlantı üret.
      if (movingAxis === 'x') {
        addCandidate(createEndpointConnectionPlacement({
          axis: 'x', pointXCm: target.endCm, pointYCm: target.fixedCm,
          widthCm: width, rotationZDeg: resolvedRotation, movingEndpoint: 'start',
          standType, standXCm,
        }), targetModule.id, 'end-to-end', 0);
        addCandidate(createEndpointConnectionPlacement({
          axis: 'x', pointXCm: target.startCm, pointYCm: target.fixedCm,
          widthCm: width, rotationZDeg: resolvedRotation, movingEndpoint: 'end',
          standType, standXCm,
        }), targetModule.id, 'end-to-end', 0);
      } else {
        addCandidate(createEndpointConnectionPlacement({
          axis: 'y', pointXCm: target.fixedCm, pointYCm: target.endCm,
          widthCm: width, rotationZDeg: resolvedRotation, movingEndpoint: 'start',
          standType, standXCm,
        }), targetModule.id, 'end-to-end', 0);
        addCandidate(createEndpointConnectionPlacement({
          axis: 'y', pointXCm: target.fixedCm, pointYCm: target.startCm,
          widthCm: width, rotationZDeg: resolvedRotation, movingEndpoint: 'end',
          standType, standXCm,
        }), targetModule.id, 'end-to-end', 0);
      }
      return;
    }

    // İnce 50 cm panel, Banko/Baza gibi 50 cm derinlikli bir fixture'ın
    // kısa yan yüzüne geldiğinde merkez çizgisinden başlatma. Paneli fiziksel
    // yan yüzün tamamına ortala; böylece 150x50 Banko + 50 panel gerçek flush
    // köşe bağlantısı oluşturur ve collision motoru bunu yanlışlıkla reddetmez.
    const targetDepthCm = getModuleCollisionDepthCm(targetModule);
    const thinMovingModule = movingDepthCm <= standWallDepthCm() + EPSILON_CM;
    const matchesFixtureSide = thinMovingModule
      && usesLogicalFixtureEndpoint(targetModule)
      && targetDepthCm > standWallDepthCm() + EPSILON_CM
      && nearlyEqual(width, targetDepthCm);

    if (matchesFixtureSide) {
      [target.startCm, target.endCm].forEach((endpointCm) => {
        const placement = createModulePlacement({
          xCm: movingAxis === 'y' ? endpointCm : target.fixedCm - width / 2,
          yCm: movingAxis === 'y' ? target.fixedCm - width / 2 : endpointCm,
          zCm: 0,
          rotationZDeg: resolvedRotation,
          wallId: 'free',
        });
        placement.wallId = inferPlacementWallId({ placement, standType, standXCm });
        addCandidate(placement, targetModule.id, 'fixture-side', -2);
      });
    }

    // Dik modül: hedefin uçları aday (dikme olan nokta). Uçta komşu duvar varsa bağlantı T olur.
    // Profil profile ya da duvar rayına bağlanırken hedefin ara noktaları da adaydır.
    getSegmentSnapCoordinates(target, {
      interiorStepCm: profileTeeInteriorStepCm(moduleType, targetModule),
    }).forEach((coordinateCm) => {
      const pointXCm = target.axis === 'x' ? coordinateCm : target.fixedCm;
      const pointYCm = target.axis === 'y' ? coordinateCm : target.fixedCm;
      const targetEndpoint = nearlyEqual(coordinateCm, target.startCm)
        || nearlyEqual(coordinateCm, target.endCm);
      const snapKind = targetEndpoint ? 'corner' : 'tee';
      const priority = targetEndpoint ? 1 : 2;

      addCandidate(createEndpointConnectionPlacement({
        axis: movingAxis,
        pointXCm,
        pointYCm,
        widthCm: width,
        rotationZDeg: resolvedRotation,
        movingEndpoint: 'start',
        standType,
        standXCm,
      }), targetModule.id, snapKind, priority);

      addCandidate(createEndpointConnectionPlacement({
        axis: movingAxis,
        pointXCm,
        pointYCm,
        widthCm: width,
        rotationZDeg: resolvedRotation,
        movingEndpoint: 'end',
        standType,
        standXCm,
      }), targetModule.id, snapKind, priority);
    });
  });

  // Short dikme ailesine kendiliğinden yaslanır (kullanıcı kararı 2026-11-11): short'un ucu dikmenin
  // dış yüzüyle hizalanır, dikme short'un içinde kalır. Baza köşesine yaslanan dikmeler bazanın içinde
  // durduğundan short bazayla birebir hizalanır (eskiden short 10 cm ızgarada 5 cm taşıyordu). İki
  // dikmenin dış yüzleri arası short boyundaysa iki ucu birden oturan yer önceliklidir.
  if (isWallShortFamilyDescriptor(movingDescriptor)) {
    const round = (value) => Math.round(value * 100) / 100;
    const uprights = modules
      .filter((module) => module?.placement && module.id !== moduleId && module.type === 'upright'
        && isCardinalModuleRotation(normalizeModuleRotationZDeg(module.placement.rotationZDeg)))
      .map((module) => {
        // Dikmenin kendi eklem kuralı (`snapUprightToShortUpJoints`) gibi merkez yerleşimden ve
        // dikme genişliğinden kurulur (zemin izi değil).
        const center = getPlacementCenter(module.placement, module.widthCm);
        if (!center) return null;
        const half = Number(module.widthCm) / 2;
        const along = movingAxis === 'x' ? center.xCm : center.yCm;
        return {
          id: module.id,
          fixedCm: round(movingAxis === 'x' ? center.yCm : center.xCm),
          minCm: round(along - half),
          maxCm: round(along + half),
        };
      })
      .filter(Boolean);
    uprights.forEach((upright) => {
      // start: short dikmenin dış (min) yüzünden başlar ve onu örter; end: dış (max) yüzünde biter.
      [['start', upright.minCm], ['end', upright.maxCm]].forEach(([movingEndpoint, faceCm]) => {
        const placement = createEndpointConnectionPlacement({
          axis: movingAxis,
          pointXCm: movingAxis === 'x' ? faceCm : upright.fixedCm,
          pointYCm: movingAxis === 'y' ? faceCm : upright.fixedCm,
          widthCm: width,
          rotationZDeg: resolvedRotation,
          movingEndpoint,
          standType,
          standXCm,
        });
        const center = getPlacementCenter(placement, width);
        if (!center) return;
        const pointerDistanceCm = Math.hypot(center.xCm - pointerX, center.yCm - pointerY);
        if (pointerDistanceCm > threshold + EPSILON_CM) return;
        const startCm = movingEndpoint === 'start' ? faceCm : faceCm - width;
        const bothEnds = uprights.some((other) => other.id !== upright.id
          && nearlyEqual(other.fixedCm, upright.fixedCm)
          && (movingEndpoint === 'start'
            ? nearlyEqual(other.maxCm, startCm + width)
            : nearlyEqual(other.minCm, startCm)));
        addCandidate(
          placement,
          upright.id,
          'short-up-joint',
          bothEnds ? -3 : -1,
          bothEnds ? 0 : pointerDistanceCm,
        );
      });
    });
  }

  // Profil köşede dış yüzden hizalı (2026-11-12): short'un ucundaki dikmeye ya da dik profilin ucuna
  // biner; ucu hedefin dış yüzünde, ekseni hedefin ucundaki kesit karesinin ortasında. Çerçeve bazayla
  // birebir hizalanır. Eksen ucuna bağlanan eski köşe adayından (5 cm taşar) önce gelir.
  if (isProfileModule(movingDescriptor)) {
    const round = (value) => Math.round(value * 100) / 100;
    const movingZCm = zCm != null && Number.isFinite(Number(zCm)) ? Number(zCm) : resolveItemDefaultZCm(itemKey);
    const movingHeightCm = Number(heightCm) || 0;
    // Profil dikmeye ortalı yapışır (kullanıcı kararı 2026-11-12): hangi yönden gelirse gelsin ekseni
    // dikmenin merkezinde, ucu dikmenin yüzünde; dikmenin içine girmez.
    // Hedef dikmeler (kullanıcı kararı 2026-11-12, "dikme her yerde dikme"): bağımsız dikme (short'un
    // ucundaki dahil) ve duvar ailesinin (düz duvar, kapı, separatör, vitrin) iki uç dikmesi (uçtaki
    // kalınlık × kalınlık kare). Profil dört yönden ortalanır, dikmenin yüzünde durur, içine girmez.
    const postTargets = [];
    modules.forEach((module) => {
      if (!module?.placement || module.id === moduleId) return;
      if (!isCardinalModuleRotation(normalizeModuleRotationZDeg(module.placement.rotationZDeg))) return;
      if (module.type === 'upright') {
        const bounds = getModuleFootprintBoundsCm(module);
        if (bounds) postTargets.push({ module, post: bounds });
        return;
      }
      if (!isWallFamilyModule(module) || isWallShortFamilyDescriptor(module)) return;
      const segment = getGroundSegment(module);
      if (!segment) return;
      const half = getModuleCollisionDepthCm(module) / 2;
      [[segment.startCm, segment.startCm + 2 * half], [segment.endCm - 2 * half, segment.endCm]].forEach(([from, to]) => {
        postTargets.push({
          module,
          post: segment.axis === 'x'
            ? { minXCm: from, maxXCm: to, minYCm: segment.fixedCm - half, maxYCm: segment.fixedCm + half }
            : { minXCm: segment.fixedCm - half, maxXCm: segment.fixedCm + half, minYCm: from, maxYCm: to },
        });
      });
    });
    postTargets.forEach(({ module: upright, post }) => {
      const uprightRange = getModuleCollisionHeightRangeCm(upright);
      if (movingZCm > uprightRange.maxCm + EPSILON_CM || movingZCm + movingHeightCm < uprightRange.minCm - EPSILON_CM) return;
      const centerAcross = movingAxis === 'x' ? (post.minYCm + post.maxYCm) / 2 : (post.minXCm + post.maxXCm) / 2;
      const [minAlong, maxAlong] = movingAxis === 'x' ? [post.minXCm, post.maxXCm] : [post.minYCm, post.maxYCm];
      // end: profil dikmenin min yüzünde biter (öncesinden gelir); start: max yüzünden başlar.
      [['end', minAlong], ['start', maxAlong]].forEach(([movingEndpoint, faceCm]) => {
        const placement = createEndpointConnectionPlacement({
          axis: movingAxis,
          pointXCm: round(movingAxis === 'x' ? faceCm : centerAcross),
          pointYCm: round(movingAxis === 'y' ? faceCm : centerAcross),
          widthCm: width,
          rotationZDeg: resolvedRotation,
          movingEndpoint,
          standType,
          standXCm,
        });
        const center = getPlacementCenter(placement, width);
        if (!center) return;
        const pointerDistanceCm = Math.hypot(center.xCm - pointerX, center.yCm - pointerY);
        if (pointerDistanceCm > threshold + EPSILON_CM) return;
        placement.zCm = movingZCm;
        addCandidate(placement, upright.id, 'upright-face', -3, 0);
      });
    });

    // İki uç (dikme, duvar uç dikmesi ya da dik profil) arası profilin gerçek boyu kadarsa profil oraya
    // ortalı oturur (kullanıcı kararı 2026-11-13): sahne fazlası iki uca eşit girer (Profil 190: 200
    // sahne, 190 boşluk, uçlar 5 cm; Profil 388: 400 sahne, 388 boşluk).
    const movingSlackCm = getProfileSceneSlackCm({ type: 'profile', itemKey, widthCm: width });
    if (movingSlackCm > EPSILON_CM) {
      const lineOf = ({ module, post }) => {
        const range = getModuleCollisionHeightRangeCm(module);
        if (movingZCm > range.maxCm + EPSILON_CM || movingZCm + movingHeightCm < range.minCm - EPSILON_CM) return null;
        return movingAxis === 'x'
          ? { from: post.minXCm, to: post.maxXCm, across: (post.minYCm + post.maxYCm) / 2, module }
          : { from: post.minYCm, to: post.maxYCm, across: (post.minXCm + post.maxXCm) / 2, module };
      };
      // Uç: dikme / duvar uç dikmesi (tek hat) ya da dik duran profil (gövdesi boyunca her hat).
      const lines = postTargets.map(lineOf).filter(Boolean)
        .map((line) => ({ ...line, acrossMin: line.across, acrossMax: line.across, ends: [line.across] }));
      modules.forEach((module) => {
        if (module?.id === moduleId || !isProfileModule(module) || !module.placement) return;
        const segment = getGroundSegment(module);
        if (!segment || segment.axis === movingAxis) return;
        const range = getModuleCollisionHeightRangeCm(module);
        if (!(movingZCm < range.maxCm - EPSILON_CM && range.minCm < movingZCm + movingHeightCm - EPSILON_CM)) return;
        const half = getModuleCollisionDepthCm(module) / 2;
        lines.push({
          from: segment.fixedCm - half, to: segment.fixedCm + half, module,
          // Uç kareleri L köşedir (profil uçları dış yüzden örter, profile-flush-corner); burada yalnız
          // gövdeye T bağlantı.
          acrossMin: segment.startCm + 3 * half, acrossMax: segment.endCm - 3 * half,
          ends: [segment.startCm + half, segment.endCm - half],
        });
      });
      // Duvar gövdesi de uçtur: profil duvara ray hizasında dik bağlanır (T); uç dikmeleri postTargets'ta.
      modules.forEach((module) => {
        if (module?.id === moduleId || !module?.placement || !isWallFamilyModule(module) || isWallShortFamilyDescriptor(module)) return;
        const segment = getGroundSegment(module);
        if (!segment || segment.axis === movingAxis) return;
        if (!profileTouchesWallRailLine(module, { type: 'profile', itemKey, heightCm: movingHeightCm, widthCm: width, depthCm, placement: { xCm: 0, yCm: 0, zCm: movingZCm, rotationZDeg: resolvedRotation } })) return;
        const half = getModuleCollisionDepthCm(module) / 2;
        lines.push({
          from: segment.fixedCm - half, to: segment.fixedCm + half, module,
          acrossMin: segment.startCm + 3 * half, acrossMax: segment.endCm - 3 * half, ends: [],
        });
      });
      const pointerAcross = movingAxis === 'x' ? pointerY : pointerX;
      const acrossFor = (left, right) => {
        // U / H: iki ucun uç kareleri (ya da dikme ekseni) aynı hattaysa profil o hatta, iki kare
        // arasına girer (2026-11-13: çıkıntıların uçları arasında snap dört ayrı yere atlıyordu).
        const shared = left.ends.filter((end) => right.ends.some((other) => nearlyEqual(end, other)));
        const min = Math.max(left.acrossMin, right.acrossMin);
        const max = Math.min(left.acrossMax, right.acrossMax);
        if (min > max + EPSILON_CM) return shared;
        if (max - min <= EPSILON_CM) return [...shared, min];
        // İki profil arası: imlece en yakın 10 cm adım (profil T adımıyla aynı), uçlar dahil.
        const stepped = min + Math.round((pointerAcross - min) / PROFILE_TEE_SNAP_STEP_CM) * PROFILE_TEE_SNAP_STEP_CM;
        // İmleç uç karesinde ya da ona bir adım yakınsa (L / T köşe) aralık adayı yok; köşe kuralı
        // geçerli (2026-11-13: ön hattaki profil 10 cm geriye, dik profilin gövdesine oturuyordu).
        if (stepped < min + PROFILE_TEE_SNAP_STEP_CM - EPSILON_CM || stepped > max - PROFILE_TEE_SNAP_STEP_CM + EPSILON_CM) return shared;
        return [...shared, stepped];
      };
      lines.forEach((left) => {
        lines.forEach((right) => {
          if (left === right) return;
          acrossFor(left, right).forEach((acrossCm) => {
            // Eksenden eksene aralık profilin gerçek boyu kadarsa sığar (±1 cm); 180'e Profil 190 girmez.
            const centerGapCm = (right.from + right.to) / 2 - (left.from + left.to) / 2;
            const faceGapCm = right.from - left.to;
            if (!(faceGapCm > EPSILON_CM)) return;
            // İki uyum (kullanıcı kararı 2026-11-13, hepsi Profil 190): eksenden eksene gerçek boy (190;
            // iki düğüm karesini örter) ya da yüzden yüze sahne boyu (200; uçlara girmez).
            const fitsAxis = Math.abs(centerGapCm - (width - movingSlackCm)) <= 1 + EPSILON_CM;
            const fitsFace = Math.abs(faceGapCm - width) <= 1 + EPSILON_CM;
            // Eksenden eksene sahne boyu (ör. duvar ekseni 0, dikme ekseni 400; Profil 388): bir uçtan yüzden
            // başlar, öbür ucun karesini örter (çerçevedeki yan profil gibi).
            const fitsAxisScene = Math.abs(centerGapCm - width) <= 1 + EPSILON_CM;
            if (!fitsAxis && !fitsFace && !fitsAxisScene) return;
            // Arada başka uç yoksa.
            if (lines.some((other) => other !== left && other !== right
              && other.acrossMin <= acrossCm + EPSILON_CM && other.acrossMax >= acrossCm - EPSILON_CM
              && other.from < right.from - EPSILON_CM && other.to > left.to + EPSILON_CM)) return;
            // Duvar gövdesindeki ucun karesi örtülmez (duvarın yüzünden başlar).
            const leftIsWall = isWallFamilyModule(left.module);
            let startCm;
            if (fitsAxis) startCm = (left.from + left.to) / 2 - (width - centerGapCm) / 2;
            else if (fitsFace) startCm = left.to + (faceGapCm - width) / 2;
            else startCm = leftIsWall || !isWallFamilyModule(right.module) ? left.to : right.from - width;
            const placement = createEndpointConnectionPlacement({
              axis: movingAxis,
              pointXCm: round(movingAxis === 'x' ? startCm : acrossCm),
              pointYCm: round(movingAxis === 'y' ? startCm : acrossCm),
              widthCm: width,
              rotationZDeg: resolvedRotation,
              movingEndpoint: 'start',
              standType,
              standXCm,
            });
            const center = getPlacementCenter(placement, width);
            if (!center || Math.hypot(center.xCm - pointerX, center.yCm - pointerY) > threshold + EPSILON_CM) return;
            placement.zCm = movingZCm;
            addCandidate(placement, right.module.id, 'post-gap', -5, 0);
          });
        });
      });
    }

    // Short ucunda dikme var mı: dikme uç karesinin içinde ya da ucun hemen dışında, short'un yüzüne
    // değerek durabilir (2026-11-13: short dikmenin iç yüzünde bitiyordu, dikme karede aranınca
    // bulunamıyor, profil dikme yerine short ucuna 10 cm kaymış oturuyordu).
    const endSquareHoldsUpright = (segment, postCm, half) => {
      const outward = nearlyEqual(postCm, segment.startCm + half) ? -1 : 1;
      const nearCm = postCm - outward * half;
      const farCm = postCm + outward * 3 * half;
      const alongMin = Math.min(nearCm, farCm);
      const alongMax = Math.max(nearCm, farCm);
      const acrossMin = segment.fixedCm - half;
      const acrossMax = segment.fixedCm + half;
      return postTargets.some(({ post }) => {
        // Bağımsız dikme ya da duvar ailesinin uç dikmesi (dikme her yerde dikme).
        const [postAlongMin, postAlongMax, postAcrossMin, postAcrossMax] = segment.axis === 'x'
          ? [post.minXCm, post.maxXCm, post.minYCm, post.maxYCm]
          : [post.minYCm, post.maxYCm, post.minXCm, post.maxXCm];
        return postAlongMin < alongMax - EPSILON_CM && alongMin < postAlongMax - EPSILON_CM
          && postAcrossMin < acrossMax - EPSILON_CM && acrossMin < postAcrossMax - EPSILON_CM;
      });
    };
    // Köşe karesinde aynı hatta devam eden short / profil var mı (ör. short'un ucundaki dikmenin üstü)?
    const cornerSquareContinuesOnMovingLine = (placement, targetId) => {
      const moving = getGroundSegment({ widthCm: width, depthCm, placement });
      if (!moving) return false;
      return modules.some((other) => {
        if (!other?.placement || other.id === moduleId || other.id === targetId) return false;
        if (!isProfileModule(other) && !isWallShortFamilyDescriptor(other)) return false;
        const segment = getGroundSegment(other);
        if (!segment || segment.axis !== moving.axis) return false;
        if (Math.abs(segment.fixedCm - moving.fixedCm) >= movingDepthCm - EPSILON_CM) return false;
        const range = getModuleCollisionHeightRangeCm(other);
        if (!(movingZCm < range.maxCm - EPSILON_CM && range.minCm < movingZCm + movingHeightCm - EPSILON_CM)) return false;
        return segment.startCm < moving.endCm - EPSILON_CM && moving.startCm < segment.endCm - EPSILON_CM;
      });
    };
    modules.forEach((wall) => {
      if (!wall?.placement || wall.id === moduleId) return;
      const profileTarget = isProfileModule(wall);
      if (!profileTarget && !isWallShortFamilyDescriptor(wall)) return;
      if (profileTarget) {
        const range = getModuleCollisionHeightRangeCm(wall);
        if (!(movingZCm < range.maxCm - EPSILON_CM && range.minCm < movingZCm + movingHeightCm - EPSILON_CM)) return;
      }
      const segment = getGroundSegment(wall);
      if (!segment || segment.axis === movingAxis) return;
      const half = getModuleCollisionDepthCm(wall) / 2;
      [segment.startCm + half, segment.endCm - half].forEach((postCm) => {
        // Short ya da profil ucunda bağımsız dikme varsa o dikmedir: profil dikmenin yüzünde durur
        // (yukarıdaki dikme adayı), ucu örten köşe adayı üretilmez (2026-11-13: profil ucu dikmenin
        // yüzünde bitiyorsa köşe adayı yeni profili dikmenin 10 cm yanına oturtuyordu).
        if (endSquareHoldsUpright(segment, postCm, half)) return;
        [['start', segment.fixedCm - half], ['end', segment.fixedCm + half]].forEach(([movingEndpoint, faceCm]) => {
          const placement = createEndpointConnectionPlacement({
            axis: movingAxis,
            pointXCm: round(movingAxis === 'x' ? faceCm : postCm),
            pointYCm: round(movingAxis === 'y' ? faceCm : postCm),
            widthCm: width,
            rotationZDeg: resolvedRotation,
            movingEndpoint,
            standType,
            standXCm,
          });
          const center = getPlacementCenter(placement, width);
          if (!center) return;
          const pointerDistanceCm = Math.hypot(center.xCm - pointerX, center.yCm - pointerY);
          if (pointerDistanceCm > threshold + EPSILON_CM) return;
          placement.zCm = movingZCm;
          // Kare aynı hatta devam eden short / profilin ucuysa (kullanıcı kararı 2026-11-12) profil
          // kareye girmez: aynı eksende kalır, karenin (dikmenin) yüzünde biter.
          if (cornerSquareContinuesOnMovingLine(placement, wall.id)) {
            const faceStop = createEndpointConnectionPlacement({
              axis: movingAxis,
              pointXCm: round(movingAxis === 'x' ? faceCm + (movingEndpoint === 'start' ? 2 : -2) * half : postCm),
              pointYCm: round(movingAxis === 'y' ? faceCm + (movingEndpoint === 'start' ? 2 : -2) * half : postCm),
              widthCm: width,
              rotationZDeg: resolvedRotation,
              movingEndpoint,
              standType,
              standXCm,
            });
            faceStop.zCm = movingZCm;
            addCandidate(faceStop, wall.id, 'end-to-end', -3, 0);
            return;
          }
          addCandidate(placement, wall.id, profileTarget ? 'profile-flush-corner' : 'short-end-post', -3, 0);
        });
      });
    });
  }

  if (isCounter && counterCornerFaces.length > 1) {
    const touchesTargetFace = (placement, targetModule) => {
      const moving = getGroundSegment({ widthCm: width, depthCm, placement });
      const target = getGroundSegment(targetModule);
      if (!moving || !target) return false;

      const targetDepthCm = getModuleCollisionDepthCm(targetModule);
      if (moving.axis === target.axis) {
        const longitudinalOverlap = moving.startCm < target.endCm - EPSILON_CM
          && target.startCm < moving.endCm - EPSILON_CM;
        const centerLineGapCm = Math.abs(moving.fixedCm - target.fixedCm);
        return longitudinalOverlap
          && nearlyEqual(centerLineGapCm, (movingDepthCm + targetDepthCm) / 2);
      }

      const crossMinCm = moving.fixedCm - movingDepthCm / 2;
      const crossMaxCm = moving.fixedCm + movingDepthCm / 2;
      const crossOverlap = crossMinCm < target.endCm - EPSILON_CM
        && target.startCm < crossMaxCm - EPSILON_CM;
      const targetHalfDepthCm = targetDepthCm / 2;
      const logicalEndpointContact = isCounter
        && targetDepthCm <= standWallDepthCm() + EPSILON_CM;
      const targetFaces = logicalEndpointContact
        ? [target.fixedCm]
        : [target.fixedCm - targetHalfDepthCm, target.fixedCm + targetHalfDepthCm];
      const endpointContact = targetFaces.some((faceCm) => (
        nearlyEqual(moving.startCm, faceCm) || nearlyEqual(moving.endCm, faceCm)
      ));
      return crossOverlap && endpointContact;
    };

    const xFaces = counterCornerFaces.filter((entry) => entry.constrainedAxis === 'x');
    const yFaces = counterCornerFaces.filter((entry) => entry.constrainedAxis === 'y');

    xFaces.forEach((xFace) => {
      yFaces.forEach((yFace) => {
        if (xFace.targetModule.id === yFace.targetModule.id) return;
        const placement = createModulePlacement({
          ...freePlacement,
          xCm: xFace.placement.xCm,
          yCm: yFace.placement.yCm,
          rotationZDeg: resolvedRotation,
          wallId: 'free',
        });
        if (!touchesTargetFace(placement, xFace.targetModule)) return;
        if (!touchesTargetFace(placement, yFace.targetModule)) return;

        const center = getPlacementCenter(placement, width);
        if (!center) return;
        const cornerDistanceCm = Math.max(
          Math.abs(center.xCm - pointerX),
          Math.abs(center.yCm - pointerY),
        );
        addCandidate(placement, xFace.targetModule.id, 'corner-face', -2, cornerDistanceCm);
      });
    });
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => (
    a.distanceCm - b.distanceCm
    || a.priority - b.priority
    || String(a.targetModuleId).localeCompare(String(b.targetModuleId))
  ));

  const best = candidates[0];
  return {
    ok: true,
    mode: 'module-snap',
    placement: { ...best.placement },
    targetModuleId: best.targetModuleId,
    snapKind: best.snapKind,
    distanceCm: best.distanceCm,
  };
}

function createFreePlacement({
  moduleType = null,
  widthCm,
  depthCm = null,
  pointerXCm,
  pointerYCm,
  standXCm,
  standYCm,
  standType = null,
  rotationZDeg,
}) {
  const width = Number(widthCm);
  const placementSnapCm = getModulePlacementSnapCm(moduleType);
  const xLimit = Number(standXCm);
  const yLimit = Number(standYCm);
  const rotation = normalizeModuleRotationZDeg(rotationZDeg);
  const vertical = isVerticalModuleRotation(rotation);
  const strictDepth = hasStrictDepthBounds(depthCm);
  const halfDepth = strictDepth ? Number(depthCm) / 2 : 0;

  if (strictDepth && !isCardinalModuleRotation(rotation)) {
    const extents = getRotatedHalfExtentsCm(width, depthCm, rotation);
    if (xLimit < extents.halfX * 2 || yLimit < extents.halfY * 2) return null;
    const centerXCm = clamp(snapCm(pointerXCm, placementSnapCm), extents.halfX, xLimit - extents.halfX);
    const centerYCm = clamp(snapCm(pointerYCm, placementSnapCm), extents.halfY, yLimit - extents.halfY);
    return placementFromCenterCm({
      centerXCm,
      centerYCm,
      widthCm: width,
      rotationZDeg: rotation,
      template: { wallId: 'free' },
    });
  }

  const minX = vertical && strictDepth ? halfDepth : 0;
  const maxX = !vertical ? xLimit - width : (strictDepth ? xLimit - halfDepth : xLimit);
  const minY = !vertical && strictDepth ? halfDepth : 0;
  const maxY = vertical ? yLimit - width : (strictDepth ? yLimit - halfDepth : yLimit);
  if (maxX < minX || maxY < minY) return null;

  let xCm = !vertical
    ? clamp(snapCm(Number(pointerXCm) - width / 2, placementSnapCm), 0, maxX)
    : clamp(
        strictDepth ? snapDepthCenterCm(pointerXCm, depthCm, placementSnapCm) : snapCm(pointerXCm, placementSnapCm),
        minX,
        maxX,
      );
  let yCm = vertical
    ? clamp(snapCm(Number(pointerYCm) - width / 2, placementSnapCm), 0, maxY)
    : clamp(
        strictDepth ? snapDepthCenterCm(pointerYCm, depthCm, placementSnapCm) : snapCm(pointerYCm, placementSnapCm),
        minY,
        maxY,
      );

  if (strictDepth) {
    // Kenara yapışma yalnız bir adım (tür adımı) içinde; sabit 50 cm öğeyi uzaktan köşeye çekiyordu.
    const edgeSnap = placementSnapCm;
    const useWallInnerFaces = usesWallInnerFaceBoundary({ type: moduleType });
    const wallFaceOffsetCm = standWallDepthCm() / 2;
    const activeWalls = useWallInnerFaces ? getAllowedWallIds(standType) : [];
    const leftEdgeCm = activeWalls.includes('left') ? wallFaceOffsetCm : 0;
    const rightEdgeCm = activeWalls.includes('right') ? xLimit - wallFaceOffsetCm : xLimit;
    const backEdgeCm = activeWalls.includes('back') ? wallFaceOffsetCm : 0;

    if (!vertical) {
      if (xCm - leftEdgeCm <= edgeSnap + EPSILON_CM) xCm = leftEdgeCm;
      if (rightEdgeCm - (xCm + width) <= edgeSnap + EPSILON_CM) xCm = rightEdgeCm - width;
      if ((yCm - halfDepth) - backEdgeCm <= edgeSnap + EPSILON_CM) yCm = backEdgeCm + halfDepth;
      if (yLimit - (yCm + halfDepth) <= edgeSnap + EPSILON_CM) yCm = yLimit - halfDepth;
    } else {
      if ((xCm - halfDepth) - leftEdgeCm <= edgeSnap + EPSILON_CM) xCm = leftEdgeCm + halfDepth;
      if (rightEdgeCm - (xCm + halfDepth) <= edgeSnap + EPSILON_CM) xCm = rightEdgeCm - halfDepth;
      if (yCm - backEdgeCm <= edgeSnap + EPSILON_CM) yCm = backEdgeCm;
      if (yLimit - (yCm + width) <= edgeSnap + EPSILON_CM) yCm = yLimit - width;
    }
  }

  return createModulePlacement({
    xCm,
    yCm,
    rotationZDeg: rotation,
    wallId: 'free',
  });
}

export function snapPlacementToStand({
  standType,
  moduleType = null,
  widthCm,
  depthCm = null,
  forceFree = false,
  pointerXCm,
  pointerYCm,
  standXCm,
  standYCm,
  preferredRotationZDeg = 0,
  rotationLocked = false,
} = {}) {
  const width = Number(widthCm);
  const xLimit = Number(standXCm);
  const yLimit = Number(standYCm);
  const pointerX = Number(pointerXCm);
  const pointerY = Number(pointerYCm);
  const walls = getAllowedWallIds(standType);

  if (
    !walls.length
    || ![width, xLimit, yLimit, pointerX, pointerY].every(Number.isFinite)
    || width <= 0
  ) {
    return { ok: false, message: 'Yerleşim için geçerli stand ve modül ölçüleri gerekli.' };
  }

  const preferredRotation = normalizeModuleRotationZDeg(preferredRotationZDeg);
  const freePlacement = createFreePlacement({
    moduleType,
    widthCm: width,
    depthCm,
    pointerXCm: pointerX,
    pointerYCm: pointerY,
    standXCm: xLimit,
    standYCm: yLimit,
    standType,
    rotationZDeg: preferredRotation,
  });

  const activeBoundaryWalls = walls.filter((wallId) => wallId !== 'free');
  const boundaryCandidates = activeBoundaryWalls.map((wallId) => {
    const wallRotation = wallId === 'back' ? 0 : (wallId === 'left' ? 90 : 270);
    const wallIsVertical = wallId !== 'back';
    if (rotationLocked && wallIsVertical !== isVerticalModuleRotation(preferredRotation)) return null;
    const resolvedRotation = rotationLocked ? preferredRotation : wallRotation;

    if (wallId === 'back') {
      if (width > xLimit) return null;
      return {
        distanceCm: Math.abs(pointerY),
        placement: createModulePlacement({
          xCm: clamp(snapCm(pointerX - width / 2), 0, xLimit - width),
          yCm: 0,
          rotationZDeg: resolvedRotation,
          wallId,
        }),
      };
    }

    if (width > yLimit) return null;
    const wallX = wallId === 'left' ? 0 : xLimit;
    return {
      distanceCm: Math.abs(pointerX - wallX),
      placement: createModulePlacement({
        xCm: wallX,
        yCm: clamp(snapCm(pointerY - width / 2), 0, yLimit - width),
        rotationZDeg: resolvedRotation,
        wallId,
      }),
    };
  }).filter(Boolean).sort((a, b) => a.distanceCm - b.distanceCm);

  const nearestBoundary = boundaryCandidates[0];
  if (!forceFree && nearestBoundary?.distanceCm <= MODULE_WALL_SNAP_DISTANCE_CM) {
    return { ok: true, placement: nearestBoundary.placement, mode: 'wall' };
  }

  if (!freePlacement) return { ok: false, message: 'Modül aktif stand alanına sığmıyor.' };
  return { ok: true, placement: freePlacement, mode: 'free' };
}


function getVisualRightVector(rotationZDeg) {
  const radians = normalizeModuleRotationZDeg(rotationZDeg) * Math.PI / 180;
  return { x: Math.cos(radians), y: -Math.sin(radians) };
}

export function createFreeSidePlacement({
  sourcePlacement,
  sourceWidthCm,
  insertedWidthCm,
  side = 'right',
} = {}) {
  if (!sourcePlacement || (side !== 'left' && side !== 'right')) return null;
  const sourceWidth = Number(sourceWidthCm);
  const insertedWidth = Number(insertedWidthCm);
  if (![sourceWidth, insertedWidth].every(Number.isFinite) || sourceWidth <= 0 || insertedWidth <= 0) return null;

  const rotationZDeg = normalizeModuleRotationZDeg(sourcePlacement.rotationZDeg);
  const sourceCenter = getPlacementCenterCm(sourcePlacement, sourceWidth);
  if (!sourceCenter) return null;
  const right = getVisualRightVector(rotationZDeg);
  const direction = side === 'right' ? 1 : -1;
  const centerDistance = (sourceWidth + insertedWidth) / 2;

  return placementFromCenterCm({
    centerXCm: sourceCenter.xCm + right.x * centerDistance * direction,
    centerYCm: sourceCenter.yCm + right.y * centerDistance * direction,
    widthCm: insertedWidth,
    rotationZDeg,
    template: {
      zCm: sourcePlacement.zCm ?? 0,
      wallId: 'free',
    },
  });
}

function createFreeSideFixturePlacement({
  sourceModule,
  insertedModule,
  side,
  standXCm,
  standYCm,
} = {}) {
  if (!sourceModule?.placement || !insertedModule) return null;
  const sourceWidth = Number(sourceModule.widthCm);
  const sourceDepth = Number(sourceModule.depthCm);
  const insertedWidth = Number(insertedModule.widthCm);
  const insertedDepth = Number(insertedModule.depthCm);
  if (![sourceWidth, insertedWidth, insertedDepth].every(Number.isFinite)) return null;

  const sourceRotation = normalizeModuleRotationZDeg(sourceModule.placement.rotationZDeg);
  const insertedRotation = normalizeModuleRotationZDeg(
    resolveSideInsertRotationDeg(insertedModule, sourceRotation),
  );
  const right = getVisualRightVector(sourceRotation);
  const direction = side === 'right' ? 1 : -1;
  const sourceCenter = getPlacementCenterCm(sourceModule.placement, sourceWidth);
  if (!sourceCenter) return null;

  const sourcePhysicalDepth = Number.isFinite(sourceDepth) && sourceDepth > 0
    ? sourceDepth
    : standWallDepthCm();
  const sourceExtents = getRotatedHalfExtentsCm(sourceWidth, sourcePhysicalDepth, sourceRotation);
  const insertedExtents = getRotatedHalfExtentsCm(insertedWidth, insertedDepth, insertedRotation);
  const centerDistance = Math.abs(right.x) * (sourceExtents.halfX + insertedExtents.halfX)
    + Math.abs(right.y) * (sourceExtents.halfY + insertedExtents.halfY);

  let centerXCm = sourceCenter.xCm + right.x * centerDistance * direction;
  let centerYCm = sourceCenter.yCm + right.y * centerDistance * direction;
  const xLimit = Number(standXCm);
  const yLimit = Number(standYCm);
  if (![centerXCm, centerYCm, xLimit, yLimit].every(Number.isFinite)) return null;

  // Yan teması koru, dik ekseni kısıtla; daha derin ürünler stand içinde kalsın.
  const perpendicular = { x: -right.y, y: right.x };
  const minCenterX = insertedExtents.halfX;
  const maxCenterX = xLimit - insertedExtents.halfX;
  const minCenterY = insertedExtents.halfY;
  const maxCenterY = yLimit - insertedExtents.halfY;
  if (maxCenterX < minCenterX || maxCenterY < minCenterY) return null;

  if (Math.abs(perpendicular.x) > Math.abs(perpendicular.y)) {
    centerXCm = clamp(centerXCm, minCenterX, maxCenterX);
  } else {
    centerYCm = clamp(centerYCm, minCenterY, maxCenterY);
  }

  return placementFromCenterCm({
    centerXCm,
    centerYCm,
    widthCm: insertedWidth,
    rotationZDeg: insertedRotation,
    template: {
      zCm: insertedModule.placement?.zCm ?? sourceModule.placement.zCm ?? 0,
      wallId: 'free',
    },
  });
}

export function planFreeSideInsertion({
  modules = [],
  insertedModules = [],
  targetModuleId,
  side = 'right',
  standType,
  standXCm,
  standYCm,
} = {}) {
  if (side !== 'left' && side !== 'right') {
    return { ok: false, message: 'Ekleme yönü geçersiz.' };
  }
  const sourceModule = modules.find((module) => module?.id === targetModuleId);
  if (!sourceModule?.placement || sourceModule.placement.wallId !== 'free') {
    return { ok: false, message: 'Hedef modül serbest yerleşimde değil.' };
  }
  if (!insertedModules.length) {
    return { ok: false, message: 'Eklenecek modül bulunamadı.' };
  }

  // insertedModules görsel soldan sağa seçim sırasıdır. Sol tarafa eklerken
  // hedefe en yakın modül listenin sonundaki olacağı için fiziksel planı tersten kurarız.
  const physicalOrder = side === 'left'
    ? [...insertedModules].reverse()
    : [...insertedModules];
  const placements = new Map();
  const plannedModules = [];
  let anchorPlacement = sourceModule.placement;
  let anchorWidthCm = Number(sourceModule.widthCm);

  for (const module of physicalOrder) {
    const anchorModule = plannedModules.length
      ? plannedModules[plannedModules.length - 1]
      : sourceModule;
    const nextPlacement = hasStrictDepthBounds(module.depthCm)
      ? createFreeSideFixturePlacement({
          sourceModule: { ...anchorModule, placement: anchorPlacement, widthCm: anchorWidthCm },
          insertedModule: module,
          side,
          standXCm,
          standYCm,
        })
      : createFreeSidePlacement({
          sourcePlacement: anchorPlacement,
          sourceWidthCm: anchorWidthCm,
          insertedWidthCm: module.widthCm,
          side,
        });
    if (!nextPlacement) {
      return { ok: false, message: 'Serbest komşu yerleşimi hesaplanamadı.' };
    }
    // Yükseklik komşudan kopyalanmaz: yeni öğe kendi varsayılan Z'sinden başlar, komşunun kendi
    // varsayılanından farkı korunur. Kısa panelin yanına kısa panel aynı hizaya, Panel zemine gelir.
    nextPlacement.zCm = Math.max(0, Number(anchorPlacement.zCm ?? 0)
      - resolveItemDefaultZCm(anchorModule.itemKey)
      + resolveItemDefaultZCm(module.itemKey));

    const validation = validatePlacementAgainstModules({
      placement: nextPlacement,
      widthCm: module.widthCm,
      depthCm: module.depthCm,
      moduleId: module.id,
      moduleType: module.type,
      itemKey: module.itemKey,
      heightCm: module.heightCm,
      shape: module.shape,
      modules: [...modules, ...plannedModules],
      standType,
      standXCm,
      standYCm,
    });
    if (!validation.ok) return validation;

    placements.set(module.id, nextPlacement);
    plannedModules.push({ ...module, placement: nextPlacement });
    anchorPlacement = nextPlacement;
    anchorWidthCm = Number(module.widthCm);
  }

  return {
    ok: true,
    placements,
    insertedModuleIds: insertedModules.map((module) => module.id),
  };
}
