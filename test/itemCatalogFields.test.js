import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCatalogItem,
  listCatalogItems,
  listCatalogGroups,
} from '../src/catalog.js';
import { getItem, listRegisteredItems } from '../src/items.js';

const CATALOG_CATEGORY_IDS_BY_LABEL = Object.freeze({
  'Panel & Duvar': 1,
  'Panel Ek Modül': 2,
  'Raf & Vitrin': 3,
  'Banko & Baza': 4,
  Extra: 5,
  'Elektronik & Aydınlatma': 6,
});

const EXPECTED_CATALOG_GROUPS = Object.freeze([
  Object.freeze({
    label: 'Panel & Duvar',
    keys: Object.freeze([
      'wall_200_350',
      'wall_150_350',
      'wall_100_350',
      'wall_50_350',
      'wall_separator_100_350',
      'wall_separator_50_350',
      'wall_separator_100_350_sarmasik',
      'wall_separator_50_350_sarmasik',
      'wall_door_100_350',
    ]),
  }),
  Object.freeze({
    label: 'Panel Ek Modül',
    keys: Object.freeze([
      'wall_200_short_2',
      'wall_150_short_2',
      'wall_100_short_2',
      'wall_50_short_2',
      'wall_200_short_1',
      'wall_150_short_1',
      'wall_100_short_1',
      'wall_50_short_1',
      'upright_346_5',
      'profile_289',
      'box_block',
    ]),
  }),
  Object.freeze({
    label: 'Raf & Vitrin',
    keys: Object.freeze([
      'wall_showcase_100_3_350',
      'wall_showcase_100_2_350',
      'shelf_row_1',
      'shelf_row_2',
      'shelf_row_3',
      'floor_showcase_100',
    ]),
  }),
  Object.freeze({
    label: 'Banko & Baza',
    keys: Object.freeze([
      'desk_banko_200',
      'desk_banko_150',
      'desk_banko_100',
      'desk_banko_200_l',
      'desk_banko_150_l',
      'desk_banko_100_l',
      'base_200',
      'base_150',
      'base_100',
    ]),
  }),
  Object.freeze({
    label: 'Extra',
    keys: Object.freeze([
      'furniture_sofa_set_classic',
      'furniture_sofa_single_classic',
      'furniture_sofa_double_classic',
      'furniture_coffee_table_classic',
      'furniture_table_chair_set_eames',
      'chair_eames',
      'glass_table',
      'furniture_bar_stool_classic',
      'mini_fridge_avanti',
      'kettle',
      'coat_rack',
      'plastic_trash_bin',
      'extra_indoor_plant_1',
      'extra_long_planter_100',
      'extra_long_planter_150',
      'extra_long_planter_200',
      'tulle_fabric',
      'brochure_stand',
      'glass_bar_table',
    ]),
  }),
  Object.freeze({
    label: 'Elektronik & Aydınlatma',
    keys: Object.freeze([
      'tv_42',
      'tv_55',
      'video_wall_2x2',
      'video_wall_3x3',
      'tv_65',
      'led_floodlight',
    ]),
  }),
]);

const EXPECTED_CATALOG_KEYS = Object.freeze(EXPECTED_CATALOG_GROUPS.flatMap((group) => group.keys));

function expectedFieldsForItemKey(itemKey) {
  const shelfIndexes = { shelf_100: 3, shelf_150: 4, shelf_200: 5 };
  if (shelfIndexes[itemKey]) return { catalogVisible: false, categoryId: 3, catalogItemIndex: shelfIndexes[itemKey] };
  if (/^shelf_(?:row_[23]_(?:100|150|200)|(?:100|150|200)_self)$/.test(itemKey)) {
    const width = itemKey.match(/(?:100|150|200)/)[0];
    return { catalogVisible: false, categoryId: 3, catalogItemIndex: shelfIndexes[`shelf_${width}`] };
  }
  for (const group of EXPECTED_CATALOG_GROUPS) {
    const index = group.keys.indexOf(itemKey);
    if (index === -1) continue;
    return {
      catalogVisible: true,
      categoryId: CATALOG_CATEGORY_IDS_BY_LABEL[group.label],
      catalogItemIndex: index + 1,
    };
  }
  return {
    catalogVisible: false,
    categoryId: null,
    catalogItemIndex: null,
  };
}

