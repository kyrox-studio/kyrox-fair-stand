/**
 * Kesit 1+2+3 tip davranışı — Python item_type_behavior_seed parity.
 */
export const DEFAULT_ITEM_TYPE_BEHAVIOR_SLICE1 = Object.freeze({
  placement: 'wall',
  collision: 'segment',
  moveSnapCm: 10,
});

export const DEFAULT_ITEM_TYPE_BEHAVIOR_SLICE2 = Object.freeze({
  magneticSnap: 'standard',
  allowSideInsert: true,
  supportsWallOverlayMount: true,
  wallCapacity: 'include',
});

export const DEFAULT_ITEM_TYPE_BEHAVIOR_SLICE3 = Object.freeze({
  connectionEndpoint: 'segment',
  collisionDepth: 'physical',
  endpointContact: 'standard',
  boundarySnap: 'stand-edge',
  collisionHeight: 'full',
  overlapWithTypes: Object.freeze([]),
  ghost: Object.freeze({
    kind: 'silhouette',
    renderer: 'module-silhouette',
    opacity: 0.38,
  }),
});

function s3(overrides = {}) {
  const ghost = overrides.ghost
    ? Object.freeze({ ...DEFAULT_ITEM_TYPE_BEHAVIOR_SLICE3.ghost, ...overrides.ghost })
    : DEFAULT_ITEM_TYPE_BEHAVIOR_SLICE3.ghost;
  const overlap = overrides.overlapWithTypes
    ? Object.freeze([...overrides.overlapWithTypes])
    : DEFAULT_ITEM_TYPE_BEHAVIOR_SLICE3.overlapWithTypes;
  return Object.freeze({
    ...DEFAULT_ITEM_TYPE_BEHAVIOR_SLICE3,
    ...overrides,
    overlapWithTypes: overlap,
    ghost,
  });
}

/** key → { placement, collision, moveSnapCm } */
export const ITEM_TYPE_BEHAVIOR_SLICE1 = Object.freeze({
  'flat-panel': Object.freeze({ placement: 'wall', collision: 'segment', moveSnapCm: 10 }),
  'showcase-3': Object.freeze({ placement: 'wall', collision: 'segment', moveSnapCm: 10 }),
  'showcase-2': Object.freeze({ placement: 'wall', collision: 'segment', moveSnapCm: 10 }),
  shelf: Object.freeze({ placement: 'wall-overlay', collision: 'none', moveSnapCm: 10 }),
  door: Object.freeze({ placement: 'wall', collision: 'segment', moveSnapCm: 10 }),
  'base-wall': Object.freeze({ placement: 'wall', collision: 'segment', moveSnapCm: 10 }),
  separator: Object.freeze({ placement: 'wall', collision: 'segment', moveSnapCm: 10 }),
  counter: Object.freeze({ placement: 'free', collision: 'footprint', moveSnapCm: 10 }),
  base: Object.freeze({ placement: 'free', collision: 'footprint', moveSnapCm: 10 }),
  'sofa-set-classic': Object.freeze({ placement: 'free', collision: 'footprint', moveSnapCm: 10 }),
  'sofa-single-classic': Object.freeze({ placement: 'free', collision: 'none', moveSnapCm: 10 }),
  'sofa-double-classic': Object.freeze({ placement: 'free', collision: 'none', moveSnapCm: 10 }),
  'coffee-table-classic': Object.freeze({ placement: 'free', collision: 'none', moveSnapCm: 10 }),
  'table-chair-set-eames': Object.freeze({ placement: 'free', collision: 'none', moveSnapCm: 10 }),
  chair: Object.freeze({ placement: 'free', collision: 'none', moveSnapCm: 10 }),
  'table-glass': Object.freeze({ placement: 'free', collision: 'none', moveSnapCm: 10 }),
  'bar-stool': Object.freeze({ placement: 'free', collision: 'none', moveSnapCm: 10 }),
  'mini-fridge': Object.freeze({ placement: 'free', collision: 'none', moveSnapCm: 10 }),
  kettle: Object.freeze({ placement: 'free', collision: 'none', moveSnapCm: 10 }),
  'coat-rack': Object.freeze({ placement: 'free', collision: 'none', moveSnapCm: 10 }),
  'floor-showcase': Object.freeze({ placement: 'free', collision: 'footprint', moveSnapCm: 10 }),
  'brochure-stand': Object.freeze({ placement: 'free', collision: 'footprint', moveSnapCm: 10 }),
  'plastic-trash-bin': Object.freeze({ placement: 'free', collision: 'none', moveSnapCm: 10 }),
  'box-block': Object.freeze({ placement: 'free', collision: 'none', moveSnapCm: 10 }),
  'tulle-fabric': Object.freeze({ placement: 'free', collision: 'none', moveSnapCm: 10 }),
  upright: Object.freeze({ placement: 'free', collision: 'footprint', moveSnapCm: 10 }),
  profile: Object.freeze({ placement: 'wall', collision: 'segment', moveSnapCm: 10 }),
  'indoor-plant-1': Object.freeze({ placement: 'free', collision: 'footprint', moveSnapCm: 10 }),
  'illuminated-foam': Object.freeze({ placement: 'wall-overlay', collision: 'none', moveSnapCm: 10 }),
  tv: Object.freeze({ placement: 'wall-overlay', collision: 'none', moveSnapCm: 10 }),
  'led-floodlight': Object.freeze({ placement: 'top', collision: 'none', moveSnapCm: 10 }),
});

