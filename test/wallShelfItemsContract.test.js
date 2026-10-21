import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCatalogItem,
} from '../src/catalog.js';
import {
  createModuleStateFromDescriptor,
  MODULE_STATE_TYPES,
} from '../src/designState.js';
import { getItem, resolveItemKey } from '../src/items.js';
import { resolveModuleContract } from '../src/moduleContracts.js';
import {
  getModuleRecipe,
} from './recipeParentItemKey.js';

const REMOVED_WALL_SHELF_KEYS = Object.freeze([
  'wall_shelf_2_100',
  'wall_shelf_2_150',
  'wall_shelf_2_200',
  'wall_shelf_3_100',
  'wall_shelf_3_150',
  'wall_shelf_3_200',
]);

test('silinen wall_shelf composite Item, catalog, contract ve recipe kayıtları yoktur', () => {
  for (const itemKey of REMOVED_WALL_SHELF_KEYS) {
    assert.equal(getItem(itemKey), null, itemKey);
    assert.equal(getCatalogItem(itemKey), null, itemKey);
    assert.equal(resolveModuleContract(itemKey), null, itemKey);
  }

  assert.equal(getModuleRecipe('shelf', 100, { shelfCount: 2 }), null);
  assert.equal(getModuleRecipe('shelf', 150, { shelfCount: 2 }), null);
  assert.equal(getModuleRecipe('shelf', 200, { shelfCount: 2 }), null);
  assert.equal(getModuleRecipe('shelf', 100, { shelfCount: 3 }), null);
  assert.equal(getModuleRecipe('shelf', 150, { shelfCount: 3 }), null);
  assert.equal(getModuleRecipe('shelf', 200, { shelfCount: 3 }), null);
  assert.equal(getModuleRecipe('shelf', 100), null);
});

test('shelf factory ve shelfCount identity alanı kaldırıldı; leaf shelf_* durur', () => {
  assert.equal(MODULE_STATE_TYPES.includes('shelf'), true);
  assert.equal(createModuleStateFromDescriptor({ itemKey: 'wall_shelf_2_100', type: 'shelf' }), null);
  assert.equal(resolveItemKey({ type: 'shelf', widthCm: 100, shelfCount: 2 }), null);
  assert.equal(resolveItemKey({ type: 'shelf', widthCm: 100 }), null);
  assert.equal(createModuleStateFromDescriptor({ type: 'shelf', widthCm: 100 }), null);
  assert.equal(resolveItemKey({ itemKey: 'shelf_100' }), 'shelf_100');

  const board = getItem('shelf_100');
  assert.equal(board.itemKey, 'shelf_100');
  assert.equal(board.type, 'shelf');
  assert.equal(board.composition.mode, 'recipe');
  assert.deepEqual(board.composition.items, [{ itemKey: 'shelf_100_self', quantity: 1 }, { itemKey: 'shelf_leg', quantity: 2 }]);
  assert.equal(Object.hasOwn(board, 'shelfCount'), false);
  const state = createModuleStateFromDescriptor({ itemKey: 'shelf_100', type: 'shelf' });
  assert.equal(state.itemKey, 'shelf_100');
  assert.equal(state.type, 'shelf');
  assert.equal(Object.hasOwn(state, 'shelfCount'), false);
});
