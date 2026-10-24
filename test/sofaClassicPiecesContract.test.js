import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  getCatalogItem,
  listCatalogItems,
} from '../src/catalog.js';
import {
  createBeigeSofaSetModuleState,
  createCoffeeTableClassicModuleState,
  createSofaDoubleClassicModuleState,
  createSofaSingleClassicModuleState,
} from '../src/designState.js';
import { getItem } from '../src/items.js';

test('furniture_sofa_single_classic katalog ve state kimliği sabittir', () => {
  const catalog = getCatalogItem('furniture_sofa_single_classic');
  const item = getItem('furniture_sofa_single_classic');
  assert.equal(item.itemKey, 'furniture_sofa_single_classic');
  assert.equal(item.type, 'sofa-single-classic');
  assert.equal(item.name, 'Tekli Koltuk');
  assert.equal(catalog.label, 'Tekli Koltuk');
  assert.equal(item.dimensions.widthCm, 65);
  assert.equal(item.dimensions.depthCm, 45);
  assert.equal(item.dimensions.heightCm, 78);
  assert.ok(getCatalogItem('furniture_sofa_single_classic') != null);

  const state = createSofaSingleClassicModuleState();
  assert.equal(state.itemKey, 'furniture_sofa_single_classic');
  assert.equal(state.itemKey, 'furniture_sofa_single_classic');
  assert.equal(state.type, 'sofa-single-classic');
  assert.equal(state.surface.color, '#ffffff');
  assert.equal(item.visualRotationYDeg, -135);
  assert.equal(state.visualRotationYDeg, -135);
});

test('furniture_sofa_double_classic katalog ve state kimliği sabittir', () => {
  const catalog = getCatalogItem('furniture_sofa_double_classic');
  const item = getItem('furniture_sofa_double_classic');
  assert.equal(item.itemKey, 'furniture_sofa_double_classic');
  assert.equal(item.type, 'sofa-double-classic');
  assert.equal(item.name, 'Çiftli Koltuk');
  assert.equal(item.dimensions.widthCm, 150);
  assert.equal(item.dimensions.depthCm, 45);
  assert.equal(item.dimensions.heightCm, 78);
  assert.ok(getCatalogItem('furniture_sofa_double_classic') != null);

  const state = createSofaDoubleClassicModuleState();
  assert.equal(state.itemKey, 'furniture_sofa_double_classic');
  assert.equal(state.type, 'sofa-double-classic');
  assert.equal(state.surface.color, '#ffffff');
  assert.equal(item.visualRotationYDeg, -45);
  assert.equal(state.visualRotationYDeg, -45);
});

test('furniture_coffee_table_classic katalog ve state kimliği sabittir', () => {
  const catalog = getCatalogItem('furniture_coffee_table_classic');
  const item = getItem('furniture_coffee_table_classic');
  assert.equal(item.itemKey, 'furniture_coffee_table_classic');
  assert.equal(item.type, 'coffee-table-classic');
  assert.equal(item.name, 'Sehpa');
  assert.equal(item.dimensions.widthCm, 60);
  assert.equal(item.dimensions.depthCm, 42);
  assert.equal(item.dimensions.heightCm, 38);
  assert.ok(getCatalogItem('furniture_coffee_table_classic') != null);

  const state = createCoffeeTableClassicModuleState();
  assert.equal(state.itemKey, 'furniture_coffee_table_classic');
  assert.equal(state.type, 'coffee-table-classic');
  assert.equal(state.surface, undefined);
});

test('classic sofa set is a cluster of one double, two singles and one coffee table', () => {
  const set = createBeigeSofaSetModuleState();
  const item = getItem('furniture_sofa_set_classic');
  assert.equal(set.itemKey, 'furniture_sofa_set_classic');
  assert.equal(set.type, 'sofa-set-classic');
  assert.equal(Object.hasOwn(item, 'unit'), false);
  assert.deepEqual(item.composition.items, [
    { itemKey: 'furniture_sofa_double_classic', quantity: 1 },
    { itemKey: 'furniture_sofa_single_classic', quantity: 2 },
    { itemKey: 'furniture_coffee_table_classic', quantity: 1 },
  ]);
});

test('classic sofa pieces reuse the shared beige sofa GLB and coffee table helper', () => {
  const source = fs.readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  assert.match(source, /function createSofaSingleClassicModule/);
  assert.match(source, /function createSofaDoubleClassicModule/);
  assert.match(source, /function createCoffeeTableClassicModule/);
  assert.match(source, /function addClassicCoffeeTable/);
  assert.match(source, /getItem\('furniture_sofa_single_classic'\)/);
  assert.match(source, /getItem\('furniture_sofa_double_classic'\)/);
  assert.match(source, /getItem\('furniture_coffee_table_classic'\)/);
  assert.match(source, /moduleState\.visualRotationYDeg \?\? item\.visualRotationYDeg/);
});

test('masa ayağı ve orta sehpa alüminyum; koltuk ayağı boyamadan bağımsız sabit ahşap', async () => {
  const { FURNITURE_ALUMINIUM_APPEARANCE } = await import('../src/theme.js');
  const scene = fs.readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  assert.ok(FURNITURE_ALUMINIUM_APPEARANCE.metalness >= 0.8);
  assert.doesNotMatch(scene, /color: 0x30343a/);
  const coffeeTable = scene.slice(scene.indexOf('function addClassicCoffeeTable'), scene.indexOf('function attachBeigeSofaMesh'));
  assert.equal((coffeeTable.match(/FURNITURE_ALUMINIUM_APPEARANCE/g) ?? []).length, 2);
  assert.match(scene, /originalLegMaterial\.color\?\.set\(itemDefaultColorCss\('furniture_coffee_table_classic'\)\);/);
  // Boyama yalnız döşemeye yazar; ahşap ayak malzemesi atlanır.
  assert.match(scene, /if \(!material\?\.userData\?\.sofaUpholstery\) return;/);
});
