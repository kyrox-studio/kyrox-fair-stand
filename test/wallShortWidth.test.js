import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { resolveFasciaPanelItemKey } from '../src/autoFascia.js';
import { getCatalogItem, getModuleCatalogLabel } from '../src/catalog.js';
import { createModuleStateFromCatalogKey } from '../src/designState.js';
import { getItem, isWallShortFamilyDescriptor, listRegisteredItems } from '../src/items.js';
import { formatWallShortWidthLabel, listWallShortWidthItems } from '../src/wallShortWidth.js';

const WIDTHS = Object.freeze([50, 100, 150, 200]);
const CARDS = Object.freeze({
  'wall-short-1': ['wall_100_short_1', 'Panel Tek Sıra 100'],
  'wall-short-2': ['wall_100_short_2', 'Panel Çift Sıra 100'],
});

test('genişlik penceresi kartın varyantındaki 4 paneli genişliğe göre sıralar', () => {
  for (const variant of Object.keys(CARDS)) {
    const suffix = variant.slice(-1);
    const items = listWallShortWidthItems(variant);
    assert.deepEqual(items.map((item) => item.itemKey), WIDTHS.map((width) => `wall_${width}_short_${suffix}`));
    for (const item of items) {
      assert.equal(item.type, 'flat-panel', item.itemKey);
      assert.equal(item.variant, variant, item.itemKey);
      // Gizli genişlikler de sahnede çizilir (is_render).
      assert.notEqual(item.isRender, false, item.itemKey);
    }
  }
  // Tam boy paneller (aynı flat-panel türü) seçeneklere karışmaz.
  assert.deepEqual(listWallShortWidthItems(undefined), []);
  assert.deepEqual(listWallShortWidthItems('wall'), []);
  assert.equal(formatWallShortWidthLabel(getItem('wall_150_short_1')), '150 cm');
});

test('katalogda varyant başına tek kısa panel kartı; diğer genişlikler gizli', () => {
  for (const [variant, [cardKey, cardName]] of Object.entries(CARDS)) {
    const card = getCatalogItem(cardKey);
    assert.equal(card.itemKey, cardKey);
    assert.equal(card.label, cardName);
    for (const item of listWallShortWidthItems(variant)) {
      if (item.itemKey === cardKey) continue;
      assert.equal(getCatalogItem(item.itemKey), null, item.itemKey);
    }
  }
});

test('gizli genişlik modülü kendi Item’ıyla kurulur; otomatik alınlık genişliği bulur', () => {
  for (const [variant, [cardKey]] of Object.entries(CARDS)) {
    const card = createModuleStateFromCatalogKey(cardKey);
    assert.equal(card.widthCm, 100);
    for (const item of listWallShortWidthItems(variant)) {
      const state = createModuleStateFromCatalogKey(item.itemKey);
      assert.equal(state.itemKey, item.itemKey);
      assert.equal(state.widthCm, item.dimensions.widthCm, item.itemKey);
      assert.equal(isWallShortFamilyDescriptor(state), true, item.itemKey);
    }
  }
  for (const width of WIDTHS) {
    assert.equal(resolveFasciaPanelItemKey(width, 1), `wall_${width}_short_1`);
    assert.equal(resolveFasciaPanelItemKey(width, 2), `wall_${width}_short_2`);
  }
});

test('sağ tık başlığı sahnedeki öğenin kendi adını yazar (gizli genişlik "Modül" değil)', () => {
  for (const [, [cardKey, cardName]] of Object.entries(CARDS)) {
    assert.equal(getModuleCatalogLabel(createModuleStateFromCatalogKey(cardKey)), cardName);
  }
  assert.equal(getModuleCatalogLabel(createModuleStateFromCatalogKey('wall_200_short_1')), 'Panel Tek Sıra 200');
  assert.equal(getModuleCatalogLabel(createModuleStateFromCatalogKey('wall_50_short_2')), 'Panel Çift Sıra 50');
  // Profilde de aynı: boy penceresinden gelen gizli boy.
  assert.equal(getModuleCatalogLabel({ type: 'profile', itemKey: 'profile_388' }), 'Profil 388');
  // Dikmede de aynı: boy penceresinden gelen gizli yükseklikler.
  const hiddenUprights = listRegisteredItems().filter((item) => item.type === 'upright' && item.catalogVisible !== true);
  assert.ok(hiddenUprights.length > 0);
  for (const item of hiddenUprights) {
    assert.equal(getModuleCatalogLabel({ type: 'upright', itemKey: item.itemKey }), item.name, item.itemKey);
  }
});

test('kısa panel bırakılırken genişlik konum hesabından önce sorulur ve seçilen anahtarla kaydedilir', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const source = readFileSync(new URL('../src/wallShortWidth.js', import.meta.url), 'utf8');
  const choiceIndex = main.indexOf('const choice = await requestWallShortWidth({ selectedItemKey: moduleState.itemKey });');
  const dropIndex = main.indexOf('const result = scene3d.dropCatalogModuleDrag(', Math.max(choiceIndex, 0));
  assert.ok(choiceIndex > 0, 'genişlik penceresi bırakma akışında açılmalı');
  assert.ok(choiceIndex < dropIndex, 'genişlik konum hesabından önce seçilmeli');
  assert.match(main, /moduleState = createCatalogModuleState\(\{ itemKey: choice\.itemKey \}, \{ itemKey: choice\.itemKey \}\);/);
  assert.match(main, /\|\| isWallShortFamilyDescriptor\(moduleState\) \? moduleState\.itemKey : catalogKey;/);
  // Sağ tık menüsü yok; tercih tutulmaz, her bırakışta sorulur.
  assert.match(source, /allowRemember: false/);
  assert.doesNotMatch(readFileSync(new URL('../src/moduleContextMenu.js', import.meta.url), 'utf8'), /Panel genişliği/);
});

test('ölçü ailesinde ad sahnedeki öğenin ölçüsünü yazar: Panel Tek/Çift Sıra W, Profil / Dikme gerçek boy', () => {
  for (const rows of [1, 2]) {
    for (const width of WIDTHS) {
      assert.equal(getItem(`wall_${width}_short_${rows}`).name, `Panel ${rows === 1 ? 'Tek' : 'Çift'} Sıra ${width}`);
    }
  }
  const format = (cm) => String(cm).replace('.', ',');
  for (const item of listRegisteredItems().filter((entry) => entry.type === 'profile' || entry.type === 'upright')) {
    const prefix = item.type === 'profile' ? 'Profil' : 'Dikme';
    assert.equal(item.name, `${prefix} ${format(item.type === 'profile' ? item.dimensions.widthCm : item.dimensions.heightCm)}`, item.itemKey);
  }
});
