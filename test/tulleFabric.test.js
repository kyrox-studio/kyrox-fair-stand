import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  createBoxBlockModuleState,
  createTulleFabricModuleState,
  normalizeModuleItemState,
} from '../src/designState.js';
import {
  applyItemPlacementZCm,
  getItem,
  initializeItemRegistry,
  listRegisteredItems,
} from '../src/items.js';
import { getModuleMoveSnapCm } from '../src/moduleBehavior.js';
import { clampFloorRelativeBottomZCm, stepTulleFabricZCm } from '../src/modulePlacement.js';
import { getStandDimensions } from '../src/standDimensions.js';
import { resolveProjectBom } from '../src/projectBom.js';

const PANEL = { itemKey: 'panel_98', widthCm: 98, heightCm: 47 };

function strip(stripIndex, extra = {}) {
  return { stripIndex, itemKey: PANEL.itemKey, widthCm: PANEL.widthCm, heightCm: PANEL.heightCm, ...extra };
}

function wall(id, strips) {
  return {
    id,
    type: 'flat-panel',
    itemKey: 'wall_100_350',
    widthCm: 100,
    strips,
  };
}

function line(bom, itemKey) {
  return bom.lines.find((entry) => entry.itemKey === itemKey) ?? null;
}

test('bootstrap item tulle_fabric is the visible square-metre plate', () => {
  const item = getItem('tulle_fabric');
  assert.equal(item.name, 'Tül');
  assert.equal(item.type, 'tulle-fabric');
  assert.equal(item.catalogVisible, true);
  assert.equal(item.isRender, true);
  assert.equal(item.unit, 'metre_kare');
  assert.equal(item.isCostEnabled, true);
  assert.equal(item.defaultZCm, 350);
  assert.equal(item.dimensions.depthCm, 0.4);
  assert.equal(item.categoryId, 5);
  assert.equal(item.previewId, 9);
  assert.equal(getModuleMoveSnapCm('tulle-fabric'), 50);
});

test('drop dialog asks width and depth only', () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const start = source.indexOf('function requestTulleFabricDimensions');
  const end = source.indexOf('function requestIlluminatedFoamDimensions');
  const dialog = source.slice(start, end);
  assert.match(dialog, /Genişlik/);
  assert.match(dialog, /Derinlik/);
  assert.doesNotMatch(dialog, /Yükseklik|Kalınlık|opacity/i);
});

test('every tulle instance keeps the master thickness', () => {
  const state = createTulleFabricModuleState({
    itemKey: 'tulle_fabric',
    widthCm: 600,
    heightCm: 150,
    depthCm: 12,
  });
  assert.equal(state.widthCm, 600);
  assert.equal(state.heightCm, 150);
  assert.equal(state.depthCm, 0.4);
});

test('first placement uses item default Z', () => {
  const state = createTulleFabricModuleState({ itemKey: 'tulle_fabric', widthCm: 600, heightCm: 150 });
  const placement = applyItemPlacementZCm(state, { xCm: 100, yCm: 40, zCm: 0, rotationZDeg: 0, wallId: 'free' });
  assert.equal(placement.zCm, 350);
  assert.equal(placement.xCm, 100);
  assert.equal(placement.yCm, 40);
});

test('arrow Z steps come from moveSnapCm and leave the plan size alone', () => {
  const stepCm = getModuleMoveSnapCm('tulle-fabric');
  const thicknessCm = 0.4;
  const source = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  const start = source.indexOf("pressedKey !== 'arrowup' && pressedKey !== 'arrowdown'");
  const branch = source.slice(start - 80, start + 720);
  assert.match(branch, /getModulePlacementSnapCm\(moduleState\.type\)/);
  assert.match(branch, /stepTulleFabricZCm/);
  assert.match(branch, /moduleState\.depthCm/);
  assert.match(branch, /Tül bu yönde stand sınırına ulaştı/);
  assert.doesNotMatch(branch, /\b50\b/);
  assert.match(branch, /pressedKey !== 'arrowup' && pressedKey !== 'arrowdown'/);

  let zCm = 200;
  zCm = stepTulleFabricZCm(zCm, 'up', stepCm, thicknessCm);
  assert.equal(zCm, 250);
  zCm = stepTulleFabricZCm(zCm, 'up', stepCm, thicknessCm);
  assert.equal(zCm, 300);
  zCm = stepTulleFabricZCm(zCm, 'down', stepCm, thicknessCm);
  assert.equal(zCm, 250);
  assert.equal(stepTulleFabricZCm(200, 'up', 25, thicknessCm), 225);
});

test('tulle Z never lets the plate top pass the stand ceiling', () => {
  const ceilingCm = getStandDimensions().heightCm;
  const thicknessCm = 0.4;
  const maxZCm = ceilingCm - thicknessCm;
  assert.equal(clampFloorRelativeBottomZCm(ceilingCm + 80, thicknessCm), maxZCm);
  assert.equal(stepTulleFabricZCm(maxZCm, 'up', 50, thicknessCm), maxZCm);
  assert.equal(stepTulleFabricZCm(0, 'down', 50, thicknessCm), 0);
  // defaultZ 350 + kalınlık, tavan 350 iken sıkışır.
  assert.equal(clampFloorRelativeBottomZCm(350, thicknessCm), maxZCm);
});

