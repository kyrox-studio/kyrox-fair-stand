import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listCatalogGroups,
  listCatalogItems,
  getCatalogItem,
} from '../src/catalog.js';
import {
  createModuleStateFromDescriptor,
  MODULE_STATE_TYPES,
  normalizeModuleItemState,
} from '../src/designState.js';
import { getItem, resolveItemKey, resolveSceneDimensions } from '../src/items.js';
import { countsTowardWallCapacity, usesPanelSeamOverlaySnap } from '../src/moduleBehavior.js';
import { resolveModuleContract } from '../src/moduleContracts.js';
import {
  getWallUsedCm,
  listInternalSeamsInOccupancyRange,
  overlayZCmFromSeamHeight,
  snapPanelSeamOverlayPlacement,
  WALL_OVERLAY_DEFAULT_CENTER_CM,
} from '../src/modulePlacement.js';
import {
  getModuleRecipe,
} from './recipeParentItemKey.js';
import { getStandInternalSeamHeightsCm, getStandStripMetrics } from '../src/stripOccupancy.js';

const SHELF_KEYS = Object.freeze(['shelf_100', 'shelf_150', 'shelf_200']);
const REMOVED_WALL_SHELF_KEYS = Object.freeze([
  'wall_shelf_2_100',
  'wall_shelf_2_150',
  'wall_shelf_2_200',
  'wall_shelf_3_100',
  'wall_shelf_3_150',
  'wall_shelf_3_200',
]);

function wallModule(itemKey, xCm = 0) {
  const state = createModuleStateFromDescriptor({ itemKey, type: 'flat-panel' });
  state.placement = {
    xCm,
    yCm: 0,
    zCm: 0,
    rotationZDeg: 0,
    wallId: 'back',
  };
  return state;
}

test('raf kataloğu üç sıra kartı sunar; kartlar en dar üretim ürününe çözülür', () => {
  const cards = ['shelf_row_1', 'shelf_row_2', 'shelf_row_3'];
  assert.deepEqual([...listCatalogGroups().find((group) => group.id === 3).keys], [
    'wall_showcase_100_3_350', 'wall_showcase_100_2_350', ...cards,
  ]);
  for (const [index, key] of cards.entries()) {
    assert.ok(getCatalogItem(key));
    const state = createModuleStateFromDescriptor(getCatalogItem(key));
    assert.equal(state.itemKey, index === 0 ? 'shelf_100' : `shelf_row_${index + 1}_100`);
    assert.equal(state.widthCm, 100);
    assert.equal(state.heightCm, 1.8 + index * 50);
    assert.equal(state.shelfLightingOn, false);
    assert.equal(usesPanelSeamOverlaySnap(state), true);
    assert.equal(countsTowardWallCapacity(state), false);
  }
  for (const key of SHELF_KEYS) {
    assert.equal(getCatalogItem(key), null);
    assert.equal(getItem(key).catalogVisible, false);
  }
});
test('F standalone renderer tek raf tahtası çizer; wall/panel üretmez', () => {
  const source = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  const start = source.indexOf('function createShelfModule');
  // Assembly free-pose renderer createShelf ile createFlatPanel arasındadır; shelf dilimini orada kes.
  const end = source.indexOf('function createItemAssemblyModule');
  const renderer = source.slice(start, end);
  assert.match(renderer, /new THREE\.BoxGeometry\(widthM, thicknessM, depthM\)/);
  assert.equal((renderer.match(/new THREE\.BoxGeometry/g) ?? []).length, 2);
  assert.doesNotMatch(renderer, /createFlatPanelModule/);
  assert.doesNotMatch(renderer, /heightsByCountCm/);
  assert.doesNotMatch(renderer, /stripCount/);
  assert.doesNotMatch(renderer, /PANEL_VERTICAL_PROFILE_WIDTH_M/);
  assert.match(renderer, /const item = getItem\(moduleState\.itemKey\);/);
  assert.doesNotMatch(renderer, /getShelfLeafItem/);
});

function seamWallPoint(pointerXCm, absoluteHeightCm = 100) {
  return {
    wallId: 'back',
    pointerXCm,
    pointerYCm: 0,
    rotationZDeg: 0,
    absoluteHeightCm,
  };
}

function snapShelf(itemKey, hostKey, pointerXCm, absoluteHeightCm = 100) {
  return snapPanelSeamOverlayPlacement({
    moduleState: createModuleStateFromDescriptor({ itemKey, type: 'shelf' }),
    wallPoint: seamWallPoint(pointerXCm, absoluteHeightCm),
    modules: [wallModule(hostKey, 0)],
  });
}

test('A shelf_150 exact itemKey ile state olur; width/type/shelfCount identity üretmez', () => {
  const state = createModuleStateFromDescriptor({ itemKey: 'shelf_150', type: 'shelf' });
  assert.equal(state.itemKey, 'shelf_150');
  assert.equal(state.type, 'shelf');
  assert.equal(state.widthCm, 150);
  assert.equal(createModuleStateFromDescriptor({ type: 'shelf', widthCm: 150 }), null);
  assert.equal(createModuleStateFromDescriptor({ type: 'shelf', widthCm: 100, shelfCount: 2 }), null);
  assert.equal(resolveItemKey({ type: 'shelf', widthCm: 100 }), null);
  assert.equal(resolveItemKey({ type: 'shelf', widthCm: 100, shelfCount: 2 }), null);
  assert.equal(resolveItemKey({ itemKey: 'shelf_150' }), 'shelf_150');
  const inferred = { type: 'shelf', widthCm: 100 };
  normalizeModuleItemState(inferred);
  assert.equal(inferred.itemKey, undefined);
});

