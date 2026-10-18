import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  getCatalogItem,
  listCatalogItems,
} from '../src/catalog.js';
import { createTvModuleState } from '../src/designState.js';
import { getItem } from '../src/items.js';
import { getModuleBehavior, getModuleGhostBehavior, isWallOverlayModule } from '../src/moduleBehavior.js';

test('TV 42 catalog and state use one shared 93.0 x 52.3 screen', () => {
  const catalog = getCatalogItem('tv_42');
  const item = getItem('tv_42');
  assert.equal(catalog.itemKey, 'tv_42');
  assert.equal(item.type, 'tv');
  assert.equal(item.dimensions.widthCm, 93);
  assert.equal(item.dimensions.heightCm, 52.3);
  const state = createTvModuleState({ itemKey: 'tv_42' });
  assert.equal(state.widthCm, 93);
  assert.equal(state.heightCm, 52.3);
  assert.equal(state.depthCm, 5);
});


test('TV 55 and 65 keep shared depth and use screen width as placement width', () => {
  const expected = {
    tv_42: [93, 52.3],
    tv_55: [121.8, 68.5],
    tv_65: [143.9, 80.9],
  };
  const base = getItem('tv_42');

  for (const itemKey of Object.keys(expected)) {
    const item = getItem(itemKey);
    const catalogItem = getCatalogItem(itemKey);
    const state = createTvModuleState({ itemKey });
    assert.ok(item);
    assert.ok(catalogItem);
    assert.ok(state);
    assert.equal(item.defaultScreenFile, 'tv-screen.jpg');
    assert.equal(item.type, base.type);
    assert.equal(item.dimensions.depthCm, base.dimensions.depthCm);
    assert.equal(item.dimensions.widthCm, expected[itemKey][0]);
    assert.equal(item.dimensions.heightCm, expected[itemKey][1]);
    assert.equal(catalogItem.itemKey, itemKey);
    assert.equal(Object.hasOwn(catalogItem, 'type'), false);
    assert.equal(Object.hasOwn(catalogItem, 'widthCm'), false);
    assert.equal(state.type, base.type);
    assert.equal(state.itemKey, itemKey);
    assert.equal(state.widthCm, expected[itemKey][0]);
    assert.equal(state.heightCm, expected[itemKey][1]);
    assert.equal(state.depthCm, 5);
  }

  assert.ok(getCatalogItem('tv_42') != null);
  assert.ok(getCatalogItem('tv_55') != null);
  assert.ok(getCatalogItem('tv_65') != null);
  assert.equal(createTvModuleState({ itemKey: 'missing_tv' }), null);
});

test('TV uses the central silhouette ghost contract', () => {
  assert.deepEqual(getModuleGhostBehavior({ type: 'tv' }), {
    kind: 'silhouette',
    renderer: 'module-silhouette',
    opacity: 0.38,
  });
});

test('TV renderer is one 5 cm BoxGeometry with the supplied image only on its front face', () => {
  const source = fs.readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  const start = source.indexOf('function createTvModule(');
  assert.ok(start >= 0);
  const finish = source.indexOf('\n}', start) + 2;
  const tvSource = source.slice(start, finish);
  assert.match(tvSource, /const depthM = Number\(moduleState\.depthCm \|\| 5\) \/ 100/);
  assert.match(tvSource, /new THREE\.BoxGeometry\(widthM, heightM, depthM\)/);
  assert.match(tvSource, /createTvScreenTexture\(item\)/);
  assert.doesNotMatch(tvSource, /getTvScreenTexture\(\)\.clone\(\)/);
  assert.match(tvSource, /map: screenTexture/);
  assert.doesNotMatch(tvSource, /createSelectionFrame\(widthM, heightM\)/);
  assert.match(tvSource, /wallFrontM = STAND_DIMENSIONS\.depth \/ 2 \+ 0\.0015/);
  assert.match(tvSource, /wallFrontM \+ depthM \/ 2 \+ 0\.003/);
  assert.doesNotMatch(tvSource, /tv\.userData\.selectionFrame/);
  assert.doesNotMatch(tvSource, /new THREE\.PlaneGeometry/);
});


test('module selection frame honors renderer-provided local bounds', () => {
  const source = fs.readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  const start = source.indexOf('function ensureModuleSelectionFrame');
  const finish = source.indexOf('\n  function setModuleSelectionVisual', start);
  assert.ok(start >= 0 && finish > start);
  const selectionSource = source.slice(start, finish);
  assert.match(selectionSource, /moduleGroup\.userData\?\.selectionBounds/);
  assert.match(selectionSource, /selectionBounds\?\.widthM/);
  assert.match(selectionSource, /selectionBounds\?\.heightM/);
  assert.match(selectionSource, /selectionBounds\?\.depthM/);
  assert.match(selectionSource, /Number\.isFinite\(centerY\) \? centerY : heightM \/ 2/);
});