test('mevcut katalog Item listesi ve grup sırası değişmemiştir', () => {
  assert.deepEqual([...listCatalogItems().map((item) => item.itemKey)], [...EXPECTED_CATALOG_KEYS]);
  assert.equal(listCatalogItems().length, EXPECTED_CATALOG_KEYS.length);
  assert.deepEqual(
    listCatalogGroups().map((group) => ({ label: group.label, keys: [...group.keys] })),
    EXPECTED_CATALOG_GROUPS.map((group) => ({ label: group.label, keys: [...group.keys] })),
  );

  EXPECTED_CATALOG_GROUPS.forEach((group) => {
    const groupSet = new Set(group.keys);
    const uiOrder = listCatalogItems().map((item) => item.itemKey).filter((itemKey) => groupSet.has(itemKey));
    assert.deepEqual(uiOrder, [...group.keys], group.label);
  });
});

test('106 Item katalog metadata alanlarını taşır ve canlı katalog üyeliğiyle birebir örtüşür', () => {
  const items = listRegisteredItems();
  assert.equal(items.length, 131);

  let visibleCount = 0;
  let missingVisible = 0;
  let missingCategory = 0;
  let missingIndex = 0;
  let visibleNullCategory = 0;
  let visibleNullIndex = 0;
  let hiddenNonNullCategory = 0;
  let hiddenNonNullIndex = 0;
  const byCategory = new Map();

  for (const item of items) {
    if (!Object.hasOwn(item, 'catalogVisible')) missingVisible += 1;
    if (!Object.hasOwn(item, 'categoryId')) missingCategory += 1;
    if (!Object.hasOwn(item, 'catalogItemIndex')) missingIndex += 1;

    const expected = expectedFieldsForItemKey(item.itemKey);
    assert.equal(item.catalogVisible, expected.catalogVisible, item.itemKey);
    assert.equal(item.categoryId, expected.categoryId, item.itemKey);
    assert.equal(item.catalogItemIndex, expected.catalogItemIndex, item.itemKey);
    assert.deepEqual(getItem(item.itemKey), item, item.itemKey);

    if (item.catalogVisible === true) {
      visibleCount += 1;
      if (item.categoryId == null) visibleNullCategory += 1;
      if (item.catalogItemIndex == null) visibleNullIndex += 1;
      const rows = byCategory.get(item.categoryId) ?? [];
      rows.push(item);
      byCategory.set(item.categoryId, rows);
    } else {
      if (item.categoryId != null) hiddenNonNullCategory += 1;
      if (item.catalogItemIndex != null) hiddenNonNullIndex += 1;
    }
  }

  assert.equal(missingVisible, 0);
  assert.equal(missingCategory, 0);
  assert.equal(missingIndex, 0);
  assert.equal(visibleCount, EXPECTED_CATALOG_KEYS.length);
  assert.equal(visibleNullCategory, 0);
  assert.equal(visibleNullIndex, 0);
  assert.equal(hiddenNonNullCategory, 12);
  assert.equal(hiddenNonNullIndex, 12);

  let duplicateIndex = 0;
  let gapIndex = 0;
  for (const group of EXPECTED_CATALOG_GROUPS) {
    const categoryId = CATALOG_CATEGORY_IDS_BY_LABEL[group.label];
    const rows = byCategory.get(categoryId) ?? [];
    assert.equal(rows.length, group.keys.length, categoryId);
    const indexes = rows.map((item) => item.catalogItemIndex).sort((a, b) => a - b);
    if (new Set(indexes).size !== indexes.length) duplicateIndex += 1;
    const expectedIndexes = group.keys.map((_, index) => index + 1);
    if (JSON.stringify(indexes) !== JSON.stringify(expectedIndexes)) gapIndex += 1;
    const orderedKeys = [...rows]
      .sort((a, b) => a.catalogItemIndex - b.catalogItemIndex)
      .map((item) => item.itemKey);
    assert.deepEqual(orderedKeys, [...group.keys], categoryId);
  }
  assert.equal(duplicateIndex, 0);
  assert.equal(gapIndex, 0);

  assert.equal(getItem('wall_200_350').catalogVisible, true);
  assert.equal(getItem('wall_200_350').categoryId, 1);
  assert.equal(getItem('wall_200_350').catalogItemIndex, 1);
  assert.equal(getItem('wall_200_350').previewId, 9);
  assert.equal(getItem('panel_197').catalogVisible, false);
  assert.equal(getItem('panel_197').categoryId, null);
  assert.equal(getItem('panel_197').catalogItemIndex, null);
});

