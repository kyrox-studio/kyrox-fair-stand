import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { listCatalogItems } from '../src/catalog.js';
import { createModuleStateFromDescriptor } from '../src/designState.js';
import { resolveItemBom } from '../src/itemBom.js';
import {
  getItem,
  getItemType,
  initializeItemRegistry,
  initializeItemTypeRegistry,
  listFloorItems,
  listRegisteredItems,
} from '../src/items.js';
import { getModuleBehavior } from '../src/moduleBehavior.js';
import { mapCatalogSeedToBootstrap } from './mapCatalogSeed.mjs';
import { loadCanonicalItemCatalog } from './registerCanonicalItemCatalog.mjs';

const PRODUCTION_ITEMS = [
  { itemKey: 'digital_print', name: 'Dijital Baskı', quantity: 52.72 },
  { itemKey: 'mesh_fabric', name: 'Mesh Baskı', quantity: 18.4 },
  { itemKey: 'lightbox_fabric', name: 'Lightbox Bezi', quantity: 12 },
];

function productionItem(itemKey, name) {
  return {
    itemKey,
    name,
    type: 'production',
    unit: 'metre_kare',
    catalogVisible: false,
    categoryId: null,
    catalogItemIndex: null,
    isRender: false,
    acceptsColor: false,
    acceptsImage: false,
    acceptsLightbox: false,
    acceptsGlass: false,
    acceptsMesh: false,
    isActive: true,
    defaultOpacity: 1,
    defaultZCm: 0,
  };
}

function registerProductionItems() {
  const seed = JSON.parse(readFileSync(new URL('./fixtures/itemCatalogSeed.json', import.meta.url), 'utf8'));
  const snapshot = mapCatalogSeedToBootstrap(seed);
  initializeItemTypeRegistry([
    ...snapshot.itemTypes,
    {
      id: snapshot.itemTypes.length + 1,
      key: 'production',
      displayName: 'Üretim',
      isActive: true,
    },
  ]);
  initializeItemRegistry([
    ...listRegisteredItems(),
    ...PRODUCTION_ITEMS.map((item) => productionItem(item.itemKey, item.name)),
  ]);
}

test('production type is classification-only and the print items stay out of the scene', () => {
  registerProductionItems();
  try {
    const productionType = getItemType('production');
    assert.equal(productionType.displayName, 'Üretim');
    assert.equal(productionType.placement, undefined);
    assert.throws(
      () => getModuleBehavior('production'),
      /has no scene behavior/,
    );
    assert.equal(getModuleBehavior('not-a-registered-type').placement, 'wall');
    assert.equal(getModuleBehavior('flat-panel').placement, 'wall');
    assert.equal(getModuleBehavior('profile').placement, 'wall');
    assert.equal(getModuleBehavior('floor').placement, 'wall');
    assert.equal(getModuleBehavior({ type: 'flat-panel' }).moveSnapCm, 10);

    const catalogKeys = new Set(listCatalogItems().map((item) => item.itemKey));
    const floorKeys = new Set(listFloorItems().map((item) => item.itemKey));
    for (const item of PRODUCTION_ITEMS) {
      const registered = getItem(item.itemKey);
      assert.equal(registered.name, item.name);
      assert.equal(registered.type, 'production');
      assert.equal(registered.unit, 'metre_kare');
      assert.equal(registered.catalogVisible, false);
      assert.equal(registered.isRender, false);
      assert.equal(catalogKeys.has(item.itemKey), false);
      assert.equal(floorKeys.has(item.itemKey), false);
      assert.throws(
        () => createModuleStateFromDescriptor(registered),
        /has no scene behavior/,
      );
      const [line] = resolveItemBom(item.itemKey, item.quantity);
      assert.equal(line.itemKey, item.itemKey);
      assert.equal(line.quantity, item.quantity);
      assert.equal(line.unit, 'metre_kare');
      assert.equal(line.item.name, item.name);
    }
  } finally {
    loadCanonicalItemCatalog();
  }
});
