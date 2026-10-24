import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getCatalogCategory,
  listCatalogCategories,
  listCatalogGroups,
  getCatalogItem,
  listCatalogItems,
} from '../src/catalog.js';
import { getItem, listRegisteredItems } from '../src/items.js';

const EXPECTED_CATEGORIES = Object.freeze([
  Object.freeze({ id: 1, catalogName: 'Panel & Duvar', catalogIndex: 1, itemCount: 4 }),
  Object.freeze({ id: 2, catalogName: 'Panel Ek Modül', catalogIndex: 2, itemCount: 5 }),
  Object.freeze({ id: 3, catalogName: 'Raf & Vitrin', catalogIndex: 3, itemCount: 1 }),
  Object.freeze({ id: 4, catalogName: 'Banko & Baza', catalogIndex: 4, itemCount: 4 }),
  Object.freeze({ id: 5, catalogName: 'Extra', catalogIndex: 5, itemCount: 17 }),
  Object.freeze({ id: 6, catalogName: 'Elektronik & Aydınlatma', catalogIndex: 6, itemCount: 4 }),
]);

const EXPECTED_GROUP_KEYS = Object.freeze({
  1: Object.freeze([
    'wall_100_350', 'wall_separator_100_350',
    'wall_door_100_350', 'wall_showcase_100_3_350',
  ]),
  2: Object.freeze([
    'wall_100_short_2', 'wall_100_short_1',
    'upright_346_5', 'profile_289', 'box_block',
  ]),
  // 0086: Vitrin Panel & Duvar'a, Ayaklı Vitrin Banko & Baza'ya taşındı; Raf tek kart.
  3: Object.freeze([
    'shelf_row_1',
  ]),
  4: Object.freeze([
    'desk_banko_100', 'desk_banko_100_l', 'base_100', 'floor_showcase_100',
  ]),
  5: Object.freeze([
    'furniture_sofa_set_classic', 'furniture_sofa_single_classic', 'furniture_sofa_double_classic',
    'furniture_coffee_table_classic', 'furniture_table_chair_set_eames', 'chair_eames',
    'glass_table', 'furniture_bar_stool_classic', 'mini_fridge_avanti', 'kettle',
    'coat_rack', 'plastic_trash_bin', 'extra_indoor_plant_1',
    'extra_long_planter_100', 'tulle_fabric', 'brochure_stand', 'glass_bar_table',
  ]),
  6: Object.freeze([
    'tv_42', 'video_wall_2x2', 'led_floodlight', 'illuminated-foam',
  ]),
});

test('Catalog kategorileri id/name/index taşır; sıra 1..N kesintisiz ve benzersizdir', () => {
  const categories = listCatalogCategories();
  assert.equal(categories.length, EXPECTED_CATEGORIES.length);

  const ids = categories.map((category) => category.id);
  const names = categories.map((category) => category.catalogName);
  const indexes = categories.map((category) => category.catalogIndex);

  assert.equal(new Set(ids).size, ids.length);
  assert.equal(names.filter((name) => !name).length, 0);
  assert.equal(indexes.filter((index) => index == null).length, 0);
  assert.equal(new Set(indexes).size, indexes.length);
  assert.deepEqual(indexes, EXPECTED_CATEGORIES.map((_, index) => index + 1));

  EXPECTED_CATEGORIES.forEach((expected, index) => {
    const category = categories[index];
    assert.equal(category.id, expected.id);
    assert.equal(category.catalogName, expected.catalogName);
    assert.equal(category.catalogIndex, expected.catalogIndex);
    assert.deepEqual(getCatalogCategory(expected.id), categories[index]);
  });
});

test('görünür Item categoryId değerleri geçerli category id ile eşleşir', () => {
  const categoryIds = new Set(listCatalogCategories().map((category) => category.id));
  let invalidVisible = 0;
  let invalidHidden = 0;
  let visibleCount = 0;

  for (const item of listRegisteredItems()) {
    if (item.catalogVisible === true) {
      visibleCount += 1;
      if (!categoryIds.has(item.categoryId)) invalidVisible += 1;
      if (item.catalogItemIndex == null) invalidVisible += 1;
    } else if (item.categoryId != null && !categoryIds.has(item.categoryId)) {
      invalidHidden += 1;
    }
  }

  assert.equal(visibleCount, listCatalogItems().map((item) => item.itemKey).length);
  assert.equal(invalidVisible, 0);
  assert.equal(invalidHidden, 0);
  assert.equal(getItem('wall_100_350').categoryId, 1);
  assert.equal(getItem('panel_197').categoryId, null);
});

test('listCatalogGroups kategori sırası, adı ve Item sırasını korur', () => {
  const groups = listCatalogGroups();
  assert.equal(groups.length, EXPECTED_CATEGORIES.length);
  assert.deepEqual(
    listCatalogGroups().map((group) => ({
      id: group.id,
      catalogName: group.catalogName,
      catalogIndex: group.catalogIndex,
      keys: [...group.keys],
    })),
    groups.map((group) => ({
      id: group.id,
      catalogName: group.catalogName,
      catalogIndex: group.catalogIndex,
      keys: [...group.keys],
    })),
  );

  let visibleTotal = 0;
  groups.forEach((group, index) => {
    const expected = EXPECTED_CATEGORIES[index];
    assert.equal(group.id, expected.id);
    assert.equal(group.catalogName, expected.catalogName);
    assert.equal(group.catalogIndex, expected.catalogIndex);
    assert.equal(group.label, expected.catalogName);
    assert.equal(group.keys.length, expected.itemCount);
    assert.deepEqual([...group.keys], [...EXPECTED_GROUP_KEYS[expected.id]]);
    visibleTotal += group.keys.length;
    group.keys.forEach((itemKey, itemIndex) => {
      const item = getItem(itemKey);
      assert.equal(item.catalogVisible, true, itemKey);
      assert.equal(item.categoryId, group.id, itemKey);
      assert.equal(item.catalogItemIndex, itemIndex + 1, itemKey);
      assert.ok(getCatalogItem(itemKey), itemKey);
    });
  });

  assert.equal(visibleTotal, 35);
  assert.equal(listCatalogItems().map((item) => item.itemKey).length, 35);
  assert.deepEqual([...listCatalogItems().map((item) => item.itemKey)], groups.flatMap((group) => group.keys));
});
