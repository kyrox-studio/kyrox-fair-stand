import { extname } from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listCatalogItems,
  getCatalogItem,
} from '../src/catalog.js';
import { planAutomaticDepot } from '../src/autoDepot.js';
import { getItem, listRegisteredItems, resolveItemKey } from '../src/items.js';
import { resolveModuleContract } from '../src/moduleContracts.js';

const SRC_DIR = new URL('../src/', import.meta.url);
const AUTO_DEPOT_SOURCE = readFileSync(new URL('../src/autoDepot.js', import.meta.url), 'utf8');
const MODULE_CONTRACTS_SOURCE = readFileSync(new URL('../src/moduleContracts.js', import.meta.url), 'utf8');
const CATALOG_SOURCE = readFileSync(new URL('../src/catalog.js', import.meta.url), 'utf8');

function listSrcJsFiles() {
  return readdirSync(SRC_DIR)
    .filter((name) => extname(name) === '.js')
    .map((name) => ({ name, source: readFileSync(new URL(name, SRC_DIR), 'utf8') }));
}

test('autoDepot.js Catalog API veya catalogVisible kullanmaz; Item master okur', () => {
  assert.doesNotMatch(AUTO_DEPOT_SOURCE, /from ['"]\.\/catalog\.js['"]/);
  assert.doesNotMatch(AUTO_DEPOT_SOURCE, /getCatalogItem/);
  assert.doesNotMatch(AUTO_DEPOT_SOURCE, /MODULE_CATALOG/);
  assert.doesNotMatch(AUTO_DEPOT_SOURCE, /catalogVisible/);
  assert.doesNotMatch(AUTO_DEPOT_SOURCE, /catalogCategory/);
  assert.doesNotMatch(AUTO_DEPOT_SOURCE, /catalogItemIndex/);
  assert.match(AUTO_DEPOT_SOURCE, /from ['"]\.\/items\.js['"]/);
  assert.match(AUTO_DEPOT_SOURCE, /getItem\(/);
  assert.match(AUTO_DEPOT_SOURCE, /dimensions\.widthCm/);
  assert.match(AUTO_DEPOT_SOURCE, /dimensions\.depthCm/);
  assert.match(AUTO_DEPOT_SOURCE, /dimensions\.heightCm/);
});

test('moduleContracts.js Catalog projection’ı Item varlığı olarak kullanmaz', () => {
  assert.doesNotMatch(MODULE_CONTRACTS_SOURCE, /from ['"]\.\/catalog\.js['"]/);
  assert.doesNotMatch(MODULE_CONTRACTS_SOURCE, /getCatalogItem/);
  assert.doesNotMatch(MODULE_CONTRACTS_SOURCE, /MODULE_CATALOG/);
  assert.doesNotMatch(MODULE_CONTRACTS_SOURCE, /catalogVisible/);
  assert.match(MODULE_CONTRACTS_SOURCE, /from ['"]\.\/items\.js['"]/);
  assert.match(MODULE_CONTRACTS_SOURCE, /getItem\(/);
  assert.match(MODULE_CONTRACTS_SOURCE, /resolveItemKey/);
});

test('CATALOG.md Catalog’un runtime repository olmadığını kilitler', () => {
  const catalogDoc = readFileSync(new URL('../docs/refactor/CATALOG.md', import.meta.url), 'utf8');
  assert.match(catalogDoc, /Catalog bir Item runtime repository değildir/);
  assert.match(catalogDoc, /catalogVisible=false` yalnız Catalog UI görünürlüğünü etkiler/);
  assert.match(catalogDoc, /AutoDepot → Catalog/);
  assert.match(catalogDoc, /ModuleContract → Catalog/);
});

test('catalog.js Recipe/BOM’dan Item özelliği öğrenmez; resolveItemKey Catalog re-export etmez', () => {
  const itemsSource = readFileSync(new URL('../src/items.js', import.meta.url), 'utf8');
  assert.doesNotMatch(CATALOG_SOURCE, /moduleRecipes/);
  assert.doesNotMatch(CATALOG_SOURCE, /getStraightWallNominalWidthForProfileItem/);
  assert.doesNotMatch(CATALOG_SOURCE, /catalogWidthCm/);
  assert.doesNotMatch(CATALOG_SOURCE, /resolveSceneDimensions/);
  assert.doesNotMatch(CATALOG_SOURCE, /export \{ resolveItemKey \}/);
  assert.match(itemsSource, /export function resolveItemKey/);
  assert.match(itemsSource, /Item identity çözümlemesi Catalog üyeliğine bağlı değildir/);
  assert.doesNotMatch(CATALOG_SOURCE, /normalized\.itemKey && getCatalogItem/);
  assert.doesNotMatch(CATALOG_SOURCE, /getFurnitureClusterQuantity/);
  assert.doesNotMatch(CATALOG_SOURCE, /COUNTER_DIMENSIONS/);
  assert.doesNotMatch(CATALOG_SOURCE, /BASE_DIMENSIONS/);
  assert.doesNotMatch(CATALOG_SOURCE, /SHELF_DIMENSIONS/);
  assert.doesNotMatch(CATALOG_SOURCE, /LED_FLOODLIGHT_DIMENSIONS/);
  assert.doesNotMatch(CATALOG_SOURCE, /TV_42_DIMENSIONS/);
  assert.doesNotMatch(CATALOG_SOURCE, /flatPanelKey/);
  assert.doesNotMatch(CATALOG_SOURCE, /STAND_DIMENSIONS/);
  assert.doesNotMatch(CATALOG_SOURCE, /MODULE_WIDTHS_CM/);
  assert.doesNotMatch(CATALOG_SOURCE, /export const MODULE_CATALOG/);
  assert.doesNotMatch(CATALOG_SOURCE, /MODULE_CATALOG_KEYS/);
  assert.doesNotMatch(CATALOG_SOURCE, /MODULE_CATALOG_GROUPS/);
});

test('public Item registry tek bootstrapped catalog’dur; kova export yoktur', () => {
  const itemsSource = readFileSync(new URL('../src/items.js', import.meta.url), 'utf8');
  assert.match(itemsSource, /export function initializeItemRegistry/);
  assert.doesNotMatch(itemsSource, /export const ITEMS/);
  assert.match(itemsSource, /export function getItem/);
  assert.match(itemsSource, /export function listRegisteredItems/);
  for (const bucket of [
    'LEAF_ITEMS',
    'COMMERCIAL_ITEMS',
    'FURNITURE_ITEMS',
    'INDOOR_PLANT_ITEMS',
    'WALL_MEDIA_ITEMS',
    'TOP_LIGHT_ITEMS',
    'NON_CATALOG_ITEMS',
    'FLOOR_ITEMS',
    'COMPOSITE_ITEMS',
  ]) {
    assert.doesNotMatch(itemsSource, new RegExp(bucket), bucket);
  }
  assert.doesNotMatch(itemsSource, /export function listLeafItems/);
  assert.doesNotMatch(itemsSource, /export function listCompositeItems/);
  assert.equal(listRegisteredItems().length, 126);
  assert.equal(new Set(listRegisteredItems().map((item) => item.itemKey)).size, 126);
});

test('STAND_DIMENSIONS runtime kaydı ve MODULE_WIDTHS_CM sahibi src/standDimensions.js; Catalog re-export yok', () => {
  const owner = readFileSync(new URL('../src/standDimensions.js', import.meta.url), 'utf8');
  assert.match(owner, /export function initializeStandDimensions/);
  assert.match(owner, /export function getStandDimensions/);
  assert.match(owner, /export const MODULE_WIDTHS_CM = Object\.freeze\(\[50, 100, 150, 200\]\)/);
  for (const file of listSrcJsFiles()) {
    if (file.name === 'standDimensions.js') continue;
    if (!file.source.includes('STAND_DIMENSIONS') && !file.source.includes('MODULE_WIDTHS_CM')) continue;
    assert.match(file.source, /from ['"]\.\/standDimensions\.js['"]/, file.name);
  }
});

test('maxImageUploadMb sahibi src/runtimeSettings.js; Catalog re-export yok', () => {
  const owner = readFileSync(new URL('../src/runtimeSettings.js', import.meta.url), 'utf8');
  assert.match(owner, /export function initializeRuntimeSettings/);
  assert.match(owner, /export function getMaxImageUploadMb/);
  for (const file of listSrcJsFiles()) {
    if (file.name === 'runtimeSettings.js') continue;
    if (
      !file.source.includes('initializeRuntimeSettings')
      && !file.source.includes('getMaxImageUploadMb')
      && !file.source.includes('getMaxImageUploadBytes')
      && !file.source.includes('formatImageUploadTooLargeMessage')
    ) {
      continue;
    }
    assert.match(file.source, /from ['"]\.\/runtimeSettings\.js['"]/, file.name);
  }
});

test('DATABASE.md fair_stand tablo envanterini taşır', () => {
  const doc = readFileSync(new URL('../docs/refactor/DATABASE.md', import.meta.url), 'utf8');
  const itemsDoc = readFileSync(new URL('../docs/refactor/ITEMS.md', import.meta.url), 'utf8');
  for (const table of [
    'alembic_version',
    'fair_stand_categories',
    'fair_stand_catalog_preview_kinds',
    'fair_stand_items',
    'fair_stand_item_dimensions',
    'fair_stand_item_scene_dimensions',
    'fair_stand_item_strip_occupancy',
    'fair_stand_item_assets',
    'fair_stand_item_components',
    'fair_stand_item_video_walls',
    'fair_stand_item_body_parts',
    'fair_stand_dimensions',
    'fair_stand_settings',
    'fair_stand_cost_items',
  ]) {
    assert.match(doc, new RegExp(`\`${table}\``), table);
  }
  assert.match(doc, /rotation_step_deg/);
  assert.match(doc, /max_image_upload_mb/);
  assert.match(doc, /export_button_visible/);
  assert.match(doc, /import_button_visible/);
  assert.match(doc, /save_as_button_visible/);
  assert.match(itemsDoc, /docs\/refactor\/DATABASE\.md/);
});

test('ROTATION.md Item rotation sözleşmesidir; TYPE_BEHAVIORS rotation taşımaz', () => {
  const rotationDoc = readFileSync(new URL('../docs/refactor/ROTATION.md', import.meta.url), 'utf8');
  const itemsDoc = readFileSync(new URL('../docs/refactor/ITEMS.md', import.meta.url), 'utf8');
  const behavior = readFileSync(new URL('../src/moduleBehavior.js', import.meta.url), 'utf8');
  assert.match(rotationDoc, /rotationStepDeg/);
  assert.match(itemsDoc, /docs\/refactor\/ROTATION\.md/);
  assert.doesNotMatch(itemsDoc, /\| rotation \| Rotation \| henüz belirlenmedi \| yapılmadı \|/);
  const behaviorStandard = readFileSync(new URL('../MODULE_BEHAVIOR_STANDARD.md', import.meta.url), 'utf8');
  assert.match(behaviorStandard, /docs\/refactor\/ROTATION\.md/);
  assert.doesNotMatch(behaviorStandard, /rotationStepDeg`: R \/ Shift\+R/);
  assert.match(behavior, /resolveRotationItem/);
  assert.doesNotMatch(behavior, /STRAIGHT_COUNTER_WIDTHS_CM/);
});

test('resolveItemKey src caller’ları items.js’ten okur', () => {
  for (const file of listSrcJsFiles()) {
    if (file.name === 'items.js') continue;
    if (!file.source.includes('resolveItemKey')) continue;
    assert.match(file.source, /from ['"]\.\/items\.js['"]/, file.name);
  }
});

test('catalogVisible yalnız Catalog üyeliği içindir; src runtime domainleri okumaz', () => {
  const offenders = [];
  for (const file of listSrcJsFiles()) {
    if (file.name === 'catalog.js' || file.name === 'items.js') continue;
    if (file.source.includes('catalogVisible')) offenders.push(file.name);
  }
  assert.deepEqual(offenders, []);
});

test('catalogVisible=false Item runtime’da yok demek değildir', () => {
  const hiddenKeys = ['panel_197', 'upright_99', 'illuminated-foam', 'video_wall_panel'];
  for (const itemKey of hiddenKeys) {
    const item = getItem(itemKey);
    assert.ok(item, itemKey);
    assert.equal(item.catalogVisible, false, itemKey);
    assert.equal(getCatalogItem(itemKey), null, itemKey);
    assert.equal(resolveItemKey({ itemKey }), itemKey, itemKey);
  }

  assert.equal(listRegisteredItems().length, 126);
  assert.equal(listRegisteredItems().filter((item) => item.catalogVisible === true).length, 62);
  assert.equal(listCatalogItems().length, 62);
  assert.equal(listCatalogItems().map((item) => item.itemKey).length, 62);

  const hiddenItem = getItem('panel_197');
  assert.ok(hiddenItem);
  assert.equal(getCatalogItem('panel_197'), null);
  assert.notEqual(Boolean(hiddenItem), Boolean(getCatalogItem('panel_197')));

  assert.equal(getItem('shelf_100').catalogVisible, false);
  assert.equal(getCatalogItem('shelf_100'), null);
  assert.ok(getCatalogItem('shelf_row_1'));
});

test('gizli Item’ın contract yokluğu Catalog gizliliğinden değil assignment yokluğundandır', () => {
  assert.ok(getItem('panel_197'));
  assert.equal(getCatalogItem('panel_197'), null);
  assert.equal(resolveModuleContract('panel_197'), null);

  const wall = resolveModuleContract('wall_200_350');
  assert.ok(wall);
  assert.equal(wall.itemKey, 'wall_200_350');
  assert.equal(wall.type, getItem('wall_200_350').type);

  const foam = resolveModuleContract('illuminated-foam');
  assert.ok(foam);
  assert.equal(foam.itemKey, 'illuminated-foam');
  assert.equal(getCatalogItem('illuminated-foam'), null);
});

test('AutoDepot includeContents çıktısı Item.dimensions regression’ı ile birebir aynıdır', () => {
  const fridge = getItem('mini_fridge_avanti').dimensions;
  const rack = getItem('coat_rack').dimensions;
  const kettle = getItem('kettle').dimensions;
  const trash = getItem('plastic_trash_bin');

  const plan = planAutomaticDepot({
    standType: 'island',
    standXCm: 600,
    standYCm: 500,
    sizeKey: '200x200',
    includeContents: true,
  });
  assert.equal(plan.ok, true);
  assert.equal(plan.originXCm, 200);
  assert.equal(plan.originYCm, 150);

  const fridgeSpec = plan.specs.find((spec) => spec.kind === 'mini-fridge');
  const rackSpec = plan.specs.find((spec) => spec.kind === 'coat-rack');
  const kettleSpec = plan.specs.find((spec) => spec.kind === 'kettle');
  const trashSpec = plan.specs.find((spec) => spec.itemKey === 'plastic_trash_bin');

  assert.deepEqual([fridgeSpec.widthCm, fridgeSpec.depthCm], [fridge.widthCm, fridge.depthCm]);
  assert.deepEqual([rackSpec.widthCm, rackSpec.depthCm], [rack.widthCm, rack.depthCm]);
  assert.deepEqual([kettleSpec.widthCm, kettleSpec.depthCm], [kettle.widthCm, kettle.depthCm]);
  assert.equal(kettleSpec.itemKey, 'kettle');
  assert.equal(kettleSpec.placement.zCm, getItem('kettle').defaultZCm);
  assert.deepEqual(
    [trashSpec.widthCm, trashSpec.depthCm, trashSpec.heightCm],
    [trash.dimensions.widthCm, trash.dimensions.depthCm, trash.dimensions.heightCm],
  );
  assert.equal(trashSpec.kind, trash.type);
  assert.equal(trashSpec.modelFile, trash.modelFile);
  assert.equal(trashSpec.preserveModelScale, Boolean(trash.preserveModelScale));

  assert.deepEqual([fridge.widthCm, fridge.depthCm], [50, 50]);
  assert.deepEqual([rack.widthCm, rack.depthCm], [43, 43]);
  assert.deepEqual([kettle.widthCm, kettle.depthCm], [24, 19]);
  assert.deepEqual([trash.dimensions.widthCm, trash.dimensions.depthCm, trash.dimensions.heightCm], [40, 40, 60]);

  assert.deepEqual([fridgeSpec.placement.xCm, fridgeSpec.placement.yCm], [250.5, 227]);
  assert.deepEqual([rackSpec.placement.xCm, rackSpec.placement.yCm], [306.5, 227]);
  assert.deepEqual([kettleSpec.placement.xCm, kettleSpec.placement.yCm], [263.5, 242.5]);
  assert.deepEqual([trashSpec.placement.xCm, trashSpec.placement.yCm], [280, 278]);
});