/** key → { magneticSnap, allowSideInsert, supportsWallOverlayMount, wallCapacity } */
export const ITEM_TYPE_BEHAVIOR_SLICE2 = Object.freeze({
  'flat-panel': Object.freeze({ magneticSnap: 'standard', allowSideInsert: true, supportsWallOverlayMount: true, wallCapacity: 'include' }),
  'showcase-3': Object.freeze({ magneticSnap: 'standard', allowSideInsert: true, supportsWallOverlayMount: true, wallCapacity: 'include' }),
  'showcase-2': Object.freeze({ magneticSnap: 'standard', allowSideInsert: true, supportsWallOverlayMount: true, wallCapacity: 'include' }),
  shelf: Object.freeze({ magneticSnap: 'none', allowSideInsert: false, supportsWallOverlayMount: false, wallCapacity: 'exclude' }),
  door: Object.freeze({ magneticSnap: 'standard', allowSideInsert: true, supportsWallOverlayMount: true, wallCapacity: 'include' }),
  'base-wall': Object.freeze({ magneticSnap: 'standard', allowSideInsert: true, supportsWallOverlayMount: true, wallCapacity: 'include' }),
  separator: Object.freeze({ magneticSnap: 'standard', allowSideInsert: true, supportsWallOverlayMount: true, wallCapacity: 'include' }),
  counter: Object.freeze({ magneticSnap: 'standard', allowSideInsert: true, supportsWallOverlayMount: false, wallCapacity: 'include' }),
  base: Object.freeze({ magneticSnap: 'standard', allowSideInsert: true, supportsWallOverlayMount: false, wallCapacity: 'include' }),
  'sofa-set-classic': Object.freeze({ magneticSnap: 'standard', allowSideInsert: true, supportsWallOverlayMount: false, wallCapacity: 'include' }),
  'sofa-single-classic': Object.freeze({ magneticSnap: 'none', allowSideInsert: true, supportsWallOverlayMount: false, wallCapacity: 'include' }),
  'sofa-double-classic': Object.freeze({ magneticSnap: 'none', allowSideInsert: true, supportsWallOverlayMount: false, wallCapacity: 'include' }),
  'coffee-table-classic': Object.freeze({ magneticSnap: 'none', allowSideInsert: true, supportsWallOverlayMount: false, wallCapacity: 'include' }),
  'table-chair-set-eames': Object.freeze({ magneticSnap: 'none', allowSideInsert: true, supportsWallOverlayMount: false, wallCapacity: 'include' }),
  chair: Object.freeze({ magneticSnap: 'none', allowSideInsert: true, supportsWallOverlayMount: false, wallCapacity: 'include' }),
  'table-glass': Object.freeze({ magneticSnap: 'none', allowSideInsert: true, supportsWallOverlayMount: false, wallCapacity: 'include' }),
  'bar-stool': Object.freeze({ magneticSnap: 'none', allowSideInsert: true, supportsWallOverlayMount: false, wallCapacity: 'include' }),
  'mini-fridge': Object.freeze({ magneticSnap: 'none', allowSideInsert: true, supportsWallOverlayMount: false, wallCapacity: 'include' }),
  kettle: Object.freeze({ magneticSnap: 'none', allowSideInsert: true, supportsWallOverlayMount: false, wallCapacity: 'include' }),
  'coat-rack': Object.freeze({ magneticSnap: 'none', allowSideInsert: true, supportsWallOverlayMount: false, wallCapacity: 'include' }),
  'floor-showcase': Object.freeze({ magneticSnap: 'none', allowSideInsert: true, supportsWallOverlayMount: false, wallCapacity: 'include' }),
  'brochure-stand': Object.freeze({ magneticSnap: 'none', allowSideInsert: true, supportsWallOverlayMount: false, wallCapacity: 'include' }),
  'plastic-trash-bin': Object.freeze({ magneticSnap: 'none', allowSideInsert: true, supportsWallOverlayMount: false, wallCapacity: 'include' }),
  'box-block': Object.freeze({ magneticSnap: 'none', allowSideInsert: true, supportsWallOverlayMount: false, wallCapacity: 'include' }),
  'tulle-fabric': Object.freeze({ magneticSnap: 'none', allowSideInsert: true, supportsWallOverlayMount: false, wallCapacity: 'include' }),
  upright: Object.freeze({ magneticSnap: 'short-up-joint', allowSideInsert: false, supportsWallOverlayMount: false, wallCapacity: 'exclude' }),
  profile: Object.freeze({ magneticSnap: 'standard', allowSideInsert: true, supportsWallOverlayMount: true, wallCapacity: 'include' }),
  'indoor-plant-1': Object.freeze({ magneticSnap: 'standard', allowSideInsert: true, supportsWallOverlayMount: false, wallCapacity: 'include' }),
  'illuminated-foam': Object.freeze({ magneticSnap: 'none', allowSideInsert: false, supportsWallOverlayMount: false, wallCapacity: 'include' }),
  tv: Object.freeze({ magneticSnap: 'none', allowSideInsert: false, supportsWallOverlayMount: false, wallCapacity: 'include' }),
  'led-floodlight': Object.freeze({ magneticSnap: 'none', allowSideInsert: true, supportsWallOverlayMount: false, wallCapacity: 'exclude' }),
});

