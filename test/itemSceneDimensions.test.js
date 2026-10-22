import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listCatalogItems,
  getCatalogItem,
} from '../src/catalog.js';
import {
  createProfileModuleState,
  createUprightModuleState,
  normalizeModuleItemState,
} from '../src/designState.js';
import {
  clampHeightToStandCeilingCm,
  getProceduralFrameCrossSectionM,
  getItem,
  listRegisteredItems,
  requireModuleSceneBoxCm,
  resolveItemKey,
  resolveModuleSceneBoxCm,
  resolveSceneDimensions,
  SCENE_DIMENSION_FIELDS,
} from '../src/items.js';
import { getStandDimensions } from '../src/standDimensions.js';

const ITEMS_SOURCE = readFileSync(new URL('../src/items.js', import.meta.url), 'utf8');
const CATALOG_SOURCE = readFileSync(new URL('../src/catalog.js', import.meta.url), 'utf8');
const DESIGN_STATE_SOURCE = readFileSync(new URL('../src/designState.js', import.meta.url), 'utf8');
const RESOLVER_SOURCE = ITEMS_SOURCE.slice(
  ITEMS_SOURCE.indexOf('export function resolveSceneDimensions'),
  ITEMS_SOURCE.indexOf('export function requireSceneDimension'),
);

function syntheticItem(dimensions, sceneDimensions) {
  return { itemKey: 'synthetic', dimensions, sceneDimensions };
}

test('1. scene width override physical width’i ezer', () => {
  const scene = resolveSceneDimensions(syntheticItem(
    { widthCm: 190 },
    { widthCm: 250 },
  ));
  assert.equal(scene.widthCm, 250);
});

test('2. scene width null ise physical width kullanılır', () => {
  const scene = resolveSceneDimensions(syntheticItem(
    { widthCm: 190 },
    { widthCm: null },
  ));
  assert.equal(scene.widthCm, 190);
});

test('3. sceneDimensions yoksa physical width kullanılır', () => {
  const scene = resolveSceneDimensions(syntheticItem({ widthCm: 190 }, undefined));
  assert.equal(scene.widthCm, 190);
});

test('4. resolveSceneDimensions yalnız width/depth/height taşır', () => {
  assert.deepEqual(SCENE_DIMENSION_FIELDS, ['widthCm', 'depthCm', 'heightCm']);
  const scene = resolveSceneDimensions(syntheticItem({ widthCm: 190, depthCm: 8, heightCm: 8 }, undefined));
  assert.equal(scene.widthCm, 190);
  assert.equal(scene.depthCm, 8);
  assert.equal(scene.heightCm, 8);
  assert.equal(Object.hasOwn(scene, 'lengthCm'), false);
});

test('8. profile_190 dimensions ve scene width/depth/height', () => {
  const item = getItem('profile_190');
  assert.equal(item.dimensions.widthCm, 190);
  assert.equal(item.dimensions.depthCm, 8);
  assert.equal(item.dimensions.heightCm, 8);
  assert.deepEqual(item.sceneDimensions, { widthCm: 200, depthCm: 8, heightCm: 8 });
  assert.deepEqual(resolveSceneDimensions(item), Object.freeze({
    widthCm: 200,
    depthCm: 8,
    heightCm: 8,
  }));
});

