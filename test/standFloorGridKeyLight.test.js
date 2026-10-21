import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const scene = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');

function functionBlock(startName, endName) {
  const start = scene.indexOf(startName);
  const end = scene.indexOf(endName, start + startName.length);
  assert.ok(start >= 0 && end > start, `${startName} … ${endName}`);
  return scene.slice(start, end);
}

test('stand zemini ızgarası: 50 cm ince, her 2. çizgi (1 m) kalın; yalnız stand alanında', () => {
  assert.match(scene, /const STAND_GRID_FINE_STEP_M = 0\.5;/);
  assert.match(scene, /const STAND_GRID_FINE_PER_BOLD = 2;/);
  const grid = functionBlock('function createStandFloorGrid(', 'function setStandFloorGridActive(');
  // Kenarlar stand çerçevesidir; çizgiler 0 … genişlik/derinlik arasında, kenarlar hariç.
  assert.match(grid, /for \(let index = 1; index < steps; index \+= 1\)/);
  assert.match(grid, /fine\.push\(x, y, 0, x, y, depthM\)/);
  assert.match(grid, /fine\.push\(0, y, z, widthM, y, z\)/);
  assert.doesNotMatch(grid, /SCENE_SURROUND_M/);
  // Izgara seçim/yerleştirme ışınına takılmaz.
  assert.match(grid, /lines\.raycast = \(\) => \{\};/);
});

test('ızgara yalnız yerleştirme önizlemesi görünürken çizilir; boşta gizli', () => {
  assert.match(scene, /const STAND_GRID_OPACITY = Object\.freeze\(\{ bold: 0\.8, fine: 0\.45 \}\);/);
  assert.match(functionBlock('function createStandFloorGrid(', 'function setStandFloorGridActive('), /group\.visible = false;/);
  assert.match(functionBlock('function setStandFloorGridActive(', 'function disposeStandFloorGrid('), /standFloorGrid\.visible = active;/);
  const sync = functionBlock('function syncPlacementGhostDom(', 'function disposePlacementGhost(');
  assert.match(sync, /setStandFloorGridActive\(Boolean\(placementGhost\?\.root\?\.visible\)\);/);
  assert.match(scene, /standFloorGrid = createStandFloorGrid\(widthM, depthM\);/);
  assert.match(scene, /scene\.add\(grid, standFloorGrid, standOutline, \.\.\.activeWallGuides\);/);
  assert.match(functionBlock('function disposeGroundGuides(', 'function '), /disposeStandFloorGrid\(\);/);
});

test('ana ışık tepeden stand merkezine bakar; gölge kamerası standı kapsar', () => {
  assert.match(scene, /const KEY_LIGHT_OFFSET = Object\.freeze\(\{ x: 1\.2, y: 12, z: 3 \}\);/);
  const aim = functionBlock('function aimKeyLightAtStand(', 'shadowCamera.updateProjectionMatrix();');
  assert.match(aim, /keyLight\.target\.position\.set\(centerX, 0, centerZ\);/);
  assert.match(aim, /keyLight\.position\.set\(centerX \+ KEY_LIGHT_OFFSET\.x, KEY_LIGHT_OFFSET\.y, centerZ \+ KEY_LIGHT_OFFSET\.z\);/);
  assert.match(aim, /Math\.max\(widthM, depthM\) \/ 2 \+ KEY_LIGHT_SHADOW_MARGIN_M/);
  assert.match(scene, /updateStageFog\(widthM, depthM\);\s*aimKeyLightAtStand\(widthM, depthM\);/);
  assert.doesNotMatch(scene, /keyLight\.position\.set\(5, 8, 6\);/);
});

test('ölçü katmanı: seçilen öğenin taban alanı ve ölçüleri; taşırken 4 kenara uzaklık; Render Al’da yok', () => {
  const sync = functionBlock('function syncMeasureOverlay(', 'function createActiveWallGuides(');
  // Önizleme varken uzaklık, yoksa tek seçili öğenin taban alanı.
  assert.match(sync, /if \(ghostVisible && stageLayout\) \{[\s\S]*mode = 'distance';[\s\S]*\} else if \(!multiSelectedModuleIds\.size && selectedModuleId\) \{[\s\S]*mode = 'footprint';/);
  assert.match(sync, /box = measureModuleBox\(placementGhost\.root\) \?\?/);
  assert.match(functionBlock('function measureModuleBox(', 'function syncMeasureOverlay('), /expandByScalar\(-\(frame\.userData\.paddingM \?\? 0\) \/ 2\)/);
  const distances = functionBlock('function measureStandDistances(', 'function syncMeasureOverlay(');
  assert.match(distances, /new THREE\.Vector3\(stageLayout\.widthM, y, centerZ\)/);
  assert.match(distances, /new THREE\.Vector3\(centerX, y, stageLayout\.depthM\)/);
  assert.match(distances, /if \(distanceM < MEASURE_MIN_DISTANCE_M\) return;/);
  assert.match(scene, /syncMeasureOverlay\(\);\s*const renderStartedAt = performance\.now\(\);/);
  const capture = scene.slice(scene.indexOf('async function captureCurrentViewPng'), scene.indexOf('async function captureCurrentViewPng') + 5000);
  assert.match(capture, /measureGroup\.visible = false;/);
  assert.match(capture, /if \(standFloorGrid\) standFloorGrid\.visible = false;/);
});
