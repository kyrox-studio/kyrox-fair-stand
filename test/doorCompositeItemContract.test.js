import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCatalogItem,
  listCatalogItems,
} from '../src/catalog.js';
import {
  createDoorModuleState,
  createModuleStateFromCatalogKey,
  createModuleStateFromDescriptor,
  normalizeModuleItemState,
} from '../src/designState.js';
import { resolveItemBom } from '../src/itemBom.js';
import { getItem, initializeItemRegistry, listRegisteredItems } from '../src/items.js';
import { getModuleBehavior, getModuleRotationStepDeg } from '../src/moduleBehavior.js';
import { resolveModuleContract } from '../src/moduleContracts.js';
import {
  getRecipeItemKey,
} from '../src/moduleRecipes.js';
import {
  getExpandedModuleRecipe,
  getModuleRecipe,
} from './recipeParentItemKey.js';
import { loadCanonicalItemCatalog } from './registerCanonicalItemCatalog.mjs';

const EXPECTED_CHILDREN = [
  ['profile_91', 1],
  ['upright_346_5', 2],
  ['panel_98', 3],
  ['connector_start', 2],
  ['connector_single', 5],
  ['door_leaf_100', 1],
];

test('door_100 is the single canonical composite Item identity', () => {
  const item = getItem('wall_door_100_350');

  assert.equal(item.itemKey, 'wall_door_100_350');
  assert.equal(item.name, 'Depo Kapısı 100');
  assert.equal(item.type, 'door');
  assert.equal(item.unit, 'adet');
  assert.deepEqual(item.dimensions, { widthCm: 100 });
  assert.equal(item.composition.mode, 'recipe');
  assert.equal(item.composition.moduleType, undefined);
  assert.deepEqual(
    item.composition.items.map((entry) => [entry.itemKey, entry.quantity]),
    EXPECTED_CHILDREN,
  );
  assert.equal(getItem('wall_door_100_350').itemKey, 'wall_door_100_350');
  assert.equal(getItem('wall_door_100_350').composition.mode, 'recipe');
  assert.equal(Object.hasOwn(getItem('door_leaf_100'), 'composition'), false);
});

test('legacy uppercase DOOR_100 catalog identity is removed', () => {
  assert.equal(getCatalogItem('DOOR_100'), null);
  assert.equal(getCatalogItem('DOOR_100') != null, false);
  assert.equal(getCatalogItem('wall_door_100_350') != null, true);

  const catalogItem = getCatalogItem('wall_door_100_350');
  assert.equal(catalogItem.itemKey, 'wall_door_100_350');
  assert.equal(catalogItem.label, 'Depo Kapısı 100');
  assert.equal(getItem('wall_door_100_350').type, 'door');
  assert.equal(getItem('wall_door_100_350').dimensions.widthCm, 100);
});

test('door_100 composition delegates quantities to the existing canonical recipe', () => {
  const recipe = getModuleRecipe('door', 100);
  assert.ok(recipe);
  assert.deepEqual(
    recipe.items.map((entry) => [getRecipeItemKey(entry), entry.quantity]),
    EXPECTED_CHILDREN,
  );
});

test('door_100 recursive BOM resolves to canonical leaf Items with quantities and units', () => {
  const bom = resolveItemBom('wall_door_100_350');
  assert.deepEqual(
    bom.map((line) => [line.itemKey, line.quantity, line.unit]),
    EXPECTED_CHILDREN.map(([itemKey, quantity]) => [itemKey, quantity, 'adet']),
  );
  bom.forEach((line) => {
    assert.equal(line.item.itemKey ?? line.item.partId, line.itemKey);
  });
});

test('door_100 factory resolves canonical width from sceneDimensions when dimensions.widthCm is absent', () => {
  const items = listRegisteredItems().map((item) => {
    if (item.itemKey !== 'wall_door_100_350') return item;
    return {
      ...structuredClone(item),
      dimensions: {},
      sceneDimensions: { widthCm: 100, depthCm: 10, heightCm: 350 },
    };
  });
  initializeItemRegistry(items);
  try {
    assert.equal(createDoorModuleState(100)?.itemKey, 'wall_door_100_350');
    assert.equal(createModuleStateFromCatalogKey('wall_door_100_350')?.widthCm, 100);
  } finally {
    loadCanonicalItemCatalog();
  }
});

test('door_100 factory/persistence identity and child door leaf identity are canonical', () => {
  const state = createModuleStateFromDescriptor(getCatalogItem('wall_door_100_350'));
  assert.ok(state);
  assert.equal(state.itemKey, 'wall_door_100_350');
  assert.equal(state.itemKey, 'wall_door_100_350');
  assert.equal(state.type, 'door');
  assert.equal(state.widthCm, 100);
  assert.equal(state.surface.itemKey, 'door_leaf_100');

  state.surface.color = '#123456';
  const normalized = normalizeModuleItemState(state);
  assert.equal(normalized.itemKey, 'wall_door_100_350');
  assert.equal(normalized.surface.itemKey, 'door_leaf_100');
  assert.equal(normalized.surface.color, '#123456');
});

test('door_100 preserves the existing door behavior/contract family', () => {
  const behavior = getModuleBehavior(getItem('wall_door_100_350'));
  assert.equal(behavior.placement, 'wall');
  assert.equal(behavior.moveSnapCm, 10);
  assert.equal(getModuleRotationStepDeg(getItem('wall_door_100_350')), 15);
  assert.equal(behavior.collision, 'segment');
  assert.equal(behavior.allowSideInsert, true);

  const contract = resolveModuleContract('wall_door_100_350');
  assert.ok(contract);
  assert.equal(contract.id, 'wall_door_100_350');
  assert.equal(contract.type, 'door');
  assert.equal(contract.profile, 'wall-editable');
  assert.equal(contract.bom.mode, 'recipe');
});

test('active door Item surfaces no longer carry the uppercase legacy key', () => {
  const catalogSource = readFileSync(new URL('../src/catalog.js', import.meta.url), 'utf8');
  const contractSource = readFileSync(new URL('../src/moduleContracts.js', import.meta.url), 'utf8');
  const systemCatalog = readFileSync(new URL('../SYSTEM_MODULE_CATALOG.md', import.meta.url), 'utf8');
  const projectBomSource = readFileSync(new URL('../src/projectBom.js', import.meta.url), 'utf8');

  assert.doesNotMatch(catalogSource, /DOOR_100/);
  assert.doesNotMatch(contractSource, /DOOR_100/);
  assert.doesNotMatch(systemCatalog, /DOOR_100/);
  assert.match(projectBomSource, /import \{ resolveItemBom \} from '\.\/itemBom\.js'/);
  assert.equal(resolveItemBom('wall_door_100_350').some((line) => line.itemKey === 'door_leaf_100'), true);
  assert.equal(readdirSync(new URL('../docs/items/definitions/', import.meta.url)).includes('DOOR_100.md'), false);
});