test('9. profile factory Recipe’den scene width okumaz', () => {
  assert.doesNotMatch(DESIGN_STATE_SOURCE, /getStraightWallNominalWidthForProfileItem/);
  assert.doesNotMatch(DESIGN_STATE_SOURCE, /from ['"]\.\/moduleRecipes\.js['"]/);
  const profile = createProfileModuleState({ itemKey: 'profile_190' });
  assert.equal(profile.widthCm, 200);
  assert.equal(profile.depthCm, 8);
  assert.equal(profile.heightCm, 8);
});

test('10. Catalog profile width catalogWidthCm okumaz', () => {
  assert.doesNotMatch(CATALOG_SOURCE, /catalogWidthCm/);
  const scene = resolveSceneDimensions(getItem('profile_190'));
  // Kart tek: profile_289 (sahnede 300); profile_190 boy penceresinden gelir, kart değildir.
  assert.equal(getCatalogItem('profile_190'), null);
  assert.equal(getCatalogItem('profile_289').itemKey, 'profile_289');
  assert.equal(resolveSceneDimensions(getItem('profile_289')).widthCm, 300);
  assert.equal(scene.widthCm, 200);
});

test('11. catalogWidthCm canonical Item field olarak kalmaz', () => {
  for (const item of listRegisteredItems()) {
    assert.equal(Object.hasOwn(item, 'catalogWidthCm'), false, item.itemKey);
  }
});

test('17. same-field merge; cross-remap yok', () => {
  for (const field of SCENE_DIMENSION_FIELDS) {
    assert.equal(
      resolveSceneDimensions(syntheticItem({ [field]: 11 }, { [field]: 22 }))[field],
      22,
      field,
    );
  }
});

test('18. 106 Item registry korunuyor', () => {
  assert.equal(listRegisteredItems().length, 132);
});

test('upright_346_5 sceneDimensions placement 8×8×346.5', () => {
  const item = getItem('upright_346_5');
  assert.equal(item.dimensions.widthCm, 8);
  assert.equal(item.dimensions.heightCm, 346.5);
  assert.deepEqual(item.sceneDimensions, { widthCm: 8, depthCm: 8, heightCm: 346.5 });
  const state = createUprightModuleState();
  assert.equal(state.widthCm, 8);
  assert.equal(state.depthCm, 8);
  assert.equal(state.heightCm, 346.5);
});

test('MISSING_PHYSICAL_DIMENSIONS: connector/shelf_leg/hali tahmin edilmez', () => {
  for (const itemKey of [
    'connector_start',
    'connector_single',
    'connector_double',
    'connector_corner',
    'shelf_leg',
    'hali',
  ]) {
    const item = getItem(itemKey);
    assert.equal(item.dimensions, undefined, itemKey);
    const scene = resolveSceneDimensions(item);
    for (const field of SCENE_DIMENSION_FIELDS) {
      assert.equal(scene[field], null, `${itemKey}.${field}`);
    }
  }
});

test('clampHeightToStandCeilingCm tavanı geçmez', () => {
  const ceiling = getStandDimensions().heightCm;
  assert.equal(clampHeightToStandCeilingCm(ceiling - 1), ceiling - 1);
  assert.equal(clampHeightToStandCeilingCm(ceiling), ceiling);
  assert.equal(clampHeightToStandCeilingCm(ceiling + 78), ceiling);
});

test('resolveModuleSceneBoxCm state → scene → tavan', () => {
  const item = getItem('wall_separator_100_350');
  const scene = resolveSceneDimensions(item);
  const fromCatalog = resolveModuleSceneBoxCm({ itemKey: 'wall_separator_100_350' });
  assert.equal(fromCatalog.widthCm, scene.widthCm);
  assert.equal(fromCatalog.heightCm, scene.heightCm);
  assert.equal(fromCatalog.depthCm, scene.depthCm);

  const box = requireModuleSceneBoxCm({
    itemKey: 'wall_separator_100_350',
    heightCm: scene.heightCm + 100,
  });
  assert.equal(box.heightCm, getStandDimensions().heightCm);
});

test('procedural frame cross-section reçetedeki profil Item sahne kesitini okur', () => {
  const parent = getItem('wall_separator_100_350');
  const profile = getItem('profile_91');
  const profileScene = resolveSceneDimensions(profile);
  const cross = getProceduralFrameCrossSectionM({ itemKey: parent.itemKey, type: parent.type });
  // Profilde widthCm duvar açıklığıdır; kesit depth × height.
  assert.equal(cross.frameWidthCm, profileScene.depthCm);
  assert.equal(cross.frameDepthCm, profileScene.heightCm);
});

test('procedural frame cross-section reçetede profil yoksa stand derinliğiyle kare', () => {
  const cross = getProceduralFrameCrossSectionM({ itemKey: 'missing_item_key' });
  assert.equal(cross.frameDepthCm, getStandDimensions().frameDepthCm);
  assert.equal(cross.frameWidthCm, cross.frameDepthCm);
});
