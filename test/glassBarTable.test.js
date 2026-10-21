import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { getCatalogItem, listCatalogGroups } from '../src/catalog.js';
import {
  createGlassTableModuleState,
  createModuleStateFromDescriptor,
  normalizeModuleItemState,
} from '../src/designState.js';
import { getItem } from '../src/items.js';
import { getModuleBehavior } from '../src/moduleBehavior.js';
import { resolveModuleContract } from '../src/moduleContracts.js';

const scene = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');

test('bar masası cam masa ailesindedir; yalnız yükseklik 108 cm', () => {
  const table = getItem('glass_table');
  const bar = getItem('glass_bar_table');
  assert.equal(bar.name, 'Bar Masası');
  assert.equal(bar.type, 'table-glass');
  assert.deepEqual([bar.dimensions.widthCm, bar.dimensions.depthCm, bar.dimensions.heightCm], [75, 75, 108]);
  assert.deepEqual([table.dimensions.widthCm, table.dimensions.depthCm, table.dimensions.heightCm], [75, 75, 74]);
  assert.equal(bar.previewId, table.previewId);
  assert.deepEqual(getCatalogItem('glass_bar_table'), { itemKey: 'glass_bar_table', label: 'Bar Masası', previewId: table.previewId });
  assert.ok(listCatalogGroups().find((group) => group.label === 'Extra')?.keys.includes('glass_bar_table'));
  assert.deepEqual(resolveModuleContract('glass_bar_table')?.bom, resolveModuleContract('glass_table')?.bom);
});

test('kart kendi Item’ını yaratır; varsayılan cam masa değişmez; açılışta kimlik korunur', () => {
  const plain = createGlassTableModuleState();
  assert.equal(plain.itemKey, 'glass_table');
  assert.equal(plain.heightCm, 74);
  const bar = createModuleStateFromDescriptor(getCatalogItem('glass_bar_table'), { itemKey: 'glass_bar_table' });
  assert.equal(bar.itemKey, 'glass_bar_table');
  assert.equal(bar.type, 'table-glass');
  assert.equal(bar.heightCm, 108);
  assert.deepEqual(getModuleBehavior(bar), getModuleBehavior(plain));
  const reopened = normalizeModuleItemState(JSON.parse(JSON.stringify(bar)));
  assert.equal(reopened.itemKey, 'glass_bar_table');
  assert.equal(reopened.heightCm, 108);
});

test('çizim modülün Item’ından okunur; ayak masa yüksekliğine göre uzar', () => {
  assert.match(scene, /function createGlassTableModule\(moduleState, moduleIndex\) \{\s*const item = getItem\(moduleState\.itemKey \?\? 'glass_table'\);/);
  assert.match(scene, /const stemLengthM = heightM - 0\.04;/);
  assert.match(scene, /stem\.position\.set\(0, 0\.02 \+ stemLengthM \/ 2, 0\);/);
  assert.doesNotMatch(scene, /CylinderGeometry\(0\.035, 0\.045, 0\.70, 20\)/);
});