test('B-D raf sığdığı wall/panel support span’e bağlanır; taşarsa invalid', () => {
  const shelf150On200 = snapShelf('shelf_150', 'wall_200_350', 100, 150);
  assert.equal(shelf150On200.ok, true);
  assert.equal(shelf150On200.seamHeightCm, 150);
  assert.equal(shelf150On200.placement.xCm, 0);

  const shelf100On150 = snapShelf('shelf_100', 'wall_150_350', 75);
  assert.equal(shelf100On150.ok, true);
  assert.equal(shelf100On150.seamHeightCm, 100);
  assert.equal(shelf100On150.placement.xCm, 0);

  const shelf100On200 = snapShelf('shelf_100', 'wall_200_350', 80);
  assert.equal(shelf100On200.ok, true);
  assert.equal(shelf100On200.seamHeightCm, 100);
  assert.equal(shelf100On200.placement.xCm, 0);

  const shelf200On200 = snapShelf('shelf_200', 'wall_200_350', 80);
  assert.equal(shelf200On200.ok, true);
  assert.equal(shelf200On200.seamHeightCm, 100);
  assert.equal(shelf200On200.placement.xCm, 0);

  assert.equal(snapShelf('shelf_150', 'wall_100_350', 50).ok, true);
  assert.equal(snapShelf('shelf_200', 'wall_100_350', 50).ok, true);
  assert.equal(snapShelf('shelf_200', 'wall_150_350', 75).ok, true);
  const shelf100On200Edge = snapShelf('shelf_100', 'wall_200_350', 10);
  assert.equal(shelf100On200Edge.ok, true);
  assert.equal(shelf100On200Edge.placement.xCm, 0);
});

test('G-I panel internal seam snap: geçerli birleşim, orta ve dış sınır reddi', () => {
  const metrics = getStandStripMetrics();
  const seams = getStandInternalSeamHeightsCm();
  assert.equal(metrics.stripCount, 7);
  assert.equal(metrics.stripHeightCm, 50);
  assert.deepEqual([...seams], [50, 100, 150, 200, 250, 300]);
  assert.equal(seams.includes(0), false);
  assert.equal(seams.includes(350), false);

  const wall = wallModule('wall_100_350', 0);
  const shelf = createModuleStateFromDescriptor({ itemKey: 'shelf_100', type: 'shelf' });
  const occupancySeams = listInternalSeamsInOccupancyRange({ minCm: 0, maxCm: 350 });
  assert.deepEqual([...occupancySeams], [...seams]);

  const valid = snapPanelSeamOverlayPlacement({
    moduleState: shelf,
    wallPoint: seamWallPoint(50, 100),
    modules: [wall],
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.seamHeightCm, 100);
  assert.equal(valid.placement.xCm, 0);
  assert.equal(valid.placement.wallId, 'back');
  assert.equal(
    valid.placement.zCm,
    overlayZCmFromSeamHeight(100, 1.8),
  );
  assert.equal(valid.placement.zCm, 100 + 1.8 / 2 - WALL_OVERLAY_DEFAULT_CENTER_CM);

  const midPanel = snapPanelSeamOverlayPlacement({
    moduleState: shelf,
    wallPoint: seamWallPoint(50, 75),
    modules: [wall],
  });
  assert.equal(midPanel.ok, false);
  assert.equal(midPanel.seamHeightCm, null);

  const floorEdge = snapPanelSeamOverlayPlacement({
    moduleState: shelf,
    wallPoint: seamWallPoint(50, 0),
    modules: [wall],
  });
  assert.equal(floorEdge.ok, false);

  const topEdge = snapPanelSeamOverlayPlacement({
    moduleState: shelf,
    wallPoint: seamWallPoint(50, 350),
    modules: [wall],
  });
  assert.equal(topEdge.ok, false);
});

test('J shelf wall capacity’ye 100/150/200 cm eklemez', () => {
  const wall = wallModule('wall_200_350', 0);
  const shelf = createModuleStateFromDescriptor({ itemKey: 'shelf_200', type: 'shelf' });
  shelf.placement = {
    xCm: 0,
    yCm: 0,
    zCm: overlayZCmFromSeamHeight(150, 1.8),
    rotationZDeg: 0,
    wallId: 'back',
  };
  assert.equal(getWallUsedCm([wall], 'back'), 200);
  assert.equal(getWallUsedCm([wall, shelf], 'back'), 200);
  assert.equal(countsTowardWallCapacity(shelf), false);
});

test('K wall_shelf_* Item’ları hâlâ yok', () => {
  for (const itemKey of REMOVED_WALL_SHELF_KEYS) {
    assert.equal(getItem(itemKey), null, itemKey);
    assert.equal(getCatalogItem(itemKey), null, itemKey);
    assert.equal(resolveModuleContract(itemKey), null, itemKey);
  }
});

test('L wall_showcase_* ve glass_shelf regression bozulmaz', () => {
  assert.equal(getItem('wall_showcase_100_2_350').catalogVisible, true);
  assert.equal(getItem('wall_showcase_100_3_350').catalogVisible, true);
  assert.equal(getItem('glass_shelf').type, 'showcase-accessory');
  assert.equal(getItem('glass_shelf').catalogVisible, false);
  assert.ok(getModuleRecipe('showcase-2', 100));
  assert.ok(getModuleRecipe('showcase-3', 100));
  assert.equal(getModuleRecipe('shelf', 100), null);
  assert.equal(resolveModuleContract('wall_showcase_100_2_350').bom.mode, 'recipe');
  assert.equal(getModuleRecipe('shelf', 100), null);
});
