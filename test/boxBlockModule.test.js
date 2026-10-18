import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getCatalogItem, listCatalogGroups } from '../src/catalog.js';
import { createBoxBlockModuleState, createModuleStateFromCatalogKey, normalizeModuleItemState } from '../src/designState.js';
import {
  getModuleBehavior,
  getModuleDefaultRotationDeg,
  getModuleRotationStepDeg,
} from '../src/moduleBehavior.js';
import { getItem, resolveItemDefaultZCm } from '../src/items.js';

const KEY = 'box_block';

test('box_block is cataloged under Panel Ek Modül with free box-block type', () => {
  const descriptor = getCatalogItem(KEY);
  assert.ok(descriptor);
  assert.equal(descriptor.label, 'Kutu blok');

  const group = listCatalogGroups().find((entry) => entry.label === 'Panel Ek Modül');
  assert.ok(group?.keys.includes(KEY));
  assert.equal(
    listCatalogGroups().flatMap((entry) => entry.keys).filter((key) => key === KEY).length,
    1,
  );
});

test('box_block keeps color and opacity and accepts image lightbox mesh from the item row', () => {
  const item = getItem(KEY);
  assert.equal(item.acceptsColor, true);
  assert.equal(item.acceptsImage, true);
  assert.equal(item.acceptsLightbox, true);
  assert.equal(item.acceptsGlass, false);
  assert.equal(item.acceptsMesh, true);
  assert.equal(item.defaultOpacity, 0.85);
});

test('box-block state reads WDH opacity rotation and defaultZ from item DB fields', () => {
  const state = createModuleStateFromCatalogKey(KEY);
  assert.ok(state);
  assert.equal(state.itemKey, KEY);
  assert.equal(state.type, 'box-block');
  assert.deepEqual([state.widthCm, state.depthCm, state.heightCm], [100, 50, 50]);
  assert.equal(state.opacity, 0.85);
  assert.equal(getModuleBehavior(state).placement, 'free');
  assert.equal(getModuleRotationStepDeg(state), 45);
  assert.equal(getModuleDefaultRotationDeg(state), 0);
  assert.equal(resolveItemDefaultZCm(state), 0);
});

test('box block faces keep image and lightbox on four sides and the top, and the body stays unlit', () => {
  const state = createModuleStateFromCatalogKey(KEY);
  assert.deepEqual(Object.keys(state.faces), ['front', 'right', 'back', 'left', 'top']);
  assert.equal(state.faces.top.widthCm, 100);
  assert.equal(state.faces.top.heightCm, 50);
  assert.equal(state.faces.front.widthCm, 100);
  assert.equal(state.faces.front.heightCm, 50);
  assert.equal(state.faces.right.widthCm, 50);
  assert.equal(state.faces.left.widthCm, 50);
  state.faces.front.imageAssetId = 'img-1';
  state.faces.back.fabricGroupId = 'fabric-1';
  state.faces.back.fabricLightingOn = true;
  state.widthCm = 80;
  state.depthCm = 40;
  state.heightCm = 30;
  const loaded = normalizeModuleItemState(JSON.parse(JSON.stringify(state)));
  assert.equal(loaded.faces.front.imageAssetId, 'img-1');
  assert.equal(loaded.faces.back.fabricLightingOn, true);
  assert.equal(loaded.faces.front.widthCm, 80);
  assert.equal(loaded.faces.front.heightCm, 30);
  assert.equal(loaded.faces.right.widthCm, 40);
  // Üst yüz modül ölçüsünü izler: en × derinlik.
  assert.equal(loaded.faces.top.widthCm, 80);
  assert.equal(loaded.faces.top.heightCm, 40);
  assert.equal(loaded.opacity, 0.85);
  assert.equal(Object.hasOwn(loaded, 'cubeLightingOn'), false);
});

test('createBoxBlockModuleState accepts instance WDH opacity overrides', () => {
  const state = createBoxBlockModuleState({
    itemKey: KEY,
    widthCm: 80,
    depthCm: 40,
    heightCm: 30,
    opacity: 0.4,
  });
  assert.ok(state);
  assert.deepEqual([state.widthCm, state.depthCm, state.heightCm], [80, 40, 30]);
  assert.equal(state.opacity, 0.4);
});

