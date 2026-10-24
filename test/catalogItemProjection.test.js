import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listCatalogGroups,
  listCatalogItems,
  getCatalogItem,
  getModuleCatalogLabel,
} from '../src/catalog.js';
import { getItem, listRegisteredItems } from '../src/items.js';
import { isCatalogWidthFamilyDescriptor } from '../src/catalogWidthFamily.js';

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

test('listCatalogItems 35 görünür Item’ı Item kaydından üretir; hardcoded key listesi yoktur', () => {
  const items = listRegisteredItems();
  const visible = items.filter((item) => item.catalogVisible === true);
  const projected = listCatalogItems();
  const catalogSource = readFileSync(new URL('../src/catalog.js', import.meta.url), 'utf8');

  assert.equal(items.length, 133);
  assert.equal(visible.length, 35);
  assert.equal(projected.length, 35);
  assert.equal(new Set(projected.map((item) => item.itemKey)).size, 35);
  assert.deepEqual(projected.map((item) => item.itemKey), BASELINE.keys);

  const projectedKeys = new Set(projected.map((item) => item.itemKey));
  assert.equal(visible.filter((item) => !projectedKeys.has(item.itemKey)).length, 0);
  assert.equal(projected.filter((item) => getCatalogItem(item.itemKey) == null).length, 0);
  assert.equal(getCatalogItem('panel_197'), null);
  // Işıklı Strafor katalogdan konur (0084); logo görseli panelden seçilir.
  assert.equal(getCatalogItem('illuminated-foam')?.previewId, 9);

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

  assert.equal(compared, 35);
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

test('ölçü soran kartlar ölçüsüz başlık taşır; sahnedeki parça Item adını taşır', () => {
  const labels = Object.fromEntries(listCatalogItems().map((item) => [item.itemKey, item.label]));
  assert.equal(labels.profile_289, 'Profil');
  assert.equal(labels.upright_346_5, 'Dikme');
  assert.equal(labels.wall_100_short_1, 'Panel Tek Sıra');
  assert.equal(labels.wall_100_short_2, 'Panel Çift Sıra');
  assert.equal(labels.wall_100_350, 'Panel');
  assert.equal(labels.wall_separator_100_350, 'Separatör');
  for (const itemKey of ['profile_289', 'upright_346_5', 'wall_100_short_1', 'wall_100_short_2', 'wall_100_350', 'wall_separator_100_350']) {
    assert.equal(getModuleCatalogLabel({ itemKey }), getItem(itemKey).name, itemKey);
  }
  // Ölçü sormayan kart Item adını aynen gösterir.
  const other = listCatalogItems().find((item) => !['profile', 'upright'].includes(getItem(item.itemKey).type)
    && !isCatalogWidthFamilyDescriptor({ itemKey: item.itemKey }));
  assert.equal(other.label, getItem(other.itemKey).name);
});
