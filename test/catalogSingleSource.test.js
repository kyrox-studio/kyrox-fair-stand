import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCatalogItem,
  getModuleCatalogLabel,
  listCatalogItems,
  listCatalogGroups,
} from '../src/catalog.js';
import { getItem, resolveItemKey } from '../src/items.js';

test('every catalog module belongs to exactly one catalog group', () => {
  const groupedKeys = listCatalogGroups().flatMap((group) => group.keys);
  assert.equal(groupedKeys.length, listCatalogItems().map((item) => item.itemKey).length);
  assert.deepEqual([...groupedKeys].sort(), [...listCatalogItems().map((item) => item.itemKey)].sort());
  assert.equal(new Set(groupedKeys).size, groupedKeys.length);
});

test('every catalog module resolves its single-source key and label', () => {
  listCatalogItems().map((item) => item.itemKey).forEach((moduleKey) => {
    const module = getCatalogItem(moduleKey);
    assert.ok(module, moduleKey);
    assert.equal(resolveItemKey({ ...module, itemKey: moduleKey }), moduleKey);
    // Sahnedeki parça Item adını taşır; ölçü soran kartın başlığı ölçüsüz olabilir.
    assert.equal(getModuleCatalogLabel({ ...module, itemKey: moduleKey }), getItem(moduleKey).name);
  });
});

test('separator identity is itemKey, not type/width/modelFile guess', () => {
  assert.equal(resolveItemKey({ type: 'separator', widthCm: 100 }), null);
  assert.equal(resolveItemKey({ type: 'separator', widthCm: 50 }), null);
  assert.equal(
    resolveItemKey({ type: 'separator', widthCm: 100, modelFile: 'wall_separator_100_sarmasik.glb' }),
    null,
  );
  assert.equal(resolveItemKey({ itemKey: 'wall_separator_100_350' }), 'wall_separator_100_350');
  assert.equal(resolveItemKey({ itemKey: 'wall_separator_100_350_sarmasik' }), 'wall_separator_100_350_sarmasik');
});

test('catalogKey is not a product identity input', () => {
  assert.equal(resolveItemKey({ catalogKey: 'wall_100_350' }), null);
  assert.equal(
    resolveItemKey({ type: 'flat-panel', widthCm: 100, catalogKey: 'wall_200_350' }),
    null,
  );
  assert.equal(resolveItemKey({ itemKey: 'wall_100_350' }), 'wall_100_350');
});

test('left catalog, context catalog and drag badge share catalog presentation source', () => {
  const sidebar = readFileSync(new URL('../src/moduleDragSidebar.js', import.meta.url), 'utf8');
  const contextMenu = readFileSync(new URL('../src/moduleContextMenu.js', import.meta.url), 'utf8');
  const scene = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');

  assert.match(sidebar, /listCatalogGroups/);
  assert.match(sidebar, /getCatalogItem/);
  assert.match(contextMenu, /createModuleCatalogPreview/);
  assert.match(contextMenu, /getModuleCatalogLabel/);
  assert.match(scene, /createModuleCatalogPreview/);
  assert.match(scene, /getModuleCatalogLabel/);
  assert.doesNotMatch(scene, /function getDragModuleLabel/);
});
