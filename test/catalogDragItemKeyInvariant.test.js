import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { getCatalogItem, listCatalogItems } from '../src/catalog.js';
import {
  createModuleStateFromCatalogKey,
  createModuleStateFromDescriptor,
  hasCanonicalModuleItemKey,
} from '../src/designState.js';

const SHELF_KEYS = Object.freeze(['shelf_100', 'shelf_150', 'shelf_200']);
const MAIN_SOURCE = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const SIDEBAR_SOURCE = readFileSync(new URL('../src/moduleDragSidebar.js', import.meta.url), 'utf8');

test('catalog-visible Item drag state keeps canonical itemKey from Item master', () => {
  for (const catalogItem of listCatalogItems()) {
    const fromDto = createModuleStateFromDescriptor(getCatalogItem(catalogItem.itemKey), {
      itemKey: catalogItem.itemKey,
    });
    const fromKey = createModuleStateFromCatalogKey(catalogItem.itemKey);
    assert.ok(fromDto, catalogItem.itemKey);
    assert.ok(fromKey, catalogItem.itemKey);
    assert.equal(fromDto.itemKey, catalogItem.itemKey);
    assert.equal(fromKey.itemKey, catalogItem.itemKey);
    assert.equal(fromDto.type, fromKey.type);
    assert.equal(hasCanonicalModuleItemKey(fromDto), true, catalogItem.itemKey);
    assert.equal(hasCanonicalModuleItemKey(fromKey), true, catalogItem.itemKey);
  }
});

test('shelf_100/150/200 catalog card → drag state itemKey is exact and width/type cannot invent identity', () => {
  for (const itemKey of SHELF_KEYS) {
    const catalog = getCatalogItem(itemKey);
    const state = createModuleStateFromCatalogKey(itemKey);
    assert.equal(catalog.itemKey, itemKey);
    assert.equal(state.itemKey, itemKey);
    assert.equal(state.type, 'shelf');
    assert.equal(hasCanonicalModuleItemKey(state), true);
  }

  const widthOnly = createModuleStateFromDescriptor({ type: 'shelf', widthCm: 100 });
  assert.equal(widthOnly, null);
  const stripped = { type: 'shelf', widthCm: 100, itemKey: undefined };
  assert.equal(hasCanonicalModuleItemKey(stripped), false);
  assert.equal(createModuleStateFromCatalogKey(undefined), null);
});

test('drop commit rehydrates from catalog key and does not keep a shelf without itemKey', () => {
  assert.match(MAIN_SOURCE, /function commitDroppedCatalogModule\(moduleState, dropResult, catalogKey = null\)/);
  assert.match(MAIN_SOURCE, /if \(preservePlacement && module\.placement\) \{\s*state\.placement = \{ \.\.\.module\.placement \};\s*\}/);
  assert.match(MAIN_SOURCE, /if \(moduleState\?\.id\) canonical\.id = moduleState\.id;/);
  assert.match(MAIN_SOURCE, /if \(!canonical \|\| !hasCanonicalModuleItemKey\(canonical\)\)/);
  assert.match(MAIN_SOURCE, /const previousModules = currentModules\.slice\(\)/);
  assert.match(MAIN_SOURCE, /currentModules = previousModules/);
  // Kart kodu kontrolü sürüyor; duvar yüksekliğine çevrilmiş kod (wall_100_300) ana koduyla (wall_100_350) karşılaştırılır.
  assert.match(SIDEBAR_SOURCE, /const stateCatalogKey = getItem\(state\?\.itemKey\)\?\.wallHeightBaseItemKey \?\? state\?\.itemKey;/);
  assert.match(SIDEBAR_SOURCE, /if \(!state \|\| stateCatalogKey !== moduleKey\)/);
  assert.match(SIDEBAR_SOURCE, /catalogKey = activeCard\?\.dataset\.moduleKey \?\? state\?\.itemKey/);
  assert.match(SIDEBAR_SOURCE, /onDrop\?\.\(state, event\.clientX, event\.clientY, rotationZDeg, isRotationLocked, catalogKey\)/);
});