test('profil sceneDimensions Catalog kart genişliğini taşır; catalogWidthCm yoktur', () => {
  const expected = Object.freeze({
    profile_41_5: 50,
    profile_91: 100,
    profile_140_5: 150,
    profile_190: 200,
    profile_239_5: 250,
    profile_289: 300,
    profile_388: 400,
    profile_487: 500,
  });

  for (const item of listRegisteredItems()) {
    assert.equal(Object.hasOwn(item, 'catalogWidthCm'), false, item.itemKey);
    if (!Object.hasOwn(expected, item.itemKey)) continue;
    assert.equal(item.sceneDimensions.widthCm, expected[item.itemKey], item.itemKey);
    assert.notEqual(item.sceneDimensions.widthCm, item.dimensions.widthCm, item.itemKey);
  }
});

test('katalog UI listCatalogGroups üzerinden catalogName ve catalogIndex kullanır', () => {
  const sidebar = readFileSync(new URL('../src/moduleDragSidebar.js', import.meta.url), 'utf8');
  const contextMenu = readFileSync(new URL('../src/moduleContextMenu.js', import.meta.url), 'utf8');

  assert.match(sidebar, /listCatalogGroups/);
  assert.match(contextMenu, /listCatalogGroups/);
  assert.match(sidebar, /getCatalogItem/);
  assert.match(contextMenu, /getCatalogItem/);
  assert.match(sidebar, /catalogName/);
  assert.match(contextMenu, /catalogName/);
  assert.doesNotMatch(sidebar, /MODULE_CATALOG_GROUPS/);
  assert.doesNotMatch(contextMenu, /MODULE_CATALOG_GROUPS/);
  assert.doesNotMatch(sidebar, /MODULE_CATALOG\[/);
  assert.doesNotMatch(contextMenu, /MODULE_CATALOG\[/);
  const fixture = readFileSync(new URL('./fixtures/itemCatalogSeed.json', import.meta.url), 'utf8');
  assert.match(fixture, /"catalog_visible":\s*true/);
  assert.match(fixture, /"category_index":\s*1/);

  for (const itemKey of listCatalogItems().map((item) => item.itemKey)) {
    assert.equal(Object.hasOwn(getCatalogItem(itemKey), 'catalogVisible'), false, itemKey);
    assert.equal(Object.hasOwn(getCatalogItem(itemKey), 'categoryId'), false, itemKey);
    assert.equal(Object.hasOwn(getCatalogItem(itemKey), 'catalogItemIndex'), false, itemKey);
    assert.equal(typeof getCatalogItem(itemKey).previewId, 'number', itemKey);
  }
});

test('CATALOG.md category id tablosu canlı kategorilerle örtüşür', () => {
  const catalogDoc = readFileSync(new URL('../docs/refactor/CATALOG.md', import.meta.url), 'utf8');

  assert.match(catalogDoc, /# Catalog/);
  assert.match(catalogDoc, /listCatalogGroups/);
  assert.match(catalogDoc, /listCatalogCategories/);
  assert.match(catalogDoc, /listCatalogItems/);
  assert.match(catalogDoc, /getCatalogItem/);

  EXPECTED_CATALOG_GROUPS.forEach((group, index) => {
    const categoryId = CATALOG_CATEGORY_IDS_BY_LABEL[group.label];
    const row = new RegExp(
      `\\| ${categoryId} \\| ${group.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\| ${index + 1} \\| ${group.keys.length} \\|`,
    );
    assert.match(catalogDoc, row, String(categoryId));
    assert.equal(getItem(group.keys[0]).categoryId, categoryId, group.keys[0]);
  });
});

test('ITEMS.md yalnız onaylı katalog şemasını taşır; gerçekleşmemiş method yazmaz', () => {
  const itemsDoc = readFileSync(new URL('../docs/refactor/ITEMS.md', import.meta.url), 'utf8');

  assert.match(itemsDoc, /# Item/);
  assert.match(itemsDoc, /### catalogVisible/);
  assert.match(itemsDoc, /### categoryId/);
  assert.match(itemsDoc, /### catalogItemIndex/);
  assert.match(itemsDoc, /### isRender/);
  assert.match(itemsDoc, /### defaultZCm/);
  assert.match(itemsDoc, /### dimensions/);
  assert.match(itemsDoc, /### sceneDimensions/);
  assert.match(itemsDoc, /# Canonical Mechanism Connections/);
  assert.match(itemsDoc, /# Item Schema/);
  assert.match(itemsDoc, /# Architectural Rules/);
  assert.match(itemsDoc, /listCatalogCategories/);
  assert.match(itemsDoc, /listCatalogGroups/);
  assert.match(itemsDoc, /listCatalogItems/);
  assert.match(itemsDoc, /getCatalogItem/);
});
