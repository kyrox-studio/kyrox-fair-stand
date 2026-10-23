import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { getCatalogItem } from '../src/catalog.js';
import { createModuleStateFromCatalogKey, createProfileModuleState, normalizeModuleItemState } from '../src/designState.js';
import { resolveItemBom } from '../src/itemBom.js';
import { getItem } from '../src/items.js';
import {
  PROFILE_LENGTH_PREFERENCE_KEY,
  formatProfileLengthLabel,
  listProfileLengthItems,
  readProfileLengthPreference,
  writeProfileLengthPreference,
} from '../src/profileLength.js';

// Gerçek boy (BOM) → sahne boyu.
const PROFILE_LENGTHS = Object.freeze([
  ['profile_41_5', 41.5, 50],
  ['profile_91', 91, 100],
  ['profile_140_5', 140.5, 150],
  ['profile_190', 190, 200],
  ['profile_239_5', 239.5, 250],
  ['profile_289', 289, 300],
  ['profile_346_5', 346.5, 350],
  ['profile_388', 388, 400],
  ['profile_487', 487, 500],
]);

test('profil boy penceresi 9 çizilebilir profili sahne boyuna göre sıralar', () => {
  const items = listProfileLengthItems();
  assert.deepEqual(items.map((item) => item.itemKey), PROFILE_LENGTHS.map(([itemKey]) => itemKey));
  for (const [itemKey, realCm, sceneCm] of PROFILE_LENGTHS) {
    const item = getItem(itemKey);
    assert.equal(item.type, 'profile', itemKey);
    // Gizli boylar da sahnede çizilir (is_render).
    assert.notEqual(item.isRender, false, itemKey);
    assert.equal(item.dimensions.widthCm, realCm, itemKey);
    assert.equal(item.sceneDimensions.widthCm, sceneCm, itemKey);
  }
  assert.equal(formatProfileLengthLabel(getItem('profile_41_5')), '41,5 cm (sahnede 50 cm)');
  assert.equal(formatProfileLengthLabel(getItem('profile_487')), '487 cm (sahnede 500 cm)');
});

test('katalogda tek profil kartı profile_289; diğer boylar gizli', () => {
  assert.equal(getCatalogItem('profile_289').itemKey, 'profile_289');
  for (const [itemKey] of PROFILE_LENGTHS) {
    if (itemKey === 'profile_289') continue;
    assert.equal(getCatalogItem(itemKey), null, itemKey);
  }
});

test('seçilen boy modülü o Item ile kurar; BOM gerçek boyun Item’ı ×1 adet', () => {
  const card = createModuleStateFromCatalogKey('profile_289');
  assert.equal(card.type, 'profile');
  for (const [itemKey, , sceneCm] of PROFILE_LENGTHS) {
    const profile = createProfileModuleState({ itemKey });
    assert.equal(profile.itemKey, itemKey);
    assert.equal(profile.widthCm, sceneCm, itemKey);
    const bom = resolveItemBom(itemKey);
    assert.deepEqual(bom.map((line) => [line.itemKey, line.quantity, line.unit]), [[itemKey, 1, 'adet']], itemKey);
  }
});

test('eski profile_289_scene anahtarı proje açılırken profile_289 olur', () => {
  const legacy = normalizeModuleItemState({ id: 'p1', type: 'profile', itemKey: 'profile_289_scene', widthCm: 300 });
  assert.equal(legacy.itemKey, 'profile_289');
  assert.equal(legacy.widthCm, 300);
});

test('"Bir daha sorma" tercihi yalnız profil Item’ı kabul eder', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  assert.equal(readProfileLengthPreference(storage), null);
  writeProfileLengthPreference('profile_388', storage);
  assert.equal(values.get(PROFILE_LENGTH_PREFERENCE_KEY), 'profile_388');
  assert.equal(readProfileLengthPreference(storage), 'profile_388');
  values.set(PROFILE_LENGTH_PREFERENCE_KEY, 'upright_346_5');
  assert.equal(readProfileLengthPreference(storage), null);
  writeProfileLengthPreference(null, storage);
  assert.equal(values.has(PROFILE_LENGTH_PREFERENCE_KEY), false);
  const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(readProfileLengthPreference(throwing), null);
  assert.doesNotThrow(() => writeProfileLengthPreference('profile_91', throwing));
});

test('profil bırakılırken boy sorulur; sağ tık "Profil boyu…" aynı pencereyi açar', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const menu = readFileSync(new URL('../src/moduleContextMenu.js', import.meta.url), 'utf8');
  assert.match(main, /if \(moduleState\?\.type === 'profile'\) \{[\s\S]*readProfileLengthPreference\(\)[\s\S]*requestProfileLength\(\{ selectedItemKey: moduleState\.itemKey \}\)[\s\S]*if \(choice\.remember\) writeProfileLengthPreference\(itemKey\);/);
  assert.match(main, /const commitKey = moduleState\?\.type === 'upright' \|\| moduleState\?\.type === 'profile'\s+\|\| isWallShortFamilyDescriptor\(moduleState\) \? moduleState\.itemKey : catalogKey;/);
  assert.match(main, /writeProfileLengthPreference\(choice\.remember \? choice\.itemKey : null\);/);
  assert.match(menu, /data-module-action="profile-length" hidden>Profil boyu…<\/button>/);
  assert.match(menu, /profileLengthButton\.hidden = \(getProfileLengthState\?\.\(context\) \?\? null\) == null;/);
});
