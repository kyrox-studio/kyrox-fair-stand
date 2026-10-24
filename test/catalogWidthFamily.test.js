import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { getCatalogItem, getModuleCatalogLabel } from '../src/catalog.js';
import {
  describeModuleVariants,
  isCatalogWidthFamilyDescriptor,
  listCatalogWidthFamilyItems,
  resolveCatalogWidthChoice,
  resolveModuleVariantItemKey,
} from '../src/catalogWidthFamily.js';
import { createModuleStateFromCatalogKey } from '../src/designState.js';
import { getItem, isWallShortFamilyDescriptor, resolveWallItemKeyForHeight } from '../src/items.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('Panel ailesi: dört genişlik, katalogda tek "Panel" kartı', () => {
  const items = listCatalogWidthFamilyItems('wall-panel');
  assert.deepEqual(items.map((item) => item.itemKey), ['wall_50_350', 'wall_100_350', 'wall_150_350', 'wall_200_350']);
  assert.equal(getCatalogItem('wall_100_350').label, 'Panel');
  for (const key of ['wall_50_350', 'wall_150_350', 'wall_200_350']) {
    assert.equal(getCatalogItem(key), null, key);
    // Gizli genişlik sahnede kendi Item adıyla kurulur.
    assert.equal(getModuleCatalogLabel(createModuleStateFromCatalogKey(key)), getItem(key).name);
  }
  // Panel ailesi kısa panel davranışına (profil/yan panel bağlantısı) karışmaz.
  assert.equal(isWallShortFamilyDescriptor(getItem('wall_100_350')), false);
  assert.equal(isCatalogWidthFamilyDescriptor(getItem('wall_100_350')), true);
  // Duvar yüksekliği türevi aileyi taşır.
  assert.equal(isCatalogWidthFamilyDescriptor({ itemKey: resolveWallItemKeyForHeight('wall_150_350', 250) }), true);
});

test('Separatör ailesi: 50 / 100, katalogda tek "Separatör" kartı; Sarmaşıklı çentiği eş Item\'ı seçer', () => {
  assert.deepEqual(
    listCatalogWidthFamilyItems('wall-separator').map((item) => item.itemKey),
    ['wall_separator_50_350', 'wall_separator_100_350'],
  );
  assert.equal(getCatalogItem('wall_separator_100_350').label, 'Separatör');
  for (const key of ['wall_separator_50_350', 'wall_separator_50_350_sarmasik', 'wall_separator_100_350_sarmasik']) {
    assert.equal(getCatalogItem(key), null, key);
  }
  assert.equal(resolveCatalogWidthChoice('wall-separator', 'wall_separator_50_350', false), 'wall_separator_50_350');
  assert.equal(resolveCatalogWidthChoice('wall-separator', 'wall_separator_50_350', true), 'wall_separator_50_350_sarmasik');
  assert.equal(resolveCatalogWidthChoice('wall-separator', 'wall_separator_100_350', true), 'wall_separator_100_350_sarmasik');
  // Aile dışı Item reddedilir; çentiği olmayan ailede çentik yok sayılır.
  assert.equal(resolveCatalogWidthChoice('wall-separator', 'wall_100_350', false), null);
  assert.equal(resolveCatalogWidthChoice('wall-panel', 'wall_150_350', true), 'wall_150_350');
  assert.equal(isCatalogWidthFamilyDescriptor(getItem('wall_separator_50_350_sarmasik')), true);
});

test('katalog penceresi: solda sekme, tekli seçim, sağ tıkta tek "Ekle…"', () => {
  const source = read('../src/moduleContextMenu.js');
  assert.match(source, /class="module-picker-tabs" role="tablist"/);
  assert.match(source, /data-module-action="add">Ekle…</);
  assert.doesNotMatch(source, /Seçim sırası|add-right|add-left|<details|selectedModuleKeys/);
  assert.match(source, /openPicker\(\{ placement: 'auto', context \}\)/);
});