test('createBoxBlockModule renderer keeps the body and adds four outward side faces and a top face', () => {
  const source = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  const start = source.indexOf('function createBoxBlockModule');
  const end = source.indexOf('function createIlluminatedFoamModule');
  assert.ok(start >= 0 && end > start);
  const body = source.slice(start, end);
  assert.match(body, /new THREE\.BoxGeometry\(widthM, heightM, depthM\)/);
  assert.match(body, /transparent:\s*opacity < 1/);
  assert.match(body, /mesh\.position\.set\(0,\s*heightM \/ 2,\s*0\)/);
  assert.match(body, /acceptsLightbox:\s*false/);
  assert.match(body, /new THREE\.PlaneGeometry\(layout\.width, layout\.height\)/);
  assert.match(body, /selectionMode:\s*'panel'/);
  assert.match(body, /createSelectionFrame\(layout\.width, layout\.height\)/);
  assert.match(body, /slot:\s*'front'/);
  assert.match(body, /slot:\s*'right'/);
  assert.match(body, /slot:\s*'back'/);
  assert.match(body, /slot:\s*'left'/);
  assert.match(body, /slot:\s*'top'[^\n]*rotationX:\s*-Math\.PI \/ 2/);
  const moveStart = source.indexOf("if (moduleState.type === 'box-block')");
  const moveEnd = source.indexOf('const stepCm = isTopFixtureType', moveStart);
  assert.ok(moveStart >= 0 && moveEnd > moveStart);
  const move = source.slice(moveStart, moveEnd);
  assert.match(move, /stepWallShortFloorZCm\(currentZCm, bestArrowMove\.deltaCm, moduleState\.heightCm\)/);
  assert.match(move, /kind:\s*'z'/);
});

test('an old box block without a top face gets one on load, coloured like the body', () => {
  const state = createModuleStateFromCatalogKey(KEY);
  const old = JSON.parse(JSON.stringify(state));
  delete old.faces.top;
  old.surface = { ...(old.surface ?? {}), color: '#123456' };
  const loaded = normalizeModuleItemState(old);
  assert.ok(loaded.faces.top);
  assert.ok(loaded.faces.top.id);
  assert.equal(loaded.faces.top.color, '#123456');
  assert.equal(loaded.faces.top.widthCm, loaded.widthCm);
  assert.equal(loaded.faces.top.heightCm, loaded.depthCm);
});

test('box block top face image and lightbox enter the production list as width x depth', async () => {
  const { collectPrintAreas } = await import('../src/printAreaBom.js');
  const state = createModuleStateFromCatalogKey(KEY);
  state.widthCm = 120;
  state.depthCm = 60;
  const sized = normalizeModuleItemState(JSON.parse(JSON.stringify(state)));
  assert.equal(sized.faces.top.widthCm, 120);
  assert.equal(sized.faces.top.heightCm, 60);

  // Görsel: Dijital Baskı'ya üst yüz ölçüsüyle tek parça girer.
  const printed = JSON.parse(JSON.stringify(sized));
  printed.faces.top.imageAssetId = 'top-logo';
  const imageSection = collectPrintAreas([printed]).find((section) => section.id === 'image');
  assert.ok(imageSection, 'Dijital Baskı bölümü');
  const imagePieces = imageSection.lines.flatMap((line) => line.pieces ?? [line]);
  assert.ok(
    imagePieces.some((piece) => piece.widthCm === 120 && piece.heightCm === 60),
    `120 × 60 baskı parçası bekleniyordu: ${JSON.stringify(imageSection.lines)}`,
  );

  // Lightbox: Lightbox Bezi bölümüne aynı ölçüyle girer.
  const fabric = JSON.parse(JSON.stringify(sized));
  fabric.faces.top.fabricGroupId = 'top-fabric';
  fabric.faces.top.fabricType = 'lightbox';
  const lightboxSection = collectPrintAreas([fabric]).find((section) => section.id === 'lightbox');
  assert.ok(lightboxSection, 'Lightbox Bezi bölümü');
  assert.ok(Math.abs(lightboxSection.totalAreaM2 - 0.72) < 1e-6, `toplam ${lightboxSection.totalAreaM2} m²`);
});
