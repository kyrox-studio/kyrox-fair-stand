import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  getCatalogItem,
} from '../src/catalog.js';
import {
  createBaseModuleState,
  createModuleStateFromDescriptor,
  duplicateModuleState,
  normalizeModuleItemState,
} from '../src/designState.js';
import { getItem, resolveItemKey } from '../src/items.js';
import { getModuleBehavior } from '../src/moduleBehavior.js';
import { resolveModuleContract } from '../src/moduleContracts.js';
import {
  getModuleRecipe,
} from './recipeParentItemKey.js';

const CATALOG_CARDS = { base_100: 'Baza' };

const BASE_KEYS = ['base_100', 'base_150', 'base_200'];

const EXPECTED_RECIPE = {
  base_100: {
    widthCm: 100,
    top: 'base_top_107_50',
    profile: 'profile_91',
    panel: 'panel_98',
  },
  base_150: {
    widthCm: 150,
    top: 'base_top_157_50',
    profile: 'profile_140_5',
    panel: 'panel_147_5',
  },
  base_200: {
    widthCm: 200,
    top: 'base_top_206_50',
    profile: 'profile_190',
    panel: 'panel_197',
  },
};

for (const itemKey of BASE_KEYS) {
  test(`${itemKey}: canonical composite identity, state and recipe parity`, () => {
    const item = getItem(itemKey);
    const expected = EXPECTED_RECIPE[itemKey];
    const catalog = getCatalogItem(itemKey);

    assert.equal(item.itemKey, itemKey);
    assert.equal(item.type, 'base');
    assert.equal(item.composition?.mode, 'recipe');
    assert.equal(item.composition?.moduleType, undefined);
    assert.equal(item.dimensions.widthCm, expected.widthCm);
    assert.equal(Object.hasOwn(item, 'unit'), false);
    assert.deepEqual(item.dimensions, {
      widthCm: expected.widthCm,
      depthCm: 50,
      heightCm: 50,
    });

    // Ölçü ailesi (migration 0083): katalogda aile başına tek kart, başlık ölçüsüz;
    // diğer ölçüler gizlidir ve ölçü penceresinden Item'ın kendisiyle kurulur.
    if (CATALOG_CARDS[itemKey]) {
      assert.equal(catalog.itemKey, itemKey);
      assert.equal(catalog.label, CATALOG_CARDS[itemKey]);
      assert.equal(catalog.previewId, item.previewId);
      assert.equal(Object.hasOwn(catalog, 'type'), false);
      assert.equal(Object.hasOwn(catalog, 'widthCm'), false);
    } else {
      assert.equal(catalog, null);
    }

    const state = createModuleStateFromDescriptor(catalog ?? { itemKey, type: item.type });
    assert.equal(state.itemKey, itemKey);
    assert.equal(state.itemKey, itemKey);
    assert.equal(state.type, 'base');
    assert.equal(state.widthCm, expected.widthCm);
    assert.deepEqual(Object.keys(state.faces), ['front', 'left', 'right']);

    const byWidth = createBaseModuleState(expected.widthCm);
    assert.equal(byWidth.itemKey, itemKey);
    assert.equal(byWidth.itemKey, itemKey);

    assert.equal(getModuleBehavior(state).placement, 'free');
    assert.equal(getModuleBehavior(state).connectionEndpoint, 'logical-fixture');
    assert.equal(getModuleBehavior(state).moveSnapCm, 10);

    const contract = resolveModuleContract(itemKey);
    assert.equal(contract.bom.mode, 'recipe');
    assert.equal(contract.bom.source, 'src/moduleRecipes.js');

    const recipe = getModuleRecipe('base', expected.widthCm);
    const quantities = Object.fromEntries(
      recipe.items.map((entry) => [entry.itemKey ?? entry.partId, entry.quantity]),
    );
    assert.equal(quantities[expected.profile], 4);
    assert.equal(quantities.profile_41_5, 4);
    assert.equal(quantities.upright_49_5, 4);
    assert.equal(quantities[expected.panel], 2);
    assert.equal(quantities.panel_48_5, 2);
    assert.equal(quantities.connector_start, 8);
    assert.equal(quantities.connector_single, 8);
    assert.equal(quantities[expected.top], 1);

    assert.equal(resolveItemKey(state), itemKey);
    const missingKey = JSON.parse(JSON.stringify(state));
    delete missingKey.itemKey;
    assert.equal(resolveItemKey(missingKey), null);
    assert.equal(normalizeModuleItemState(missingKey).itemKey, undefined);

    const duplicate = duplicateModuleState(state);
    assert.notEqual(duplicate.id, state.id);
    assert.equal(duplicate.itemKey, itemKey);
    assert.notEqual(duplicate.faces.front.id, state.faces.front.id);
  });
}

test('silinen wall_base Item’ları BASE recipe ailesinden ayrı durur ve kayıtlı değildir', () => {
  for (const width of [100, 150, 200]) {
    const wallKey = `wall_base_${width}`;
    assert.equal(getItem(wallKey), null, wallKey);
    assert.equal(getCatalogItem(wallKey), null, wallKey);
    assert.equal(getModuleRecipe('base-wall', width), null, wallKey);

    const baseRecipe = getModuleRecipe('base', width);
    const baseTop = EXPECTED_RECIPE[`base_${width}`].top;
    const baseQty = Object.fromEntries(baseRecipe.items.map((entry) => [entry.itemKey, entry.quantity]));
    assert.equal(baseQty[baseTop], 1);
    assert.equal(baseQty.upright_49_5, 4);
    assert.equal(baseQty.connector_start, 8);
  }
});

test('base factory never resolves through getCommercialItemForType', () => {
  const source = fs.readFileSync(new URL('../src/designState.js', import.meta.url), 'utf8');
  assert.match(source, /base:\s*\(descriptor\)\s*=>\s*createBaseModuleState\(descriptor\)/);
  assert.doesNotMatch(source, /getCommercialItemForType\(['"]base['"]\)/);
});