test('Ekle yerleşimi: duvar üstü öğe modülün üstüne; diğerleri sağ → sol → önü → müsait yer', () => {
  const main = read('../src/main.js');
  const near = main.slice(main.indexOf('function placeCatalogModuleNearContext('));
  const order = [
    'isWallOverlayModule(moduleState) || isTopPlacementModule(moduleState)',
    'scene3d.placeCatalogModuleOnModule(',
    "for (const side of ['right', 'left'])",
    'scene3d.planCatalogModuleInFrontOf(',
    'scene3d.findFreeCatalogPlacement(moduleState, context.moduleId)',
  ].map((needle) => near.indexOf(needle));
  assert.ok(order.every((index) => index >= 0), order.join(','));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  // Varyant ailesinde Ekle ve bırakma pencere açmaz; kartın kendisi konur, varyant panelde seçilir.
  const add = main.slice(main.indexOf('async function addCatalogModule('), main.indexOf('function getContextShelfLightingState('));
  assert.doesNotMatch(add, /requestCatalogWidth|requestItemSizeChoice/);
  assert.doesNotMatch(main, /requestCatalogWidth/);
});

test('kopyalamada sağ altta "… hafızaya alındı" bildirimi', () => {
  const main = read('../src/main.js');
  const copy = main.slice(main.indexOf('function copyContextModule('), main.indexOf('function onCopyPasteKeyDown('));
  assert.match(copy, /showToast\(`\$\{getModuleCatalogLabel\(copiedModule\)\} hafızaya alındı`, \{ kind: 'info' \}\)/);
});

test('Ekle sonrası eklenen öğe seçilir; görünüm dışındaysa kamera döndürülmeden kaydırılır', () => {
  const main = read('../src/main.js');
  const add = main.slice(main.indexOf('async function addCatalogModule('));
  assert.match(add, /scene3d\.revealAddedModule\(result\.moduleState\?\.id \?\? moduleState\.id\);/);
  const scene = read('../src/scene3d.js');
  const reveal = scene.slice(scene.indexOf('function revealAddedModule('), scene.indexOf('function planMovesOtherModules('));
  assert.match(reveal, /selectModulesById\(\[moduleId\]\)/);
  assert.match(reveal, /controls\.target\.add\(delta\);\s+camera\.position\.add\(delta\);/);
  assert.doesNotMatch(reveal, /rotation|setViewDirection|lookAt/);
});