/** key → kesit 3 alanları */
export const ITEM_TYPE_BEHAVIOR_SLICE3 = Object.freeze({
  'flat-panel': s3(),
  'showcase-3': s3(),
  'showcase-2': s3(),
  shelf: s3(),
  door: s3(),
  'base-wall': s3({ collisionDepth: 'wall-backbone' }),
  separator: s3(),
  counter: s3({ connectionEndpoint: 'logical-fixture' }),
  base: s3({ connectionEndpoint: 'logical-fixture' }),
  'sofa-set-classic': s3({ boundarySnap: 'wall-inner-face' }),
  'sofa-single-classic': s3(),
  'sofa-double-classic': s3(),
  'coffee-table-classic': s3(),
  'table-chair-set-eames': s3(),
  chair: s3(),
  'table-glass': s3(),
  'bar-stool': s3(),
  'mini-fridge': s3({ overlapWithTypes: ['kettle'] }),
  kettle: s3({ overlapWithTypes: ['mini-fridge'] }),
  'coat-rack': s3(),
  'floor-showcase': s3(),
  'brochure-stand': s3(),
  'plastic-trash-bin': s3(),
  'box-block': s3(),
  'tulle-fabric': s3(),
  upright: s3({ overlapWithTypes: ['flat-panel', 'profile', 'counter'] }),
  profile: s3({ overlapWithTypes: ['separator'] }),
  'indoor-plant-1': s3({ endpointContact: 'thin-wall-endpoint' }),
  'illuminated-foam': s3(),
  tv: s3(),
  'led-floodlight': s3(),
});