test('600 by 150 is 9 m2 and is not also one piece', () => {
  const tulle = createTulleFabricModuleState({ itemKey: 'tulle_fabric', widthCm: 600, heightCm: 150 });
  const bom = resolveProjectBom([tulle]);
  const tulleLine = line(bom, 'tulle_fabric');
  assert.equal(tulleLine.name, 'Tül');
  assert.equal(tulleLine.quantity, 9);
  assert.equal(tulleLine.unit, 'metre_kare');
  assert.equal(bom.lines.filter((entry) => entry.itemKey === 'tulle_fabric').length, 1);
  assert.equal(bom.modules.find((entry) => entry.itemKey === 'tulle_fabric').lines.length, 0);
});

test('two plates aggregate onto one tulle_fabric square-metre line', () => {
  const first = createTulleFabricModuleState({ itemKey: 'tulle_fabric', widthCm: 600, heightCm: 150 });
  const second = createTulleFabricModuleState({ itemKey: 'tulle_fabric', widthCm: 300, heightCm: 200 });
  const bom = resolveProjectBom([first, second]);
  assert.equal(line(bom, 'tulle_fabric').quantity, 15);
  assert.equal(bom.lines.filter((entry) => entry.itemKey === 'tulle_fabric').length, 1);
});

test('existing production lines stay on their own item keys', () => {
  const printed = wall('images', [
    strip(0, { imageAssetId: 'asset-a', imageTransform: { mode: 'single' } }),
    strip(1, { imageAssetId: 'asset-b', imageTransform: { mode: 'single' } }),
  ]);
  const lightbox = wall('light', [0, 1, 2].map((row) => strip(row, {
    fabricGroupId: 'fabric-light',
    fabricType: 'lightbox',
    fabricImageAssetId: 'light-print',
  })));
  const mesh = wall('mesh', [0, 1].map((row) => strip(row, {
    fabricGroupId: 'fabric-mesh',
    fabricType: 'mesh',
    fabricImageAssetId: 'mesh-print',
  })));
  const foam = {
    id: 'foam',
    type: 'illuminated-foam',
    itemKey: 'illuminated-foam',
    widthCm: 80,
    heightCm: 40,
  };
  const tulle = createTulleFabricModuleState({ itemKey: 'tulle_fabric', widthCm: 600, heightCm: 150 });
  const snapshot = listRegisteredItems().map((item) => structuredClone(item));
  const present = new Set(snapshot.map((item) => item.itemKey));
  const extras = [
    { itemKey: 'digital_print', name: 'Dijital Baskı' },
    { itemKey: 'mesh_fabric', name: 'Mesh Baskı' },
    { itemKey: 'lightbox_fabric', name: 'Lightbox Bezi' },
  ].filter((item) => !present.has(item.itemKey)).map((item) => ({
    itemKey: item.itemKey,
    name: item.name,
    type: 'production',
    unit: 'metre_kare',
    catalogVisible: false,
    isRender: false,
    isActive: true,
    acceptsColor: false,
    acceptsImage: false,
    acceptsLightbox: false,
    acceptsGlass: false,
    acceptsMesh: false,
  }));
  if (extras.length) initializeItemRegistry([...snapshot, ...extras]);
  try {
    const before = resolveProjectBom([printed, lightbox, mesh, foam]);
    const after = resolveProjectBom([printed, lightbox, mesh, foam, tulle]);
    for (const itemKey of ['digital_print', 'mesh_fabric', 'lightbox_fabric', 'illuminated-foam']) {
      assert.equal(line(after, itemKey).quantity, line(before, itemKey).quantity, itemKey);
      assert.equal(line(after, itemKey).unit, 'metre_kare', itemKey);
    }
    assert.equal(line(after, 'tulle_fabric').quantity, 9);
  } finally {
    if (extras.length) initializeItemRegistry(snapshot);
  }
  const box = createBoxBlockModuleState({ itemKey: 'box_block', widthCm: 40, depthCm: 40, heightCm: 40 });
  const withBox = resolveProjectBom([box, tulle]);
  assert.equal(line(withBox, 'box_block').quantity, 1);
  assert.equal(line(withBox, 'box_block').unit, 'adet');
  assert.equal(line(withBox, 'tulle_fabric').quantity, 9);
});

test('save and load keep width, height, thickness, and Z', () => {
  const state = createTulleFabricModuleState({ itemKey: 'tulle_fabric', widthCm: 600, heightCm: 150 });
  state.placement = applyItemPlacementZCm(state, {
    xCm: 120,
    yCm: 80,
    zCm: 0,
    rotationZDeg: 0,
    wallId: 'free',
  });
  const thicknessCm = state.depthCm;
  state.placement = {
    ...state.placement,
    zCm: stepTulleFabricZCm(200, 'up', getModuleMoveSnapCm(state.type), thicknessCm),
  };
  const payload = JSON.parse(JSON.stringify({ stand: { widthCm: 600 }, modules: [state] }));
  const loaded = payload.modules[0];
  loaded.depthCm = 8;
  loaded.placement.zCm = getStandDimensions().heightCm + 120;
  normalizeModuleItemState(loaded);
  assert.equal(loaded.widthCm, 600);
  assert.equal(loaded.heightCm, 150);
  assert.equal(loaded.depthCm, 0.4);
  assert.equal(loaded.placement.zCm, getStandDimensions().heightCm - loaded.depthCm);
  assert.equal(loaded.placement.xCm, 120);
  assert.equal(loaded.placement.yCm, 80);
});
