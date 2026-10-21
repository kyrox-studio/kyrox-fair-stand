import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
const start = source.indexOf('function createBaseModule(');
const end = source.indexOf('function createCounterModule(', start);
const baseBlock = source.slice(start, end);

test('baza renderer uses banko-style thin top and bottom rails with one panel tier', () => {
  assert.ok(baseBlock.includes('const railHeightM = STAND_DIMENSIONS.panelRailHeight;'));
  assert.ok(baseBlock.includes('const railYs = [0, frameHeightM];'));
  assert.equal(baseBlock.includes('stripHeightM'), false);
  assert.equal((baseBlock.match(/moduleState\.faces\?\.front/g) ?? []).length, 1);
  assert.equal((baseBlock.match(/moduleState\.faces\?\.left/g) ?? []).length, 1);
  assert.equal((baseBlock.match(/moduleState\.faces\?\.right/g) ?? []).length, 1);
});

test('baza renderer preserves existing width depth and height inputs', () => {
  assert.ok(baseBlock.includes('const widthCm = Number(moduleState.widthCm);'));
  assert.ok(baseBlock.includes('const depthCm = Number(moduleState.depthCm) || 50;'));
  assert.ok(baseBlock.includes('const heightCm = Number(moduleState.heightCm) || 50;'));
});

test('baza face meshes use procedural aperture, not BOM panel stamp sizes', () => {
  assert.ok(baseBlock.includes('const faceWidth = faceWidthM;'));
  assert.ok(baseBlock.includes('const faceHeight = fittedPanelHeightM;'));
  assert.ok(baseBlock.includes('panelFrameOpening(0, frameHeightM)'));
  assert.equal(baseBlock.includes('partSpanM('), false);
});

test('wall door and showcase panel meshes use the module scene aperture, not the leaf panel stamp', () => {
  const slices = [
    ['function createFlatPanelModule(', 'function createDoorModule('],
    ['function createDoorModule(', 'function createSeparatorModule('],
    ['function createShowcaseModule(', 'function createSelectionFrame('],
  ];
  for (const [startName, endName] of slices) {
    const start = source.indexOf(startName);
    const end = source.indexOf(endName, start);
    const block = source.slice(start, end);
    assert.ok(start >= 0 && end > start, startName);
    assert.equal(block.includes('partSpanM('), false, startName);
    assert.match(block, /new THREE\.BoxGeometry\(innerWidth, panelHeight, panelDepth\)/);
    assert.match(block, /new THREE\.PlaneGeometry\(innerWidth, panelHeight\)/);
  }
  const showcaseStart = source.indexOf('function createShowcaseModule(');
  const showcase = source.slice(showcaseStart, source.indexOf('function createSelectionFrame(', showcaseStart));
  assert.match(showcase, /requireModuleSceneBoxCm\(\s*moduleState,\s*\['widthCm', 'heightCm', 'depthCm'\]/);
  assert.equal(showcase.includes('bodyDefinition.item.dimensions.widthCm'), false);
});
