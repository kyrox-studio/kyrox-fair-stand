import test from 'node:test';
import assert from 'node:assert/strict';

import { createModuleStateFromDescriptor } from '../src/designState.js';
import { getItem, initializeItemRegistry, listRegisteredItems } from '../src/items.js';
import { createModulePlacement } from '../src/modulePlacement.js';
import {
  classifyPanelSurface,
  formatPanelAssignmentRow,
  formatPanelSceneLabel,
  formatPanelSizeHeading,
  formatPanelSubjectRow,
  groupPanelRowsBySize,
} from '../src/panelAssignmentBom.js';
import { resolveProjectBom } from '../src/projectBom.js';

// ROADMAP "Panellerin atamaya göre dökümü": görsel / renk / varsayılan; ölçü BOM'daki panelden.
function withPrintItem(run) {
  const snapshot = listRegisteredItems().map((item) => structuredClone(item));
  if (!snapshot.some((item) => item.itemKey === 'digital_print')) {
    initializeItemRegistry([...snapshot, {
      itemKey: 'digital_print',
      name: 'Dijital Baskı',
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
    }]);
  }
  try {
    return run();
  } finally {
    initializeItemRegistry(snapshot);
  }
}

function wall(id, xCm, yCm, rotationZDeg, itemKey = 'wall_200_350') {
  const module = createModuleStateFromDescriptor({ itemKey, type: getItem(itemKey).type });
  module.id = id;
  module.placement = createModulePlacement({ xCm, yCm, rotationZDeg });
  return module;
}

function rows(bom, id) {
  return bom.panelAssignments.groups.find((group) => group.id === id).rows.map(formatPanelAssignmentRow);
}

test('düz duvar: görsel, renk ve varsayılan paneller ölçü başına sayılır', () => withPrintItem(() => {
  const a = wall('a', 0, 0, 0);
  a.strips[0].imageAssetId = 'img-3';
  a.strips[1].imageAssetId = 'img-3';
  a.strips[2].color = '#C0392B';
  const bom = resolveProjectBom([a], null, new Map([['img-3', '3.jpeg']]));
  assert.deepEqual(rows(bom, 'image'), ['3.jpeg · 197 × 47 cm · 2 panel']);
  assert.deepEqual(rows(bom, 'color'), ['#c0392b · 197 × 47 cm · 1 panel']);
  assert.deepEqual(rows(bom, 'default'), ['197 × 47 cm · 4 panel']);
  assert.equal(bom.panelAssignments.total, 7);
  const panelLine = bom.lines.find((line) => line.itemKey === 'panel_197');
  assert.equal(panelLine.quantity, bom.panelAssignments.total);
}));

test('iç köşede panel ölçüsü köşe kuralından gelir (197 → 192)', () => withPrintItem(() => {
  const a = wall('a', 300, 0, 0);
  const b = wall('b', 500, 0, 270);
  a.strips[0].imageAssetId = 'img-3';
  b.strips[0].color = '#ff0000';
  const bom = resolveProjectBom([a, b], null, new Map([['img-3', '3.jpeg']]));
  assert.deepEqual(rows(bom, 'image'), ['3.jpeg · 192 × 47 cm · 1 panel']);
  assert.deepEqual(rows(bom, 'color'), ['#ff0000 · 192 × 47 cm · 1 panel']);
  assert.deepEqual(rows(bom, 'default'), ['192 × 47 cm · 12 panel']);
  const corner = bom.lines.find((line) => line.itemKey === 'panel_corner_192');
  assert.equal(corner.quantity, 14);
}));

test('görsel satırları önce panel ölçüsüne göre dizilir; aynı ölçüler alt alta gelir', () => withPrintItem(() => {
  const a = wall('a', 300, 0, 0);
  const b = wall('b', 500, 0, 270);
  const flat = wall('c', 0, 300, 0);
  // Köşedeki iki duvar 192, ayrı duvar 197 sayılır; görsel adları ölçülerin tersine sıralı.
  a.strips[0].imageAssetId = 'z';
  flat.strips[0].imageAssetId = 'z';
  flat.strips[1].imageAssetId = 'a';
  b.strips[0].imageAssetId = 'a';
  const bom = resolveProjectBom([a, b, flat], null, new Map([['a', 'ASKA LOGO.jpg'], ['z', 'ZEMIN.jpg']]));
  assert.deepEqual(rows(bom, 'image'), [
    'ASKA LOGO.jpg · 197 × 47 cm · 1 panel',
    'ZEMIN.jpg · 197 × 47 cm · 1 panel',
    'ASKA LOGO.jpg · 192 × 47 cm · 1 panel',
    'ZEMIN.jpg · 192 × 47 cm · 1 panel',
  ]);
}));

test('ölçü başlığı altında gruplanır: aynı ölçüdeki görseller tek başlıkta toplanır', () => {
  const sizes = groupPanelRowsBySize([
    { assetName: '01.jpg', color: null, widthCm: 197, heightCm: 47, quantity: 1 },
    { assetName: 'ASKA LOGO.jpg', color: null, widthCm: 197, heightCm: 47, quantity: 3 },
    { assetName: 'ELMER LOGO.jpg', color: null, widthCm: 192, heightCm: 47, quantity: 2 },
  ]);
  assert.deepEqual(sizes.map(formatPanelSizeHeading), ['197 × 47 cm · 4 panel', '192 × 47 cm · 2 panel']);
  assert.deepEqual(sizes[0].rows.map(formatPanelSubjectRow), ['01.jpg · 1 panel', 'ASKA LOGO.jpg · 3 panel']);
  assert.deepEqual(sizes[1].rows.map(formatPanelSubjectRow), ['ELMER LOGO.jpg · 2 panel']);
});

test('Mesh / Lightbox, cam, metal separatör ve kaldırılmış panel sayılmaz', () => {
  const base = { id: 's', itemKey: 'panel_98', color: '#ffffff' };
  assert.equal(classifyPanelSurface({ ...base, fabricGroupId: 'g1', fabricType: 'mesh' }), null);
  assert.equal(classifyPanelSurface({ ...base, isGlass: true }), null);
  assert.equal(classifyPanelSurface({ ...base, isMetalSeparator: true }), null);
  assert.equal(classifyPanelSurface({ ...base, removed: true }), null);
  assert.equal(classifyPanelSurface({ ...base, itemKey: 'separator_panel_98' }), null);
  assert.equal(classifyPanelSurface(base).group, 'default');
  assert.equal(classifyPanelSurface({ ...base, color: '#FFF' }).group, 'default');
});

test('sahne etiketi kısa: genişlik ile görsel adı / renk / Varsayılan / Depo içi', () => {
  const base = { id: 's', itemKey: 'panel_corner_92', color: '#ffffff' };
  assert.equal(formatPanelSceneLabel(classifyPanelSurface(base)), '92 · Varsayılan');
  assert.equal(formatPanelSceneLabel(classifyPanelSurface({ ...base, color: '#123abc' })), '92 · #123abc');
  assert.equal(
    formatPanelSceneLabel(classifyPanelSurface({ ...base, imageAssetId: 'x' }, { x: 'logo.png' })),
    '92 · logo.png',
  );
  assert.equal(formatPanelSceneLabel(classifyPanelSurface({ ...base, itemKey: 'panel_48_5' })), '48,5 · Varsayılan');
  assert.equal(formatPanelSceneLabel(classifyPanelSurface({ ...base, depotInner: true })), '92 · Depo içi');
});
