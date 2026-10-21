import { getStandDimensions } from './standDimensions.js';
import { getItem, getItemSnapSpec, getItemType, listRegisteredItems, isWallShortFamilyDescriptor, resolveItemDefaultZCm, resolveModuleSceneBoxCm } from './items.js';

const DEFAULT_GHOST_BEHAVIOR = Object.freeze({
  kind: 'silhouette',
  renderer: 'module-silhouette',
  opacity: 0.38,
});

const NO_OVERLAP_TYPES = Object.freeze([]);

/** Kesit 1 bilinmeyen tip fallback — üretimde tip satırı bootstrap’tan gelir. */
const DEFAULT_PLACEMENT_SLICE = Object.freeze({
  placement: 'wall',
  moveSnapCm: 10,
  collision: 'segment',
});

/** Kesit 2 bilinmeyen tip fallback. */
const DEFAULT_POLICY_SLICE = Object.freeze({
  magneticSnap: 'standard',
  allowSideInsert: true,
  supportsWallOverlayMount: true,
  wallCapacity: 'include',
});

/** Kesit 3 bilinmeyen tip fallback. */
const DEFAULT_CONTACT_SLICE = Object.freeze({
  connectionEndpoint: 'segment',
  collisionDepth: 'physical',
  endpointContact: 'standard',
  boundarySnap: 'stand-edge',
  collisionHeight: 'full',
  overlapWithTypes: NO_OVERLAP_TYPES,
  ghost: DEFAULT_GHOST_BEHAVIOR,
});

const DEFAULT_BEHAVIOR = Object.freeze({
  ...DEFAULT_PLACEMENT_SLICE,
  ...DEFAULT_POLICY_SLICE,
  ...DEFAULT_CONTACT_SLICE,
});

/**
 * Eski TYPE_BEHAVIORS anahtarları — bootstrap eksikse fail-fast için.
 * Alan değerleri DB’de; burası yalnız bilinen tip kümesi.
 */
const KNOWN_BEHAVIOR_TYPE_KEYS = Object.freeze(new Set([
  'flat-panel',
  'showcase-3',
  'showcase-2',
  'shelf',
  'door',
  'base-wall',
  'separator',
  'counter',
  'base',
  'sofa-set-classic',
  'sofa-single-classic',
  'sofa-double-classic',
  'coffee-table-classic',
  'table-chair-set-eames',
  'chair',
  'table-glass',
  'bar-stool',
  'mini-fridge',
  'kettle',
  'coat-rack',
  'floor-showcase',
  'brochure-stand',
  'plastic-trash-bin',
  'box-block',
  'upright',
  'profile',
  'indoor-plant-1',
  'illuminated-foam',
  'tv',
  'led-floodlight',
]));

function normalizeDescriptor(moduleOrType) {
  if (typeof moduleOrType === 'string') return { type: moduleOrType };
  return moduleOrType ?? {};
}

function resolveRotationItem(moduleOrType) {
  const module = normalizeDescriptor(moduleOrType);
  const itemKey = module.itemKey
    ?? (typeof moduleOrType === 'string' ? moduleOrType : null);
  if (!itemKey) {
    throw new TypeError('Module rotation requires itemKey.');
  }
  const item = getItem(itemKey);
  if (!item) {
    throw new TypeError(`Unknown Item for rotation: ${itemKey}.`);
  }
  return item;
}

export function hasExplicitModuleBehavior(moduleOrType) {
  const module = normalizeDescriptor(moduleOrType);
  const type = module.type ?? null;
  if (type === null) return false;
  if (KNOWN_BEHAVIOR_TYPE_KEYS.has(type)) return true;
  const dbType = getItemType(type);
  return dbType != null && typeof dbType.placement === 'string';
}

function readPlacementSliceFromDb(dbType) {
  if (!dbType) return null;
  if (typeof dbType.placement !== 'string' || !dbType.placement) return null;
  if (typeof dbType.collision !== 'string' || !dbType.collision) return null;
  const moveSnapCm = Number(dbType.moveSnapCm);
  if (!Number.isFinite(moveSnapCm) || moveSnapCm <= 0) return null;
  return Object.freeze({
    placement: dbType.placement,
    collision: dbType.collision,
    moveSnapCm,
  });
}

function readPolicySliceFromDb(dbType) {
  if (!dbType) return null;
  if (typeof dbType.magneticSnap !== 'string' || !dbType.magneticSnap) return null;
  if (typeof dbType.allowSideInsert !== 'boolean') return null;
  if (typeof dbType.supportsWallOverlayMount !== 'boolean') return null;
  if (typeof dbType.wallCapacity !== 'string' || !dbType.wallCapacity) return null;
  return Object.freeze({
    magneticSnap: dbType.magneticSnap,
    allowSideInsert: dbType.allowSideInsert,
    supportsWallOverlayMount: dbType.supportsWallOverlayMount,
    wallCapacity: dbType.wallCapacity,
  });
}

