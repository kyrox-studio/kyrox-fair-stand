import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('illuminated foam exposes module metadata for selection and drag', () => {
  const source = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  const start = source.indexOf('function createIlluminatedFoamModule(');
  const end = source.indexOf('function createTvModule(', start);
  const block = source.slice(start, end);
  assert.match(block, /group\.userData\.kind = 'module'/);
  assert.match(block, /group\.userData\.moduleId = moduleState\.id/);
  assert.match(block, /group\.userData\.moduleType = 'illuminated-foam'/);
  assert.match(block, /group\.userData\.type = 'illuminated-foam'/);
  assert.match(block, /group\.userData\.widthCm/);
  assert.match(block, /group\.userData\.depthCm/);
  assert.match(block, /group\.userData\.heightCm/);
});

test('illuminated foam asenkron SVG ve halo eklenince yeniden çizim ister', () => {
  const source = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  const start = source.indexOf('function createIlluminatedFoamModule(');
  const end = source.indexOf('function createTvModule(', start);
  const block = source.slice(start, end);
  assert.match(block, /visualRoot\.add\(raw\);\s*(?:\/\/[^\n]*\s*)?requestEditorRender\(\);/);
  assert.match(block, /visualRoot\.add\(halo\);\s*requestEditorRender\(\);/);
});

test('sürükleme etiketi katalogda görünmeyen item için item adını kullanır', async () => {
  const source = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  const start = source.indexOf('function updateDragBadge(');
  const block = source.slice(start, source.indexOf('const previewSlot = dragBadge.querySelector', start));
  assert.match(block, /getModuleCatalogItem\(moduleState\)\s*\? getModuleCatalogLabel\(moduleState\)\s*: \(getItem\(moduleState\?\.itemKey\)\?\.name \?\? getModuleCatalogLabel\(moduleState\)\)/);
  const { getItem } = await import('../src/items.js');
  const { getModuleCatalogItem } = await import('../src/catalog.js');
  const hidden = { itemKey: 'upright_99', type: 'upright' };
  assert.equal(getModuleCatalogItem(hidden), null);
  assert.equal(getItem(hidden.itemKey).name, 'Dikme 99');
});