test('duvar üstü öğe uygun olmayan modüle konmaz; başka yere düşmez, sebep yazılır', () => {
  const scene = read('../src/scene3d.js');
  const place = scene.slice(scene.indexOf('function placeCatalogModuleOnModule('), scene.indexOf('function revealAddedModule('));
  assert.match(place, /if \(!supportsWallOverlayMount\(target\)\)/);
  assert.match(place, /result\.snap\?\.mode !== 'top-wall'/);
  assert.match(place, /planWallOverlayMount\(/);
  assert.doesNotMatch(place, /getFreeTvPlacement/);
  assert.match(read('../src/placementFeedback.js'), /case 'host-unsupported':/);
});

test('separatörde desteklenmeyen genişlik + sarmaşık birleşimi seçilemez', () => {
  const dialog = read('../src/itemSizeDialog.js');
  assert.match(dialog, /optionInput\.disabled = !available;/);
  assert.match(dialog, /if \(optionOn && typeof option\?\.isAvailable === 'function' && option\.isAvailable\(itemKey\) !== true\) return;/);
  // Özellikler panelinde: seçili genişliğin sarmaşıklı karşılığı yoksa çentik işaretlenemez.
  assert.equal(describeModuleVariants({ itemKey: 'wall_separator_100_350' }).option.available, true);
  assert.equal(describeModuleVariants({ itemKey: 'wall_separator_50_350_sarmasik' }).option.checked, true);
  assert.match(read('../src/moduleContextMenu.js'), /input\.disabled = Boolean\(spec\.disabled\) \|\| \(!spec\.option\.available && !spec\.option\.checked\);/);
});

test('varyant ailesi: seçili öğenin üyeleri panelde düğme, seçili olan işaretli (0086)', () => {
  const labels = (itemKey) => {
    const variants = describeModuleVariants({ itemKey });
    return [variants.title, variants.selectedItemKey, variants.options.map((option) => option.label)];
  };
  assert.deepEqual(labels('wall_200_350'), ['Panel genişliği', 'wall_200_350', ['50 cm', '100 cm', '150 cm', '200 cm']]);
  assert.deepEqual(labels(resolveWallItemKeyForHeight('wall_150_350', 250)), ['Panel genişliği', 'wall_150_350', ['50 cm', '100 cm', '150 cm', '200 cm']]);
  assert.deepEqual(labels('wall_showcase_100_2_350'), ['Vitrin', 'wall_showcase_100_2_350', ['2 Gözlü', '3 Gözlü']]);
  assert.deepEqual(labels('shelf_row_2_150'), ['Raf', 'shelf_row_2', ['Tekli Raf', 'Çiftli Raf', "3'lü Raf"]]);
  assert.deepEqual(labels('shelf_100'), ['Raf', 'shelf_row_1', ['Tekli Raf', 'Çiftli Raf', "3'lü Raf"]]);
  assert.deepEqual(labels('tv_55'), ['Ekran boyu', 'tv_55', ['42"', '55"', '65"']]);
  assert.deepEqual(labels('video_wall_3x3'), ['Video Wall düzeni', 'video_wall_3x3', ['2×2', '3×3']]);
  assert.deepEqual(labels('extra_long_planter_150'), ['Saksı ölçüsü', 'extra_long_planter_150', ['100 cm', '150 cm', '200 cm']]);
  assert.deepEqual(labels('desk_banko_200_l'), ['Köşe banko ölçüsü', 'desk_banko_200_l', ['100 cm', '150 cm', '200 cm']]);
  // Ailesiz öğe panelde varyant göstermez.
  for (const itemKey of ['wall_door_100_350', 'floor_showcase_100', 'led_floodlight', 'glass_table']) {
    assert.equal(describeModuleVariants({ itemKey }), null, itemKey);
  }
  // Kart başlığı ailenin adıdır.
  assert.deepEqual(
    ['wall_showcase_100_3_350', 'shelf_row_1', 'tv_42', 'video_wall_2x2', 'extra_long_planter_100'].map((key) => getCatalogItem(key).label),
    ['Vitrin', 'Raf', 'TV', 'Video Wall', 'Uzun Saksı'],
  );
});

test("varyant seçimi sahneye konacak Item'a çözülür; raf genişliği öğeden gelir", () => {
  assert.equal(resolveModuleVariantItemKey({ itemKey: 'wall_100_350' }, 'wall_200_350'), 'wall_200_350');
  assert.equal(resolveModuleVariantItemKey({ itemKey: 'wall_separator_100_350' }, 'wall_separator_50_350', true), 'wall_separator_50_350_sarmasik');
  assert.equal(resolveModuleVariantItemKey({ itemKey: 'shelf_150', widthCm: 150 }, 'shelf_row_3'), 'shelf_row_3_150');
  assert.equal(resolveModuleVariantItemKey({ itemKey: 'shelf_row_3_200', widthCm: 200 }, 'shelf_row_1'), 'shelf_200');
  assert.equal(resolveModuleVariantItemKey({ itemKey: 'tv_42' }, 'tv_65'), 'tv_65');
  // Aile dışı seçim reddedilir.
  assert.equal(resolveModuleVariantItemKey({ itemKey: 'tv_42' }, 'video_wall_2x2'), null);
  assert.equal(resolveModuleVariantItemKey({ itemKey: 'wall_door_100_350' }, 'wall_100_350'), null);
});
