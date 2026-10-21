import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPanelRangeSelection, createRectSelection } from '../src/rectSelection.js';

test('Ctrl/Cmd panel range selection is based on panel presence, not module type', () => {
  const scene = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  assert.match(scene, /surface\.userData\.selectionMode === 'panel'/);
  assert.match(scene, /const result = createPanelRangeSelection\(/);
  // Aralık yalnız çapanın yüzündeki (ön / arka) panellerden kurulur.
  assert.match(scene, /const isAnchorSidePanel = \(surface\) => surface\.userData\.selectionMode === 'panel'\s*&& \(surface\.userData\.panelSide \?\? 'front'\) === anchorSide;/);
  assert.match(scene, /\.filter\(\(surface\) => isAnchorSidePanel\(surface\)\)/);
});


test('scene handles same-module panel ranges before wall-plane selection', () => {
  const scene = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  assert.match(scene, /anchorModuleId && anchorModuleId === targetModuleId/);
  assert.match(scene, /sameModuleResult = createPanelRangeSelection/);
  assert.match(scene, /surface\.userData\.moduleId === anchorModuleId/);
  assert.match(scene, /selectedModuleId = anchorModuleId/);
});

test('Ctrl\/Cmd raycast prefers a real panel surface over module proxy hits', () => {
  const scene = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  assert.match(scene, /const hits = raycaster\.intersectObjects\(surfaceMeshes, false\)/);
  assert.match(scene, /hits\.find\(\(entry\) => entry\.object\?\.userData\?\.selectionMode === 'panel'\)/);
  assert.match(scene, /const hit = panelHit \?\? hits\[0\]/);
});

test('door upper panels 4-6 can be selected vertically as one range', () => {
  const items = [4, 5, 6].map((stripIndex) => ({ moduleIndex: 0, stripIndex, id: `door-${stripIndex}` }));
  const result = createPanelRangeSelection(
    items,
    { moduleIndex: 0, stripIndex: 4 },
    { moduleIndex: 0, stripIndex: 6 },
  );
  assert.equal(result.ok, true);
  assert.deepEqual(result.entries.map((entry) => entry.stripIndex), [4, 5, 6]);
});

test('missing non-panel cells do not block Ctrl/Cmd multi selection', () => {
  const items = [
    { moduleIndex: 0, stripIndex: 0, id: 'flat-top' },
    { moduleIndex: 0, stripIndex: 1, id: 'flat-mid' },
    { moduleIndex: 0, stripIndex: 2, id: 'flat-low' },
    { moduleIndex: 1, stripIndex: 0, id: 'door-top' },
    { moduleIndex: 1, stripIndex: 2, id: 'door-low' },
    { moduleIndex: 2, stripIndex: 0, id: 'shelf-top' },
    { moduleIndex: 2, stripIndex: 1, id: 'shelf-mid' },
    { moduleIndex: 2, stripIndex: 2, id: 'shelf-low' },
  ];
  const range = createPanelRangeSelection(
    items,
    { moduleIndex: 0, stripIndex: 0 },
    { moduleIndex: 2, stripIndex: 2 },
  );
  assert.equal(range.ok, true);
  assert.equal(range.panelCount, 8);

  // Lightbox/beze çevirme için kullanılan strict dikdörtgen doğrulaması değişmez.
  const strict = createRectSelection(
    items,
    { moduleIndex: 0, stripIndex: 0 },
    { moduleIndex: 2, stripIndex: 2 },
  );
  assert.equal(strict.ok, false);
});

test('catalog panel-bearing wall module builders expose panel selection mode', () => {
  const scene = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  const shelfRenderer = scene.slice(
    scene.indexOf('function createShelfModule'),
    scene.indexOf('function createFlatPanelModule'),
  );
  assert.match(scene, /function createFlatPanelModule[\s\S]*?selectionMode: 'panel'/);
  assert.match(scene, /function createDoorModule[\s\S]*?surfaceRole: 'upper-panel'[\s\S]*?selectionMode: 'panel'|function createDoorModule[\s\S]*?selectionMode: 'panel'[\s\S]*?surfaceRole: 'upper-panel'/);
  assert.match(scene, /function createShowcaseModule[\s\S]*?selectionMode: 'panel'/);
  assert.doesNotMatch(shelfRenderer, /createFlatPanelModule/);
  assert.match(scene, /function createBaseWallModule[\s\S]*?createFlatPanelModule/);
});