function readContactSliceFromDb(dbType) {
  if (!dbType) return null;
  if (typeof dbType.connectionEndpoint !== 'string' || !dbType.connectionEndpoint) return null;
  if (typeof dbType.collisionDepth !== 'string' || !dbType.collisionDepth) return null;
  if (typeof dbType.endpointContact !== 'string' || !dbType.endpointContact) return null;
  if (typeof dbType.boundarySnap !== 'string' || !dbType.boundarySnap) return null;
  if (typeof dbType.collisionHeight !== 'string' || !dbType.collisionHeight) return null;
  if (!Array.isArray(dbType.overlapWithTypes)) return null;
  const ghost = dbType.ghost;
  if (!ghost || typeof ghost !== 'object') return null;
  if (typeof ghost.kind !== 'string' || !ghost.kind) return null;
  if (typeof ghost.renderer !== 'string' || !ghost.renderer) return null;
  const opacity = Number(ghost.opacity);
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) return null;
  return Object.freeze({
    connectionEndpoint: dbType.connectionEndpoint,
    collisionDepth: dbType.collisionDepth,
    endpointContact: dbType.endpointContact,
    boundarySnap: dbType.boundarySnap,
    collisionHeight: dbType.collisionHeight,
    overlapWithTypes: Object.freeze([...dbType.overlapWithTypes].map(String)),
    ghost: Object.freeze({
      kind: ghost.kind,
      renderer: ghost.renderer,
      opacity,
    }),
  });
}

function registeredTypeHasSceneBehavior(dbType) {
  return Boolean(
    readPlacementSliceFromDb(dbType)
    && readPolicySliceFromDb(dbType)
    && readContactSliceFromDb(dbType),
  );
}

/** Dilim 4: kesit 1+2+3 yalnız DB. Kayıtlı tipte behavior yoksa fail-closed. */
function resolveDbBehaviorSlices(type) {
  const dbType = type ? getItemType(type) : null;
  if (dbType && !registeredTypeHasSceneBehavior(dbType)) {
    throw new TypeError(`Item type "${type}" has no scene behavior.`);
  }
  const placement = readPlacementSliceFromDb(dbType);
  const policy = readPolicySliceFromDb(dbType);
  const contact = readContactSliceFromDb(dbType);
  if (placement && policy && contact) {
    return Object.freeze({ ...placement, ...policy, ...contact });
  }
  if (type && KNOWN_BEHAVIOR_TYPE_KEYS.has(type)) {
    throw new TypeError(
      `Item type "${type}" is missing kesit1/kesit2/kesit3 behavior fields in catalog bootstrap.`,
    );
  }
  return Object.freeze({
    ...DEFAULT_PLACEMENT_SLICE,
    ...DEFAULT_POLICY_SLICE,
    ...DEFAULT_CONTACT_SLICE,
  });
}

export function getModuleBehavior(moduleOrType) {
  const module = normalizeDescriptor(moduleOrType);
  const type = module.type ?? null;
  if (type === null) return DEFAULT_BEHAVIOR;
  return resolveDbBehaviorSlices(type);
}

export function getModuleRotationStepDeg(moduleOrType) {
  const value = Number(resolveRotationItem(moduleOrType).rotationStepDeg);
  if (!Number.isFinite(value)) {
    throw new TypeError('Item rotationStepDeg is missing.');
  }
  return value;
}

export function resolveModuleRotationDeltaDeg(moduleOrType, requestedDeltaDeg) {
  const requested = Number(requestedDeltaDeg) || 0;
  if (requested === 0) return 0;
  const stepDeg = getModuleRotationStepDeg(moduleOrType);
  return requested < 0 ? -stepDeg : stepDeg;
}

export function getModuleDefaultRotationDeg(moduleOrType) {
  const value = Number(resolveRotationItem(moduleOrType).defaultRotationDeg);
  if (!Number.isFinite(value)) {
    throw new TypeError('Item defaultRotationDeg is missing.');
  }
  return value;
}

export function getModuleMoveSnapCm(moduleOrType) {
  return Number(getModuleBehavior(moduleOrType).moveSnapCm) || 10;
}

export function getModuleCollisionStrategy(moduleOrType) {
  return getModuleBehavior(moduleOrType).collision ?? 'segment';
}

export function getModuleCollisionHeightRangeCm(moduleOrType) {
  const module = normalizeDescriptor(moduleOrType);
  let { heightCm } = resolveModuleSceneBoxCm(module, { clampToStandCeiling: true });
  if (heightCm == null) {
    const item = module.itemKey ? getItem(module.itemKey) : null;
    if (item) {
      throw new TypeError(`Item ${module.itemKey} is missing scene dimension heightCm.`);
    }
    // itemKey yok: yerleşim stub’ları; dikey kapsama = stand tavanı (geçilemez üst sınır).
    heightCm = getStandDimensions().heightCm;
  }
  const placementZ = Number(module.placement?.zCm);
  const originCm = Number.isFinite(placementZ) ? placementZ : resolveItemDefaultZCm(module);
  return Object.freeze({ minCm: originCm, maxCm: originCm + heightCm });
}

