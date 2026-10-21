/**
 * GOVERNANCE / spec katmanı. Runtime BOM `src/itemBom.js`, davranış
 * `src/moduleBehavior.js`. Production planner/renderer bu dosyayı import etmez.
 * `test/systemDevelopmentContract.test.js` katalog item’larının türeyen
 * contract’ını zorlar — per-SKU JS allowlist yok; tip + Item alanlarından türetilir.
 */
import { getItem, resolveItemKey } from './items.js';

import { getModuleBehavior } from './moduleBehavior.js';

const RECIPE_BOM_POLICY = Object.freeze({
  mode: 'recipe',
  source: 'src/moduleRecipes.js',
});

const SELF_BOM_POLICY = Object.freeze({
  mode: 'self',
  source: 'src/itemBom.js',
});

const UNRESOLVED_EXISTING_BOM_POLICY = Object.freeze({
  mode: 'decision-required',
  source: null,
  reason: 'Existing module has no canonical BOM policy yet; decide recipe, commercial-item, or explicit exclusion before Final BOM integration.',
});

const STANDARD_TEST_POLICY = Object.freeze({
  contract: 'required',
  regression: 'required-on-behavior-change',
  fullSuite: 'required',
  build: 'required',
});

export const MODULE_CONTRACT_PROFILES = Object.freeze({
  'wall-editable': Object.freeze({
    state: Object.freeze({ owner: 'src/designState.js', persistence: 'project-state' }),
    appearance: Object.freeze({ color: 'editable', image: 'editable' }),
    renderer: Object.freeze({ mode: 'procedural-or-specialized' }),
    runtime: Object.freeze({ mode: 'static' }),
    composition: Object.freeze({ mode: 'standalone' }),
    tests: STANDARD_TEST_POLICY,
  }),
  'wall-color-only': Object.freeze({
    state: Object.freeze({ owner: 'src/designState.js', persistence: 'project-state' }),
    appearance: Object.freeze({ color: 'editable', image: 'none' }),
    renderer: Object.freeze({ mode: 'procedural-or-model' }),
    runtime: Object.freeze({ mode: 'static' }),
    composition: Object.freeze({ mode: 'standalone' }),
    tests: STANDARD_TEST_POLICY,
  }),
  'free-editable': Object.freeze({
    state: Object.freeze({ owner: 'src/designState.js', persistence: 'project-state' }),
    appearance: Object.freeze({ color: 'editable', image: 'editable' }),
    renderer: Object.freeze({ mode: 'procedural' }),
    runtime: Object.freeze({ mode: 'static' }),
    composition: Object.freeze({ mode: 'standalone' }),
    tests: STANDARD_TEST_POLICY,
  }),
  'free-model-color': Object.freeze({
    state: Object.freeze({ owner: 'src/designState.js', persistence: 'project-state' }),
    appearance: Object.freeze({ color: 'editable', image: 'none' }),
    renderer: Object.freeze({ mode: 'model' }),
    runtime: Object.freeze({ mode: 'static' }),
    composition: Object.freeze({ mode: 'standalone' }),
    tests: STANDARD_TEST_POLICY,
  }),
  'free-model-fixed': Object.freeze({
    state: Object.freeze({ owner: 'src/designState.js', persistence: 'project-state' }),
    appearance: Object.freeze({ color: 'fixed', image: 'none' }),
    renderer: Object.freeze({ mode: 'model' }),
    runtime: Object.freeze({ mode: 'static' }),
    composition: Object.freeze({ mode: 'standalone' }),
    tests: STANDARD_TEST_POLICY,
  }),
  'wall-media': Object.freeze({
    state: Object.freeze({ owner: 'src/designState.js', persistence: 'project-state' }),
    appearance: Object.freeze({ color: 'fixed', image: 'renderer-managed' }),
    renderer: Object.freeze({ mode: 'specialized-media' }),
    runtime: Object.freeze({ mode: 'static' }),
    composition: Object.freeze({ mode: 'standalone' }),
    tests: STANDARD_TEST_POLICY,
  }),
  'top-light': Object.freeze({
    state: Object.freeze({ owner: 'src/designState.js', persistence: 'project-state' }),
    appearance: Object.freeze({ color: 'state-backed', image: 'none' }),
    renderer: Object.freeze({ mode: 'procedural' }),
    runtime: Object.freeze({ mode: 'static' }),
    composition: Object.freeze({ mode: 'standalone' }),
    tests: STANDARD_TEST_POLICY,
  }),
  'wall-overlay-image': Object.freeze({
    state: Object.freeze({ owner: 'src/designState.js', persistence: 'project-state' }),
    appearance: Object.freeze({ color: 'halo-only', image: 'required' }),
    renderer: Object.freeze({ mode: 'specialized-overlay' }),
    runtime: Object.freeze({ mode: 'static' }),
    composition: Object.freeze({ mode: 'standalone' }),
    tests: STANDARD_TEST_POLICY,
  }),
});