test('TV 42 55 and 65 selection bounds follow the real rendered screen box', () => {
  const source = fs.readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  const start = source.indexOf('function createTvModule(');
  assert.ok(start >= 0);
  const finish = source.indexOf('\n}', start) + 2;
  const tvSource = source.slice(start, finish);

  assert.match(tvSource, /const widthM = Number\(moduleState\.widthCm\) \/ 100/);
  assert.match(tvSource, /const heightM = Number\(moduleState\.heightCm\) \/ 100/);
  assert.match(tvSource, /group\.userData\.selectionBounds = Object\.freeze\(\{/);
  assert.match(tvSource, /widthM,\s+heightM,\s+depthM,/);
  assert.match(tvSource, /centerX: tv\.position\.x/);
  assert.match(tvSource, /centerY: tv\.position\.y/);
  assert.match(tvSource, /centerZ: tv\.position\.z/);

  const expected = {
    tv_42: [0.93, 0.523],
    tv_55: [1.218, 0.685],
    tv_65: [1.439, 0.809],
  };
  for (const itemKey of Object.keys(expected)) {
    const state = createTvModuleState({ itemKey });
    assert.deepEqual(
      [state.widthCm / 100, state.heightCm / 100],
      expected[itemKey],
    );
  }
});

test('scene keeps the shared textureLoader for normal panel images', () => {
  const source = fs.readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  const sceneStart = source.indexOf('export function createStandScene');
  const surfaceStart = source.indexOf('let surfaceMeshes', sceneStart);
  const setupSource = source.slice(sceneStart, surfaceStart);
  // Ortak yükleyici proje açılış ölçümü için sayaçla sarılır; altındaki yine tek bir THREE.TextureLoader.
  assert.match(setupSource, /const textureLoader = trackSceneTextureLoader\(new THREE\.TextureLoader\(\)\)/);
});

test('TV texture loads from a real public JPEG asset', () => {
  const source = fs.readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  assert.match(source, /function createTvScreenTexture/);
  assert.match(source, /item\.defaultScreenFile/);
  assert.match(source, /texture\.colorSpace = THREE\.SRGBColorSpace/);
  assert.doesNotMatch(source, /atob\(/);
  assert.doesNotMatch(source, /TV_SCREEN_DATA_URL/);
  assert.equal(fs.existsSync(new URL('../public/tv-screen.jpg', import.meta.url)), true);
});

test('TV 42 does not inherit flat panel state', () => {
  const tv = createTvModuleState({ itemKey: 'tv_42' });
  assert.equal(tv.type, 'tv');
  assert.equal(tv.widthCm, 93);
  assert.equal(tv.heightCm, 52.3);
  assert.equal('strips' in tv, false);
  assert.equal('faces' in tv, false);
});


test('TV uses the public JPEG asset and no GLB or inline data module', () => {
  assert.equal(fs.existsSync(new URL('../public/models/tv.glb', import.meta.url)), false);
  assert.equal(fs.existsSync(new URL('../src/tvScreenImage.js', import.meta.url)), false);
  assert.equal(fs.existsSync(new URL('../public/tv-screen.jpg', import.meta.url)), true);
});

test('TV is a non-colliding wall overlay accessory', () => {
  const behavior = getModuleBehavior({ type: 'tv' });
  assert.equal(behavior.placement, 'wall-overlay');
  assert.equal(behavior.collision, 'none');
  assert.equal(behavior.allowSideInsert, false);
  assert.equal(isWallOverlayModule({ type: 'tv' }), true);
});


test('TV wall overlay drag snaps horizontal and height movement to 10 cm', () => {
  const behavior = getModuleGhostBehavior({ type: 'tv' });
  assert.equal(behavior.renderer, 'module-silhouette');
  const source = fs.readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  assert.match(source, /function getWallOverlayDragPoint/);
  assert.match(source, /clampWallOverlayZCm\(/);
  assert.match(source, /getWallOverlayZBoundsCm\(/);
  assert.match(source, /snap: \{ mode: 'wall-overlay'/);
});

test('wall-overlay height clamp reaches geometric top for every TV screen size', async () => {
  const {
    clampWallOverlayZCm,
    getWallOverlayZBoundsCm,
    WALL_OVERLAY_DEFAULT_CENTER_CM,
  } = await import('../src/modulePlacement.js');
  const wallHeightCm = 350;
  const expected = {
    tv_42: 52.3,
    tv_55: 68.5,
    tv_65: 80.9,
  };
  for (const [itemKey, heightCm] of Object.entries(expected)) {
    const { maxZCm, minZCm } = getWallOverlayZBoundsCm(heightCm, wallHeightCm);
    const topCm = WALL_OVERLAY_DEFAULT_CENTER_CM + maxZCm + heightCm / 2;
    const bottomCm = WALL_OVERLAY_DEFAULT_CENTER_CM + minZCm - heightCm / 2;
    assert.ok(Math.abs(topCm - wallHeightCm) < 1e-9, `${itemKey} geometric max must sit flush to the wall top`);
    assert.ok(Math.abs(bottomCm) < 1e-9, `${itemKey} geometric min must sit flush to the wall bottom`);
    assert.equal(clampWallOverlayZCm(999, heightCm, 10, wallHeightCm), maxZCm);
    assert.equal(clampWallOverlayZCm(-999, heightCm, 10, wallHeightCm), minZCm);
  }
  // Eski snap tavanı tv_42'yi 140'ta durduruyordu; geometrik max daha yüksek, sıfır bitebilir.
  assert.ok(getWallOverlayZBoundsCm(52.3, 350).maxZCm > 140);
  assert.equal(
    clampWallOverlayZCm(150, 52.3, 10, 350),
    getWallOverlayZBoundsCm(52.3, 350).maxZCm,
  );
});

test('TV catalog preview uses a dedicated TV silhouette instead of panel strips', () => {
  const source = fs.readFileSync(new URL('../src/catalogPreviewRenderer.js', import.meta.url), 'utf8');
  const fixture = fs.readFileSync(new URL('./fixtures/catalogPreviewKinds.mjs', import.meta.url), 'utf8');
  assert.match(fixture, /id: 26/);
  assert.match(fixture, /module-drag-tv/);
  assert.doesNotMatch(source, /module\.type === 'tv'/);
});
