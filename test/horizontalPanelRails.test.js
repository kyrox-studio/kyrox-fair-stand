import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scene = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');

function functionBlock(startName, endName) {
  const start = scene.indexOf(startName);
  const end = scene.indexOf(endName, start);
  assert.ok(start >= 0 && end > start, startName);
  return scene.slice(start, end);
}

const panelFrame = functionBlock('function addPanelModuleFrame(', 'function createFlatPanelModule(');

test('panel systems keep only bottom and top horizontal profiles', () => {
  assert.doesNotMatch(scene, /for \(let i = 0; i <= stripCount; i \+= 1\)/);
  assert.doesNotMatch(scene, /for \(let index = 0; index <= stripCount; index \+= 1\)/);
  // Ortak çerçeve tam iki dikme + iki yatay profil çizer; ara yatay profil yok.
  assert.equal((panelFrame.match(/addProfile\(railGeometry\.clone\(\)/g) ?? []).length, 2);
  assert.match(panelFrame, /addProfile\(railGeometry\.clone\(\), 0, frameBottomY \+ railHeight \/ 2\)/);
  assert.match(panelFrame, /addProfile\(railGeometry\.clone\(\), 0, frameTopY - railHeight \/ 2\)/);
});

test('wall, door and showcase frames draw all four edges with the stand frame cross-section', () => {
  assert.match(panelFrame, /const \{ frameWidth, frameDepth \} = getProceduralFrameCrossSectionM\(moduleState\);/);
  assert.match(panelFrame, /createSlottedProfileGeometry\(frameWidth, segmentTop - segmentBottom, frameDepth\)/);
  const showcase = functionBlock('function createShowcaseModule(', 'function createSelectionFrame(');
  // Vitrin gövdesi yüksekliğinde dikme çizilmez.
  assert.match(showcase, /uprightGap: \{ bottomY: bodyBottom, topY: bodyTop \},/);
  assert.match(panelFrame, /const railHeight = Math\.min\(frameWidth, frameHeight \/ 2\);/);
  assert.match(panelFrame, /createSlottedProfileGeometry\(railLength, railHeight, frameDepth\)/);
  assert.match(panelFrame, /createFrameProfileMesh\(geometry, frameMaterial, edgeMaterial\)/);
  const profileMesh = functionBlock('function createFrameProfileMesh(', 'function addPanelModuleFrame(');
  assert.match(profileMesh, /new THREE\.EdgesGeometry\(geometry\)/);
  assert.match(profileMesh, /edges\.raycast = \(\) => \{\};/);
  for (const [startName, endName] of [
    ['function createFlatPanelModule(', 'function createDoorModule('],
    ['function createDoorModule(', 'function createSeparatorModule('],
    ['function createShowcaseModule(', 'function createSelectionFrame('],
  ]) {
    const block = functionBlock(startName, endName);
    assert.match(block, /addPanelModuleFrame\(group, moduleState, \{/, startName);
    // Panel yüzü sağ/solda PANEL_FRAME_SIDE_INSET_M (2 cm), alt/üstte PANEL_FRAME_INSET_M (4 cm) içeride biter.
    assert.match(block, /const innerWidth = Math\.max\(widthM - PANEL_FRAME_SIDE_INSET_M \* 2, 0\.02\);/, startName);
    assert.match(block, /const panelOpening = panelFrameOpening\(/, startName);
    assert.match(block, /fitPanelToFrameOpening\(/, startName);
    assert.doesNotMatch(block, /railGeometry/, startName);
  }
});

test('counter and door panel systems do not create intermediate horizontal rails', () => {
  assert.doesNotMatch(scene, /const railYs = \[0, stripHeightM, frameHeightM\]/);
  assert.doesNotMatch(scene, /const railYs = \[\s*0,\s*doorHeight,/);
  assert.ok(
    (scene.match(/const railYs = \[0, frameHeightM\];/g) ?? []).length >= 2,
  );
  const door = functionBlock('function createDoorModule(', 'function createSeparatorModule(');
  assert.match(door, /frameBottomY: 0,\s*frameTopY: height,/);
});

test('panel inset is 4 cm at top/bottom and 3 cm at left/right frame edges', () => {
  assert.match(scene, /const PANEL_FRAME_INSET_M = 0\.04;/);
  assert.match(scene, /const PANEL_FRAME_SIDE_INSET_M = 0\.02;/);
  assert.doesNotMatch(scene, /PANEL_FRAME_INSET_M \* 2/);
  assert.match(scene, /return \{ bottomY: frameBottomY \+ PANEL_FRAME_INSET_M, topY: frameTopY - PANEL_FRAME_INSET_M \};/);
});

test('panel face stands PANEL_FACE_OFFSET_M (15 mm) in front of the wall/profile face', () => {
  assert.match(scene, /const PANEL_FACE_OFFSET_M = 0\.015;/);
  assert.equal((scene.match(/wallFrontM = STAND_DIMENSIONS\.depth \/ 2 \+ PANEL_FACE_OFFSET_M;/g) ?? []).length, 3);
  for (const [startName, endName] of [
    ['function createFlatPanelModule(', 'function createDoorModule('],
    ['function createDoorModule(', 'function createSeparatorModule('],
    ['function createShowcaseModule(', 'function createSelectionFrame('],
  ]) {
    const block = functionBlock(startName, endName);
    assert.match(block, /depth \/ 2 \+ PANEL_FACE_OFFSET_M\)/, startName);
    assert.match(block, /const \{ panelDepth, backingZ \} = resolvePanelSlab\(moduleState, depth\);/, startName);
  }
});

test('base and counters use square profile rails and inset panels in front of the frame', () => {
  const boxFrame = functionBlock('function addBoxModuleFrame(', 'function resolveBoxPanelBackingDepth(');
  assert.match(boxFrame, /createSlottedProfileGeometry\(profileM, frameHeightM, profileM\)/);
  assert.match(boxFrame, /createSlottedProfileGeometry\(length, profileM, profileM\)/);
  assert.match(boxFrame, /createSlottedProfileGeometry\(profileM, profileM, length\)/);
  const facePlacement = functionBlock('function placeBoxPanelFace(', 'function createBaseModule(');
  assert.match(facePlacement, /surface\.position\.copy\(anchor\)\.addScaledVector\(outward, PANEL_FACE_OFFSET_M\);/);
  for (const [startName, endName] of [
    ['function createBaseModule(', 'function createCounterModule('],
    ['function createCounterModule(', 'function createLCounterModule('],
    ['function createLCounterModule(', 'function createShelfModule('],
  ]) {
    const block = functionBlock(startName, endName);
    assert.match(block, /addBoxModuleFrame\(group, frameMaterial, \{/, startName);
    assert.match(block, /PANEL_FRAME_SIDE_INSET_M \* 2/, startName);
    assert.match(block, /panelFrameOpening\(0, frameHeightM\)/, startName);
    assert.match(block, /placeBoxPanelFace\(backing, surface, anchor, outward, backingDepth\);/, startName);
  }
});
