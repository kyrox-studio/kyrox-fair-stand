import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCatalogItem,
} from '../src/catalog.js';
import {
  createIndoorPlantModuleState,
  createModuleStateFromDescriptor,
  duplicateModuleState,
  normalizeModuleItemState,
} from '../src/designState.js';
import { getItem, resolveItemKey } from '../src/items.js';
import { getModuleBehavior } from '../src/moduleBehavior.js';
import { resolveModuleContract } from '../src/moduleContracts.js';

const PLANT_KEYS = [
  'extra_indoor_plant_1',
  'extra_long_planter_100',
  'extra_long_planter_150',
  'extra_long_planter_200',
];

const EXPECTED = {
  extra_indoor_plant_1: {
    widthCm: 60,
    depthCm: 60,
    heightCm: 120,
    modelFile: 'indoor_plants.glb',
    runtimeModelFile: 'indoor_plants.glb',
    modelRotationYDeg: 0,
    preserveModelScale: false,
    hasSurface: false,
    profile: 'free-model-fixed',
  },
  extra_long_planter_100: {
    widthCm: 100,
    depthCm: 30,
    heightCm: 30,
    modelFile: 'saksi_bitkili_100x30x30.glb',
    runtimeModelFile: 'saksi_bitkili_100x30x30.glb',
    modelRotationYDeg: 90,
    preserveModelScale: true,
    hasSurface: true,
    profile: 'free-model-color',
  },
  extra_long_planter_150: {
    widthCm: 150,
    depthCm: 30,
    heightCm: 30,
    modelFile: 'saksi_bitkili_150x30x30.glb',
    runtimeModelFile: 'saksi_bitkili_150x30x30.glb',
    modelRotationYDeg: 90,
    preserveModelScale: true,
    hasSurface: true,
    profile: 'free-model-color',
  },
  extra_long_planter_200: {
    widthCm: 200,
    depthCm: 30,
    heightCm: 30,
    modelFile: 'saksi_bitkili_200x30x30.glb',
    runtimeModelFile: 'saksi_bitkili_200x30x30.glb',
    modelRotationYDeg: 90,
    preserveModelScale: true,
    hasSurface: true,
    profile: 'free-model-color',
  },
};

for (const itemKey of PLANT_KEYS) {
  test(`${itemKey}: canonical indoor-plant identity and state parity`, () => {
    const item = getItem(itemKey);
    const expected = EXPECTED[itemKey];
    const catalog = getCatalogItem(itemKey);

    assert.equal(item.itemKey, itemKey);
    assert.equal(item.type, 'indoor-plant-1');
    assert.equal(Object.hasOwn(item, 'unit'), false);
    assert.equal(Object.hasOwn(item, 'composition'), false);
    assert.deepEqual(item.dimensions, {
      widthCm: expected.widthCm,
      depthCm: expected.depthCm,
      heightCm: expected.heightCm,
    });
    assert.equal(item.modelFile ?? null, expected.modelFile);
    assert.equal(item.modelRotationYDeg, expected.modelRotationYDeg);
    assert.equal(item.preserveModelScale, expected.preserveModelScale);

    // 0086: Uzun Saksı tek kart (100); 150 ve 200 Özellikler panelinde seçilir.
    if (item.catalogVisible) {
      assert.equal(catalog.itemKey, itemKey);
      assert.equal(catalog.label, item.variant === 'long-planter' ? 'Uzun Saksı' : item.name);
      assert.equal(catalog.previewId, item.previewId);
      assert.equal(Object.hasOwn(catalog, 'type'), false);
      assert.equal(Object.hasOwn(catalog, 'widthCm'), false);
      assert.equal(Object.hasOwn(catalog, 'modelFile'), false);
    } else {
      assert.equal(catalog, null);
    }

    const state = createModuleStateFromDescriptor(catalog ?? { itemKey });
    assert.equal(state.itemKey, itemKey);
    assert.equal(state.itemKey, itemKey);
    assert.equal(state.type, 'indoor-plant-1');
    assert.equal(state.modelFile, expected.runtimeModelFile);
    assert.equal(Boolean(state.surface), expected.hasSurface);
    if (expected.hasSurface) assert.equal(state.surface.color, '#ffffff');

    const behavior = getModuleBehavior(state);
    assert.equal(behavior.placement, 'free');
    assert.equal(behavior.moveSnapCm, 10);
    assert.equal(behavior.collision, 'footprint');

    const contract = resolveModuleContract(itemKey);
    assert.equal(contract.profile, expected.profile);
    assert.equal(contract.bom.mode, 'decision-required');

    assert.equal(resolveItemKey(state), itemKey);
    const missingKey = JSON.parse(JSON.stringify(state));
    delete missingKey.itemKey;
    assert.equal(resolveItemKey({
      type: missingKey.type,
      widthCm: missingKey.widthCm,
      depthCm: missingKey.depthCm,
      modelFile: missingKey.modelFile,
    }), null);
    assert.equal(normalizeModuleItemState(missingKey).itemKey, undefined);

    const duplicate = duplicateModuleState(state);
    assert.notEqual(duplicate.id, state.id);
    assert.equal(duplicate.itemKey, itemKey);
  });
}

test('boş factory extra_indoor_plant_1 default üretir', () => {
  const state = createIndoorPlantModuleState();
  assert.equal(state.itemKey, 'extra_indoor_plant_1');
  assert.equal(state.modelFile, 'indoor_plants.glb');
  assert.equal(state.surface, undefined);
});
