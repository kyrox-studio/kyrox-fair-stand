import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getActiveWallLineHeightCm,
  itemMovesVertically,
  resolveItemDefaultZCm,
  setActiveWallLineHeightCm,
} from '../src/items.js';
import {
  UPRIGHT_HEIGHT_PREFERENCE_KEY,
  defaultUprightItemKeyForWallHeight,
  listUprightHeightItems,
  readUprightHeightPreference,
  writeUprightHeightPreference,
} from '../src/uprightHeight.js';

const scene = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const menu = readFileSync(new URL('../src/moduleContextMenu.js', import.meta.url), 'utf8');

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test('dikey hareket Item ayarıdır (DB vertical_move)', () => {
  for (const itemKey of ['tv_42', 'tulle_fabric', 'box_block', 'led_floodlight', 'profile_190', 'wall_100_short_2']) {
    assert.equal(itemMovesVertically(itemKey), true, itemKey);
  }
  for (const itemKey of ['wall_100_350', 'desk_banko_100', 'upright_346_5', 'glass_table']) {
    assert.equal(itemMovesVertically(itemKey), false, itemKey);
  }
  assert.equal(itemMovesVertically({ itemKey: 'profile_190', type: 'profile' }), true);
});

test('profil ve kısa duvar duvar tepesine göre gelir (z_reference wall-top)', () => {
  const previous = getActiveWallLineHeightCm();
  try {
    setActiveWallLineHeightCm(350);
    const profileAt350 = resolveItemDefaultZCm('profile_190');
    const tvAt350 = resolveItemDefaultZCm('tv_42');
    assert.equal(resolveItemDefaultZCm('wall_100_short_2'), 250);
    setActiveWallLineHeightCm(250);
    // wall-top: duvar 100 cm alçalınca 100 cm iner; floor (TV) yerinde kalır.
    assert.equal(resolveItemDefaultZCm('profile_190'), profileAt350 - 100);
    assert.equal(resolveItemDefaultZCm('wall_100_short_2'), 150);
    assert.equal(resolveItemDefaultZCm('tv_42'), tvAt350);
  } finally {
    setActiveWallLineHeightCm(previous);
  }
});

test('dikme boyu: varsayılan seçili duvarın dikmesi; liste sistemdeki boylar', () => {
  const heights = listUprightHeightItems().map((item) => Number(item.dimensions.heightCm));
  assert.deepEqual(heights, [...heights].sort((a, b) => a - b));
  assert.ok(heights.includes(346.5));
  assert.ok(listUprightHeightItems().every((item) => item.isRender !== false));
  assert.equal(defaultUprightItemKeyForWallHeight(350), 'upright_346_5');
  const at250 = defaultUprightItemKeyForWallHeight(250);
  assert.ok(at250 == null || at250.startsWith('upright_'));
});

test('"Bir daha sorma" tercihi: yazılır, okunur, kaldırılınca yine sorulur; bozuk değer yok sayılır', () => {
  const storage = memoryStorage();
  assert.equal(readUprightHeightPreference(storage), null);
  writeUprightHeightPreference('upright_346_5', storage);
  assert.equal(storage.getItem(UPRIGHT_HEIGHT_PREFERENCE_KEY), 'upright_346_5');
  assert.equal(readUprightHeightPreference(storage), 'upright_346_5');
  writeUprightHeightPreference(null, storage);
  assert.equal(readUprightHeightPreference(storage), null);
  storage.setItem(UPRIGHT_HEIGHT_PREFERENCE_KEY, 'wall_100_350');
  assert.equal(readUprightHeightPreference(storage), null);
  const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() {} };
  assert.equal(readUprightHeightPreference(throwing), null);
  assert.doesNotThrow(() => writeUprightHeightPreference('upright_346_5', throwing));
});

test('dikme bırakılırken boy sorulur; Özellikler panelinde dikme yüksekliği alanı boyu ve tercihi değiştirir', () => {
  assert.match(main, /if \(moduleState\?\.type === 'upright'\) \{[\s\S]*readUprightHeightPreference\(\)[\s\S]*defaultUprightItemKeyForWallHeight\(getActiveWallLineHeightCm\(\)\)[\s\S]*if \(choice\.remember\) writeUprightHeightPreference\(itemKey\);/);
  assert.match(main, /upright: Object\.freeze\(\{\r?\n {4}title: 'Dikme yüksekliği',\r?\n {4}list: \(\) => listUprightHeightItems\(\),/);
  assert.match(main, /choiceSpec\.writePreference\(values\.remember \? values\.itemKey : null\);/);
  assert.doesNotMatch(menu, /data-module-action="upright-height"/);
});

test('ok tuşlarında dikey adaylar yalnız vertical_move açık öğede; profil kısa duvar yolunu kullanır', () => {
  assert.match(scene, /const canMoveVertically = itemMovesVertically\(moduleState\);/);
  assert.equal((scene.match(/\.filter\(verticalAllowed\)/g) ?? []).length, 5);
  assert.match(scene, /if \(moduleState\.type === 'tulle-fabric' && canMoveVertically\) \{/);
  assert.match(scene, /if \(canMoveVertically && getModuleBehavior\(moduleState\)\.placement === 'wall'\) \{/);
});

test('ölçü etiketleri sahne ölçüsünden; dikey öğede zemin ve tavan uzaklığı', () => {
  const size = scene.slice(scene.indexOf('function sceneSizeCm('), scene.indexOf('function formatSceneCm('));
  assert.match(size, /const widthCm = Number\(moduleState\?\.widthCm\);/);
  assert.match(size, /const alongX = vertical \? depthCm : widthCm;/);
  const floorCeiling = scene.slice(scene.indexOf('function measureFloorCeiling('), scene.indexOf('function measureStandDistances('));
  assert.match(floorCeiling, /const ceilingY = floorY \+ getActiveWallLineHeightCm\(\) \/ 100;/);
  assert.match(scene, /if \(signature && vertical\) measureFloorCeiling\(box\);/);
  assert.match(scene, /placementGhost\.moduleState = moduleOrWidthCm && typeof moduleOrWidthCm === 'object' \? moduleOrWidthCm : null;/);
});
