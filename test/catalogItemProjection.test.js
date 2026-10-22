import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listCatalogGroups,
  listCatalogItems,
  getCatalogItem,
} from '../src/catalog.js';
import { listRegisteredItems } from '../src/items.js';

const BASELINE = JSON.parse(
  readFileSync(new URL('./catalogProjectionBaseline.json', import.meta.url), 'utf8'),
);

const COMPARE_FIELDS = Object.freeze([
  'itemKey',
  'label',
  'previewId',
]);

function pickComparable(descriptor) {
  const picked = {};
  for (const field of COMPARE_FIELDS) {
    if (Object.hasOwn(descriptor, field)) picked[field] = descriptor[field];
  }
  return picked;
}

test('listCatalogItems 54 görünür Item’ı Item kaydından üretir; hardcoded key listesi yoktur', () => {
  const items = listRegisteredItems();
  const visible = items.filter((item) => item.catalogVisible === true);
  const projected = listCatalogItems();
  const catalogSource = readFileSync(new URL('../src/catalog.js', import.meta.url), 'utf8');

  assert.equal(items.length, 132);
  assert.equal(visible.length, 54);
  assert.equal(projected.length, 54);
  assert.equal(new Set(projected.map((item) => item.itemKey)).size, 54);
  assert.deepEqual(projected.map((item) => item.itemKey), BASELINE.keys);

  const projectedKeys = new Set(projected.map((item) => item.itemKey));
  assert.equal(visible.filter((item) => !projectedKeys.has(item.itemKey)).length, 0);
  assert.equal(projected.filter((item) => getCatalogItem(item.itemKey) == null).length, 0);
  assert.equal(getCatalogItem('panel_197'), null);
  assert.equal(getCatalogItem('illuminated-foam'), null);

  assert.doesNotMatch(catalogSource, /createFlatPanelCatalogItem/);
  assert.doesNotMatch(catalogSource, /createCommercialCatalogItem/);
  assert.doesNotMatch(catalogSource, /wall_200:\s*create/);
  assert.doesNotMatch(catalogSource, /export const MODULE_CATALOG/);
  assert.match(catalogSource, /listRegisteredItems\(\)/);
  assert.match(catalogSource, /export function listCatalogItems/);
  assert.match(catalogSource, /export function getCatalogItem/);
});

test('yeni catalog projection yalnız itemKey / label / catalogPreview taşır', () => {
  const byKey = new Map(BASELINE.descriptors.map((descriptor) => [descriptor.itemKey, descriptor]));
  let compared = 0;

  for (const item of listCatalogItems()) {
    const expected = byKey.get(item.itemKey);
    assert.ok(expected, item.itemKey);
    assert.deepEqual(Object.keys(item).sort(), ['itemKey', 'label', 'previewId'], item.itemKey);
    assert.deepEqual(pickComparable(item), pickComparable(expected), item.itemKey);
    assert.deepEqual(pickComparable(getCatalogItem(item.itemKey)), pickComparable(expected), item.itemKey);
    compared += 1;
  }

  assert.equal(compared, 54);
  assert.deepEqual([...listCatalogItems().map((item) => item.itemKey)], BASELINE.keys);
});

test('kategori sırası, adı, üye sayısı ve Item sırası değişmez', () => {
  const groups = listCatalogGroups();
  assert.equal(groups.length, BASELINE.groups.length);
  groups.forEach((group, index) => {
    const expected = BASELINE.groups[index];
    assert.equal(group.id, expected.id);
    assert.equal(group.catalogName, expected.catalogName);
    assert.equal(group.catalogIndex, expected.catalogIndex);
    assert.deepEqual([...group.keys], expected.keys);
  });
});