export function behaviorSlice1ForType(itemType) {
  return ITEM_TYPE_BEHAVIOR_SLICE1[itemType] ?? DEFAULT_ITEM_TYPE_BEHAVIOR_SLICE1;
}

export function behaviorSlice2ForType(itemType) {
  return ITEM_TYPE_BEHAVIOR_SLICE2[itemType] ?? DEFAULT_ITEM_TYPE_BEHAVIOR_SLICE2;
}

export function behaviorSlice3ForType(itemType) {
  return ITEM_TYPE_BEHAVIOR_SLICE3[itemType] ?? DEFAULT_ITEM_TYPE_BEHAVIOR_SLICE3;
}

function sameOverlap(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  const left = [...a].map(String).sort();
  const right = [...b].map(String).sort();
  return left.every((value, index) => value === right[index]);
}

export function assertSlice3Equal(actual, expected, key) {
  if (
    actual.connectionEndpoint !== expected.connectionEndpoint
    || actual.collisionDepth !== expected.collisionDepth
    || actual.endpointContact !== expected.endpointContact
    || actual.boundarySnap !== expected.boundarySnap
    || actual.collisionHeight !== expected.collisionHeight
    || !sameOverlap(actual.overlapWithTypes, expected.overlapWithTypes)
    || actual.ghost?.kind !== expected.ghost.kind
    || actual.ghost?.renderer !== expected.ghost.renderer
    || Number(actual.ghost?.opacity) !== Number(expected.ghost.opacity)
  ) {
    const err = new Error(`slice3 mismatch for ${key}`);
    err.actual = actual;
    err.expected = expected;
    throw err;
  }
}

const NON_SCENE_ITEM_TYPE_KEYS = new Set(['production']);

/** Bootstrap `itemTypes[]` satırları — seed item type’larından. */
export function buildItemTypeBootstrapRows(itemTypeKeys) {
  const keys = [...new Set([
    ...itemTypeKeys.filter(Boolean),
    ...Object.keys(ITEM_TYPE_BEHAVIOR_SLICE1),
    ...Object.keys(ITEM_TYPE_BEHAVIOR_SLICE2),
    ...Object.keys(ITEM_TYPE_BEHAVIOR_SLICE3),
  ])].sort();
  return keys.map((key, index) => {
    if (NON_SCENE_ITEM_TYPE_KEYS.has(key)) {
      return {
        id: index + 1,
        key,
        displayName: 'Üretim',
        isActive: true,
      };
    }
    const s1 = behaviorSlice1ForType(key);
    const s2 = behaviorSlice2ForType(key);
    const s3row = behaviorSlice3ForType(key);
    return {
      id: index + 1,
      key,
      displayName: key,
      placement: s1.placement,
      collision: s1.collision,
      moveSnapCm: s1.moveSnapCm,
      magneticSnap: s2.magneticSnap,
      allowSideInsert: s2.allowSideInsert,
      supportsWallOverlayMount: s2.supportsWallOverlayMount,
      wallCapacity: s2.wallCapacity,
      connectionEndpoint: s3row.connectionEndpoint,
      collisionDepth: s3row.collisionDepth,
      endpointContact: s3row.endpointContact,
      boundarySnap: s3row.boundarySnap,
      collisionHeight: s3row.collisionHeight,
      overlapWithTypes: [...s3row.overlapWithTypes],
      ghost: {
        kind: s3row.ghost.kind,
        renderer: s3row.ghost.renderer,
        opacity: s3row.ghost.opacity,
      },
      isActive: true,
    };
  });
}
