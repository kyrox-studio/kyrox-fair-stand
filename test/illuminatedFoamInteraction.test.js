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

test('arşivdeki görsele tıklamak seçili straforun logosunu hemen uygular', () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const start = source.indexOf('function renderAssetLibrary(');
  const block = source.slice(start, source.indexOf('function formatCm(', start));
  assert.match(block, /'click', \(\) => \{\s*closeAssetContextMenu\(\);\s*setActiveAsset\(asset\.id, \{ focus: true \}\);\s*applyAssetToSelectedFoam\(asset\.id\);/);
  // Sağ tık menüsü yalnız aktif yapar, logoyu değiştirmez.
  assert.doesNotMatch(block.slice(block.indexOf("'contextmenu'")), /applyAssetToSelectedFoam/);

  const helperStart = source.indexOf('function applyAssetToSelectedFoam(');
  const helper = source.slice(helperStart, source.indexOf('function applyActiveImageToSelection(', helperStart));
  assert.match(helper, /selectedIlluminatedFoamModules\(scene3d\.getSelectedSurfaces\(\)\)/);
  assert.match(helper, /setIlluminatedFoamLogo\(foamModules, assetId\)/);
});

test('strafor kartı düz panel değil kendi önizlemesini kullanır', async () => {
  const { getItem } = await import('../src/items.js');
  const { getCatalogPreview } = await import('../src/catalog.js');
  const preview = getCatalogPreview(getItem('illuminated-foam').previewId);
  assert.equal(preview.markup, '<div class="module-drag-foam-logo"></div>');
  assert.match(preview.cssCode, /\.module-drag-foam-logo::before \{ content:'LOGO'/);
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
