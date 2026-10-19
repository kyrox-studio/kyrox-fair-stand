import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listCatalogItems,
} from '../src/catalog.js';
import { getModuleGhostBehavior } from '../src/moduleBehavior.js';

test('every current and future module inherits the lightweight silhouette ghost rule', () => {
  const expected = { kind: 'silhouette', renderer: 'module-silhouette', opacity: 0.38 };
  assert.deepEqual(getModuleGhostBehavior('future-module-without-explicit-ghost'), expected);
  for (const module of listCatalogItems()) {
    assert.deepEqual(getModuleGhostBehavior(module), expected);
  }
});

test('scene ghost reuses normal module geometry and one textureless basic material', () => {
  const scene = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.match(scene, /function createRenderableModule\(moduleState, moduleIndex, onSurfaceReady = null\)/);
  assert.match(scene, /const built = createRenderableModule\(moduleOrWidthCm, -1, null\)/);
  assert.match(scene, /new THREE\.MeshBasicMaterial\(\{[\s\S]*?transparent: true,[\s\S]*?depthWrite: false,[\s\S]*?depthTest: false,[\s\S]*?toneMapped: false,[\s\S]*?fog: false/);
  assert.match(scene, /object\.material = ghostMaterial/);
  assert.match(scene, /object\.castShadow = false/);
  assert.match(scene, /object\.receiveShadow = false/);
  assert.match(scene, /object\.raycast = \(\) => \{\}/);
  assert.match(scene, /object\.isLight[\s\S]*?object\.visible = false/);
  assert.match(scene, /object\.add = \(\.\.\.children\) =>/);
  assert.doesNotMatch(scene, /ghostBehavior\.renderer ===/);
});

test('placement ghost is a singleton instead of a per-model cache', () => {
  const scene = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.doesNotMatch(scene, /placementGhostTemplates/);
  assert.match(scene, /if \(placementGhost\?\.key === key\) return placementGhost/);
  assert.match(scene, /destroyPlacementGhost\(\);\n    placementGhost = createPlacementGhost/);
  assert.match(scene, /function disposePlacementGhost\(\) \{\n    if \(!placementGhost\) return;\n    placementGhost\.root\.visible = false/);
});

// Kural değişti (2026-10-19): dikme birleşimi kaçırırsa reddedilmez, serbest yerleşir.
test('short-up-joint miss no longer rejects the upright; ghost DOM state stays wired', () => {
  const scene = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.match(scene, /function syncPlacementGhostDom\(\)/);
  assert.match(scene, /canvas\.dataset\.placementGhost = 'hidden'/);
  assert.match(scene, /canvas\.dataset\.placementGhost = placementGhost\.colorHex === PLACEMENT_VALID_COLOR/);
  assert.equal(
    (scene.match(/if \(requiresShortUpJointSnap\(moduleState\) && !magneticSnap\) \{\n      const message = 'Yalnız short-up, profil veya banko birleşimine yerleştirilir\.';\n      showPlacementGhost\(moduleState, snapped\.placement, false\);/g) || []).length,
    0,
  );
  assert.doesNotMatch(
    scene,
    /if \(requiresShortUpJointSnap\(moduleState\) && !magneticSnap\) \{\n      disposePlacementGhost\(\);/,
  );
});

test('placement ghost key distinguishes occupancy so hanging strip variants are not reused', () => {
  const scene = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const start = scene.indexOf('function getPlacementGhostKey');
  const end = scene.indexOf('function createSilhouetteGhostMaterial', start);
  assert.ok(start >= 0 && end > start);
  const fn = scene.slice(start, end);
  assert.match(fn, /resolveModuleStripOccupancy\(moduleOrWidthCm\)/);
  assert.match(fn, /moduleOrWidthCm\.itemKey/);
  assert.match(fn, /occupancy\?\.stripCount/);
});
