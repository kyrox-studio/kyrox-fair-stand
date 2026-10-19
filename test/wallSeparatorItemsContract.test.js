import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCatalogItem,
} from '../src/catalog.js';
import {
  createModuleStateFromDescriptor,
  createSeparatorModuleState,
  duplicateModuleState,
  normalizeModuleItemState,
} from '../src/designState.js';
import { getItem, resolveItemKey, resolveSceneDimensions } from '../src/items.js';
import { getModuleBehavior, getModuleRotationStepDeg } from '../src/moduleBehavior.js';
import { resolveModuleContract } from '../src/moduleContracts.js';
import {
  getModuleRecipe,
} from './recipeParentItemKey.js';

const SEPARATOR_KEYS = [
  'wall_separator_50_350',
  'wall_separator_100_350',
  'wall_separator_50_350_sarmasik',
  'wall_separator_100_350_sarmasik',
];

const EXPECTED = {
  wall_separator_50_350: {
    widthCm: 50,
    modelFile: null,
    recipeQuantities: {
      profile_41_5: 2,
      upright_346_5: 2,
      separator_panel_48_5: 7,
      connector_start: 2,
      connector_single: 13, // 0071 ürün kararı
    },
  },
  wall_separator_100_350: {
    widthCm: 100,
    modelFile: null,
    recipeQuantities: {
      profile_91: 2,
      upright_346_5: 2,
      separator_panel_98: 7,
      connector_start: 2,
      connector_single: 13,
    },
  },
  wall_separator_50_350_sarmasik: {
    widthCm: 50,
    modelFile: 'wall_separator_50_sarmasik.glb',
    recipeQuantities: {
      profile_41_5: 2,
      upright_346_5: 2,
      separator_panel_48_5: 7,
      connector_start: 2,
      connector_single: 13, // 0071 ürün kararı
    },
  },
  wall_separator_100_350_sarmasik: {
    widthCm: 100,
    modelFile: 'wall_separator_100_sarmasik.glb',
    recipeQuantities: {
      profile_91: 2,
      upright_346_5: 2,
      separator_panel_98: 7,
      connector_start: 2,
      connector_single: 13,
    },
  },
};

for (const itemKey of SEPARATOR_KEYS) {
  test(`${itemKey}: canonical composite identity, state and recipe parity`, () => {
    const item = getItem(itemKey);
    const expected = EXPECTED[itemKey];
    const catalog = getCatalogItem(itemKey);

    assert.equal(item.itemKey, itemKey);
    assert.equal(item.type, 'separator');
    assert.equal(item.composition?.mode, 'recipe');
    assert.equal(item.composition?.moduleType, undefined);
    assert.equal(item.dimensions.widthCm, expected.widthCm);
    assert.equal(Object.hasOwn(item, 'unit'), false);
    assert.deepEqual(item.dimensions, { widthCm: expected.widthCm });
    assert.equal(item.modelFile ?? null, expected.modelFile);

    assert.equal(catalog.itemKey, itemKey);
    assert.equal(catalog.label, item.name);
    assert.equal(catalog.previewId, item.previewId);
    assert.equal(Object.hasOwn(catalog, 'type'), false);
    assert.equal(Object.hasOwn(catalog, 'widthCm'), false);
    assert.equal(Object.hasOwn(catalog, 'modelFile'), false);

    const state = createModuleStateFromDescriptor(catalog);
    assert.equal(state.itemKey, itemKey);
    assert.equal(state.itemKey, itemKey);
    assert.equal(state.type, 'separator');
    const scene = resolveSceneDimensions(item);
    assert.equal(state.widthCm, expected.widthCm);
    assert.equal(state.widthCm, scene.widthCm);
    assert.equal(state.heightCm, scene.heightCm);
    assert.equal(state.depthCm, scene.depthCm);
    assert.equal(state.modelFile ?? null, expected.modelFile);
    assert.equal(Boolean(state.surface?.color), true);
    assert.equal('imageAssetId' in state.surface, false);

    if (!expected.modelFile) {
      const byWidth = createSeparatorModuleState(expected.widthCm);
      assert.equal(byWidth.itemKey, itemKey);
      assert.equal(byWidth.itemKey, itemKey);
    }

    const behavior = getModuleBehavior(state);
    assert.equal(behavior.placement, 'wall');
    assert.equal(behavior.moveSnapCm, 50);
    assert.equal(getModuleRotationStepDeg(state), 90);

    const contract = resolveModuleContract(itemKey);
    assert.equal(contract.bom.mode, 'recipe');
    assert.equal(contract.profile, 'wall-color-only');

    const recipe = getModuleRecipe('separator', expected.widthCm);
    const quantities = Object.fromEntries(
      recipe.items.map((entry) => [entry.itemKey ?? entry.partId, entry.quantity]),
    );
    assert.deepEqual(quantities, expected.recipeQuantities);

    assert.equal(resolveItemKey(state), itemKey);
    const missingKey = JSON.parse(JSON.stringify(state));
    delete missingKey.itemKey;
    assert.equal(resolveItemKey(missingKey), null);
    assert.equal(normalizeModuleItemState(missingKey).itemKey, undefined);

    const duplicate = duplicateModuleState(state);
    assert.notEqual(duplicate.id, state.id);
    assert.equal(duplicate.itemKey, itemKey);
    assert.notEqual(duplicate.surface.id, state.surface.id);
  });
}

test('sarmasık ve düz separator aynı genişlikte aynı recipe’yi paylaşır', () => {
  for (const width of [50, 100]) {
    const plain = getItem(`wall_separator_${width}_350`);
    const vine = getItem(`wall_separator_${width}_350_sarmasik`);
    assert.equal(plain.dimensions.widthCm, vine.dimensions.widthCm);
    assert.equal(plain.composition.moduleType, undefined);
    assert.equal(vine.composition.moduleType, undefined);
    assert.notEqual(plain.modelFile ?? null, vine.modelFile);
  }
});