export function getModuleMagneticSnapStrategy(moduleOrType) {
  return getModuleBehavior(moduleOrType).magneticSnap ?? 'standard';
}

export function requiresShortUpJointSnap(moduleOrType) {
  return getModuleMagneticSnapStrategy(moduleOrType) === 'short-up-joint';
}

export function isUprightJointSnapTarget(moduleOrType) {
  const module = normalizeDescriptor(moduleOrType);
  if (module.type === 'profile' || module.type === 'counter') return true;
  return isWallShortFamilyDescriptor(module);
}

export function usesLogicalFixtureEndpoint(moduleOrType) {
  return getModuleBehavior(moduleOrType).connectionEndpoint === 'logical-fixture';
}

export function usesWallBackboneCollisionDepth(moduleOrType) {
  return getModuleBehavior(moduleOrType).collisionDepth === 'wall-backbone';
}

export function allowsThinWallEndpointContact(moduleOrType) {
  return getModuleBehavior(moduleOrType).endpointContact === 'thin-wall-endpoint';
}

export function usesWallInnerFaceBoundary(moduleOrType) {
  return getModuleBehavior(moduleOrType).boundarySnap === 'wall-inner-face';
}

export function resolveSideInsertRotationDeg(moduleOrType, inheritedRotationDeg = 0) {
  const mode = resolveRotationItem(moduleOrType).sideInsertRotation;
  if (mode == null) {
    throw new TypeError('Item sideInsertRotation is missing.');
  }
  return mode === 'default'
    ? getModuleDefaultRotationDeg(moduleOrType)
    : Number(inheritedRotationDeg) || 0;
}

export function canModulesOverlapByBehavior(moduleA, moduleB) {
  const typeA = normalizeDescriptor(moduleA).type ?? null;
  const typeB = normalizeDescriptor(moduleB).type ?? null;
  if (!typeA || !typeB) return false;
  const allowedA = getModuleBehavior(moduleA).overlapWithTypes ?? NO_OVERLAP_TYPES;
  const allowedB = getModuleBehavior(moduleB).overlapWithTypes ?? NO_OVERLAP_TYPES;
  return allowedA.includes(typeB) || allowedB.includes(typeA);
}

export function supportsWallOverlayMount(moduleOrType) {
  return getModuleBehavior(moduleOrType).supportsWallOverlayMount === true;
}

export function countsTowardWallCapacity(moduleOrType) {
  return getModuleBehavior(moduleOrType).wallCapacity !== 'exclude';
}

export function getModuleGhostBehavior(moduleOrType) {
  return getModuleBehavior(moduleOrType).ghost ?? DEFAULT_GHOST_BEHAVIOR;
}

function snapRequiresOf(moduleOrType) {
  if (moduleOrType && typeof moduleOrType === 'object') {
    return getItemSnapSpec(moduleOrType)?.requires ?? null;
  }
  if (typeof moduleOrType !== 'string') return null;
  const byKey = getItem(moduleOrType);
  if (byKey) return getItemSnapSpec(byKey)?.requires ?? null;
  for (const item of listRegisteredItems()) {
    if (item.type === moduleOrType) return getItemSnapSpec(item)?.requires ?? null;
  }
  return null;
}

function resolveSnapSpec(moduleOrType) {
  if (moduleOrType && typeof moduleOrType === 'object') return getItemSnapSpec(moduleOrType);
  if (typeof moduleOrType !== 'string') return null;
  const byKey = getItem(moduleOrType);
  if (byKey) return getItemSnapSpec(byKey);
  for (const item of listRegisteredItems()) {
    if (item.type === moduleOrType) return getItemSnapSpec(item);
  }
  return null;
}

export function isFreePlacementModule(moduleOrType) {
  return getModuleBehavior(moduleOrType).placement === 'free';
}

export function isTopPlacementModule(moduleOrType) {
  if (snapRequiresOf(moduleOrType) === 'top-rail') return true;
  return getModuleBehavior(moduleOrType).placement === 'top';
}

export function isWallOverlayModule(moduleOrType) {
  return getModuleBehavior(moduleOrType).placement === 'wall-overlay';
}

/**
 * Raf / shelf-rail: face=front|back + edge=top → panel band seam.
 * mount_mode yok; kural face+edge (veya requires key) yeterli.
 */
export function usesPanelSeamOverlaySnap(moduleOrType) {
  const spec = resolveSnapSpec(moduleOrType);
  if (!spec) return false;
  if (spec.requires === 'shelf-rail') return true;
  return (spec.face === 'front' || spec.face === 'back') && spec.edge === 'top';
}