/** Tip → governance profili (SKU satırı yok). Yeni aynı tipte SKU JS istemez. */
const TYPE_CONTRACT_PROFILE = Object.freeze({
  'flat-panel': 'wall-editable',
  door: 'wall-editable',
  'showcase-2': 'wall-editable',
  'showcase-3': 'wall-editable',
  separator: 'wall-color-only',
  shelf: 'wall-color-only',
  upright: 'free-editable',
  profile: 'free-editable',
  counter: 'free-editable',
  base: 'free-editable',
  'sofa-set-classic': 'free-model-color',
  'sofa-single-classic': 'free-model-color',
  'sofa-double-classic': 'free-model-color',
  'table-chair-set-eames': 'free-model-color',
  chair: 'free-model-color',
  'bar-stool': 'free-model-color',
  'coffee-table-classic': 'free-model-fixed',
  'table-glass': 'free-model-fixed',
  'mini-fridge': 'free-model-fixed',
  kettle: 'free-model-fixed',
  'coat-rack': 'free-model-fixed',
  'floor-showcase': 'free-model-fixed',
  'brochure-stand': 'free-model-fixed',
  'plastic-trash-bin': 'free-model-fixed',
  'box-block': 'free-editable',
  'tulle-fabric': 'free-editable',
  'indoor-plant-1': 'free-model-fixed',
  tv: 'wall-media',
  'led-floodlight': 'top-light',
  'illuminated-foam': 'wall-overlay-image',
});

/** Tip → self BOM (recipe değilse). Diğer leaf’ler decision-required. */
const TYPE_SELF_BOM = Object.freeze(new Set([
  'upright',
  'profile',
  'shelf',
  'mini-fridge',
  'kettle',
  'coat-rack',
  'floor-showcase',
  'brochure-stand',
  'plastic-trash-bin',
  'box-block',
]));

/**
 * @deprecated Per-SKU map kaldırıldı; boş export geriye dönük import için.
 * Yeni SKU: tip kaydı + Item yeterli.
 */
export const MODULE_CONTRACT_ASSIGNMENTS = Object.freeze({});

export const NON_CATALOG_MODULE_CONTRACTS = Object.freeze({
  'illuminated-foam': Object.freeze({
    profile: 'wall-overlay-image',
    bom: UNRESOLVED_EXISTING_BOM_POLICY,
  }),
});

function mergeProfile(profile, bom) {
  if (!profile) return null;
  return {
    state: { ...profile.state },
    appearance: { ...profile.appearance },
    renderer: { ...profile.renderer },
    runtime: { ...profile.runtime },
    composition: { ...profile.composition },
    tests: { ...profile.tests },
    bom: { ...bom },
  };
}

function resolveBomPolicy(item) {
  const composition = item?.composition;
  if (
    composition?.mode === 'recipe'
    && Array.isArray(composition.items)
    && composition.items.length > 0
  ) {
    return RECIPE_BOM_POLICY;
  }
  if (item?.type && TYPE_SELF_BOM.has(item.type)) {
    return SELF_BOM_POLICY;
  }
  return UNRESOLVED_EXISTING_BOM_POLICY;
}

function resolveProfileKey(item) {
  if (!item?.type) return null;
  if (item.type === 'indoor-plant-1' && String(item.itemKey).includes('planter')) {
    return 'free-model-color';
  }
  return TYPE_CONTRACT_PROFILE[item.type] ?? null;
}

export function hasExplicitModuleContract(moduleKey) {
  if (Object.hasOwn(NON_CATALOG_MODULE_CONTRACTS, moduleKey)) return true;
  const item = getItem(moduleKey);
  return Boolean(item && resolveProfileKey(item));
}

export function resolveModuleContract(moduleKeyOrDescriptor) {
  if (typeof moduleKeyOrDescriptor === 'string' && Object.hasOwn(NON_CATALOG_MODULE_CONTRACTS, moduleKeyOrDescriptor)) {
    const assignmentRecord = NON_CATALOG_MODULE_CONTRACTS[moduleKeyOrDescriptor];
    const profile = MODULE_CONTRACT_PROFILES[assignmentRecord.profile];
    return {
      id: moduleKeyOrDescriptor,
      itemKey: moduleKeyOrDescriptor,
      type: moduleKeyOrDescriptor,
      profile: assignmentRecord.profile,
      ...mergeProfile(profile, assignmentRecord.bom),
      behavior: getModuleBehavior(moduleKeyOrDescriptor),
    };
  }

  const itemKey = typeof moduleKeyOrDescriptor === 'string' && getItem(moduleKeyOrDescriptor)
    ? moduleKeyOrDescriptor
    : resolveItemKey(moduleKeyOrDescriptor);
  if (!itemKey) return null;

  const item = getItem(itemKey);
  if (!item) return null;

  const profileKey = resolveProfileKey(item);
  if (!profileKey) return null;

  const profile = MODULE_CONTRACT_PROFILES[profileKey];
  if (!profile) return null;

  const bom = resolveBomPolicy(item);

  return {
    id: itemKey,
    itemKey,
    type: item.type,
    profile: profileKey,
    ...mergeProfile(profile, bom),
    behavior: getModuleBehavior({
      itemKey,
      type: item.type,
      shape: item.shape,
      widthCm: item.dimensions?.widthCm,
      variant: item.variant,
    }),
  };
}
