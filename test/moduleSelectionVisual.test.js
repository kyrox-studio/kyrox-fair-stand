import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scene = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');

test('module selection falls back to a generic blue 3D frame', () => {
  assert.match(scene, /function ensureModuleSelectionFrame\(moduleGroup\)/);
  assert.match(scene, /new THREE\.EdgesGeometry\(new THREE\.BoxGeometry\(/);
  assert.match(scene, /color: SELECTION_COLOR/);
  assert.match(scene, /new THREE\.LineDashedMaterial/);
  assert.match(scene, /frame\.computeLineDistances\(\)/);
  assert.match(scene, /moduleGroup\.userData\?\.widthCm/);
  assert.match(scene, /moduleGroup\.userData\?\.depthCm/);
  assert.match(scene, /moduleGroup\.userData\?\.heightCm/);
  assert.match(scene, /!frame && mesh\.userData\?\.selectionMode === 'module'/);
});

test('fallback-only module hits show and clear the generic selection frame', () => {
  assert.match(scene, /function selectModuleOnly\(moduleId\)[\s\S]*?setModuleSelectionVisual\(selectedModuleId, true\)/);
  assert.match(scene, /function clearSelection[\s\S]*?setModuleSelectionVisual\(selectedModuleId, false\)/);
});

test('render export hides the generic module selection frame', () => {
  assert.match(scene, /if \(moduleSelectionFrame\) moduleSelectionFrame\.visible = false/);
  assert.match(scene, /if \(moduleSelectionFrame\) moduleSelectionFrame\.visible = moduleSelectionVisibility/);
  assert.match(scene, /groupSelectionFrame\.visible = false/);
  assert.match(scene, /groupSelectionFrame\.visible = groupSelectionVisibility/);
});
