import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCatalogItem,
} from '../src/catalog.js';
import {
  createCounterModuleState,
  createModuleStateFromDescriptor,
  duplicateModuleState,
  normalizeModuleItemState,
} from '../src/designState.js';
import { getItem, resolveItemKey } from '../src/items.js';
import {
  getModuleBehavior,
  getModuleDefaultRotationDeg,
  getModuleRotationStepDeg,
} from '../src/moduleBehavior.js';
import { resolveModuleContract } from '../src/moduleContracts.js';
import {
  getExpandedModuleRecipe,
} from './recipeParentItemKey.js';

const CATALOG_CARDS = { desk_banko_100: 'Banko', desk_banko_100_l: 'Köşe Banko' };

const BANKO_KEYS = [
  'desk_banko_100',
  'desk_banko_150',
  'desk_banko_200',
  'desk_banko_100_l',
  'desk_banko_150_l',
  'desk_banko_200_l',
];

const EXPECTED = {
  desk_banko_100: {
    widthCm: 100, depthCm: 50, heightCm: 100, shape: 'straight', faceCount: 6,
    recipeQuantities: {
      profile_91: 3, profile_41_5: 4, upright_99: 4, panel_98: 2, panel_48_5: 4,
      connector_start: 6, connector_single: 12, counter_top_110_60: 1,
    },
  },
  desk_banko_150: {
    widthCm: 150, depthCm: 50, heightCm: 100, shape: 'straight', faceCount: 6,
    recipeQuantities: {
      profile_140_5: 3, profile_41_5: 4, upright_99: 4, panel_147_5: 2, panel_48_5: 4,
      connector_start: 6, connector_single: 12, counter_top_160_60: 1,
    },
  },
  desk_banko_200: {
    widthCm: 200, depthCm: 50, heightCm: 100, shape: 'straight', faceCount: 6,
    recipeQuantities: {
      profile_190: 3, profile_41_5: 4, upright_99: 4, panel_197: 2, panel_48_5: 4,
      connector_start: 6, connector_single: 12, counter_top_210_60: 1,
    },
  },
  desk_banko_100_l: {
    widthCm: 100, depthCm: 100, heightCm: 100, shape: 'L', faceCount: 8,
    recipeQuantities: {
      profile_91: 5, profile_41_5: 5, upright_99: 5, panel_98: 4, panel_48_5: 4,
      connector_start: 8, connector_single: 16, counter_top_110_60: 1, counter_top_52_60: 1,
    },
  },
  desk_banko_150_l: {
    widthCm: 150, depthCm: 150, heightCm: 100, shape: 'L', faceCount: 8,
    recipeQuantities: {
      profile_140_5: 5, profile_91: 1, profile_41_5: 4, upright_99: 5, panel_147_5: 4, panel_48_5: 4,
      connector_start: 8, connector_single: 16, counter_top_160_60: 1, counter_top_102_60: 1,
    },
  },
  desk_banko_200_l: {
    widthCm: 200, depthCm: 200, heightCm: 100, shape: 'L', faceCount: 8,
    recipeQuantities: {
      profile_190: 5, profile_140_5: 1, profile_41_5: 4, upright_99: 5, panel_197: 4, panel_48_5: 4,
      connector_start: 8, connector_single: 16, counter_top_210_60: 1, counter_top_150_60: 1,
    },
  },
};

for (const itemKey of BANKO_KEYS) {
  test(`${itemKey}: canonical composite identity, state and recipe parity`, () => {
    const item = getItem(itemKey);
    const expected = EXPECTED[itemKey];
    const catalog = getCatalogItem(itemKey);
    const isL = expected.shape === 'L';

    assert.equal(item.itemKey, itemKey);
    assert.equal(item.type, 'counter');
    assert.equal(item.composition?.mode, 'recipe');
    assert.equal(item.composition?.moduleType, undefined);
    assert.equal(item.dimensions.widthCm, expected.widthCm);
    assert.equal(Object.hasOwn(item, 'unit'), false);
    assert.deepEqual(item.dimensions, {
      widthCm: expected.widthCm,
      depthCm: expected.depthCm,
      heightCm: expected.heightCm,
    });
    if (isL) {
      assert.equal(item.shape, 'L');
      assert.equal(Object.hasOwn(item.composition ?? {}, 'options'), false);
    } else {
      assert.equal(item.shape, undefined);
    }

    // Ölçü ailesi (migration 0083, kart 100): katalogda aile başına tek kart, başlık ölçüsüz;
    // diğer ölçüler gizlidir ve ölçü penceresinden Item'ın kendisiyle kurulur.
    if (CATALOG_CARDS[itemKey]) {
      assert.equal(catalog.itemKey, itemKey);
      assert.equal(catalog.label, CATALOG_CARDS[itemKey]);
      assert.equal(catalog.previewId, item.previewId);
      assert.equal(Object.hasOwn(catalog, 'type'), false);
      assert.equal(Object.hasOwn(catalog, 'widthCm'), false);
      assert.equal(Object.hasOwn(catalog, 'shape'), false);
    } else {
      assert.equal(catalog, null);
    }

    const state = createModuleStateFromDescriptor(catalog ?? { itemKey, type: item.type });
    assert.equal(state.itemKey, itemKey);
    assert.equal(state.itemKey, itemKey);
    assert.equal(state.type, 'counter');
    assert.equal(state.shape, expected.shape);
    assert.equal(state.widthCm, expected.widthCm);
    assert.equal(state.depthCm, expected.depthCm);
    assert.equal(Object.keys(state.faces).length, expected.faceCount);

    const byWidth = createCounterModuleState(expected.widthCm, isL ? { shape: 'L' } : {});
    assert.equal(byWidth.itemKey, itemKey);

    assert.equal(getModuleBehavior(state).placement, 'free');
    assert.equal(getModuleBehavior(state).moveSnapCm, 10);
    if (isL) {
      assert.equal(getModuleDefaultRotationDeg(state), 270);
      assert.equal(getModuleRotationStepDeg(state), 15);
    } else {
      assert.equal(getModuleRotationStepDeg(state), 15);
    }

    const contract = resolveModuleContract(itemKey);
    assert.equal(contract.bom.mode, 'recipe');
    assert.equal(contract.bom.source, 'src/moduleRecipes.js');

    const recipe = getExpandedModuleRecipe('counter', expected.widthCm, isL ? { shape: 'L' } : {});
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
  });
}
