import test from 'node:test';
import assert from 'node:assert/strict';

import { groupBomLines } from '../src/bomLineGroups.js';
import { createModuleStateFromCatalogKey, normalizeModuleItemState } from '../src/designState.js';
import { initializeItemRegistry, listRegisteredItems } from '../src/items.js';
import { collectPrintAreas } from '../src/printAreaBom.js';
import { resolveProjectBom } from '../src/projectBom.js';
import { formatProductionBomText } from '../src/productionBomPanel.js';

const PRODUCTION_ITEMS = [
  { itemKey: 'digital_print', name: 'Dijital Baskı' },
  { itemKey: 'mesh_fabric', name: 'Mesh Baskı' },
  { itemKey: 'lightbox_fabric', name: 'Lightbox Bezi' },
];

function withProductionItems(run) {
  const snapshot = listRegisteredItems().map((item) => structuredClone(item));
  const present = new Set(snapshot.map((item) => item.itemKey));
  const extras = PRODUCTION_ITEMS
    .filter((item) => !present.has(item.itemKey))
    .map((item) => ({
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
    return run();
  } finally {
    if (extras.length) initializeItemRegistry(snapshot);
  }
}

const PANEL_BY_MODULE_WIDTH = {
  50: { itemKey: 'panel_48_5', widthCm: 48.5, heightCm: 47 },
  100: { itemKey: 'panel_98', widthCm: 98, heightCm: 47 },
  150: { itemKey: 'panel_147_5', widthCm: 147.5, heightCm: 47 },
  200: { itemKey: 'panel_197', widthCm: 197, heightCm: 47 },
};

function strip(stripIndex, extra = {}) {
  return { stripIndex, ...extra };
}

function wall(id, widthCm, strips) {
  const panel = PANEL_BY_MODULE_WIDTH[widthCm];
  return {
    id,
    type: 'flat-panel',
    itemKey: widthCm === 100 ? 'wall_100_350' : 'wall_200_350',
    widthCm,
    strips: strips.map((row) => ({ ...panel, ...row })),
  };
}

function rectCell(stripIndex, column, row, columns, rows) {
  return strip(stripIndex, {
    imageAssetId: 'asset-rect',
    imageTransform: {
      mode: 'rect-group',
      regionStartX: column / columns,
      regionWidth: 1 / columns,
      regionStartY: row / rows,
      regionHeight: 1 / rows,
    },
  });
}

function section(areas, id) {
  return areas.find((entry) => entry.id === id) ?? null;
}

test('print size uses scene dimensions per field and item dimensions when that field is empty', () => {
  const snapshot = listRegisteredItems().map((item) => structuredClone(item));
  try {
    const next = snapshot.map((item) => structuredClone(item));
    const panel = next.find((item) => item.itemKey === 'panel_48_5');
    panel.sceneDimensions = { ...(panel.sceneDimensions ?? {}), widthCm: 40 };
    initializeItemRegistry(next);
    const overridden = section(collectPrintAreas([{
      id: 'scene',
      strips: [{
        stripIndex: 0,
        itemKey: 'panel_48_5',
        widthCm: 48.5,
        heightCm: 47,
        imageAssetId: 'asset-a',
      }],
    }]), 'image');
    assert.equal(overridden.lines[0].widthCm, 40);
    assert.equal(overridden.lines[0].heightCm, 47);
  } finally {
    initializeItemRegistry(snapshot);
  }

  const fromItem = section(collectPrintAreas([{
    id: 'item',
    strips: [{
      stripIndex: 0,
      itemKey: 'panel_48_5',
      widthCm: 1,
      heightCm: 1,
      imageAssetId: 'asset-a',
    }],
  }]), 'image');
  assert.equal(fromItem.lines[0].widthCm, 48.5);
  assert.equal(fromItem.lines[0].heightCm, 47);
});

test('a wall strip uses the catalog panel size, not the 50 cm band', () => {
  const moduleState = createModuleStateFromCatalogKey('wall_50_350');
  moduleState.strips[0].imageAssetId = 'asset-a';
  const images = section(collectPrintAreas([moduleState]), 'image');
  assert.equal(images.lines.length, 1);
  assert.equal(images.lines[0].widthCm, 48.5);
  assert.equal(images.lines[0].heightCm, 47);
  assert.equal(images.lines[0].areaM2, 0.22795);
});

test('a single printed panel uses the catalog panel size', () => {
  const strips = [
    strip(0, { imageAssetId: 'asset-a', imageTransform: { mode: 'single' } }),
    strip(1),
  ];
  const areas = collectPrintAreas([wall('a', 100, strips)]);
  const images = section(areas, 'image');
  assert.equal(areas.length, 1);
  assert.equal(images.lines.length, 1);
  assert.equal(images.lines[0].quantity, 1);
  assert.equal(images.lines[0].widthCm, 98);
  assert.equal(images.lines[0].heightCm, 47);
  assert.equal(images.lines[0].areaM2, 0.4606);
  assert.equal(images.label, 'Dijital Baskı');
  assert.equal(images.lines[0].name, 'Görsel');
  assert.equal(images.lines[0].subjectId, 'asset-a');
  assert.equal(images.totalAreaM2, 0.4606);
});

test('a 2×3 panel image is one piece at the catalog panel size', () => {
  const modules = [0, 1].map((column) => wall(
    `m${column}`,
    100,
    [0, 1, 2].map((row) => rectCell(row, column, row, 2, 3)),
  ));
  const images = section(collectPrintAreas(modules), 'image');
  assert.equal(images.lines.length, 1);
  assert.equal(images.lines[0].quantity, 1);
  assert.equal(images.lines[0].widthCm, 196);
  assert.equal(images.lines[0].heightCm, 141);
  assert.equal(images.lines[0].areaM2, 2.7636);
  assert.equal(images.totalAreaM2, 2.7636);
});

test('the same image at the same size shares one quantity line', () => {
  const one = wall('a', 100, [
    strip(0, { imageAssetId: 'asset-a', imageTransform: { mode: 'single' } }),
  ]);
  const two = wall('b', 100, [
    strip(0, { imageAssetId: 'asset-a', imageTransform: { mode: 'single' } }),
  ]);
  const images = section(collectPrintAreas([one, two], new Map([['asset-a', 'logo.png']])), 'image');
  assert.equal(images.lines.length, 1);
  assert.equal(images.lines[0].name, 'logo.png');
  assert.equal(images.lines[0].quantity, 2);
  assert.equal(images.lines[0].widthCm, 98);
  assert.equal(images.lines[0].heightCm, 47);
  assert.equal(images.lines[0].areaM2, 0.4606);
  assert.equal(images.lines[0].totalAreaM2, 0.9212);
  assert.equal(images.totalAreaM2, 0.9212);
});

test('different images at the same size stay separate lines', () => {
  const one = wall('a', 100, [
    strip(0, { imageAssetId: 'asset-a', imageTransform: { mode: 'single' } }),
  ]);
  const two = wall('b', 100, [
    strip(0, { imageAssetId: 'asset-b', imageTransform: { mode: 'single' } }),
  ]);
  const images = section(collectPrintAreas([one, two]), 'image');
  assert.equal(images.lines.length, 2);
  assert.equal(images.lines[0].quantity, 1);
  assert.equal(images.lines[1].quantity, 1);
  assert.equal(images.lines[0].widthCm, 98);
  assert.equal(images.lines[0].heightCm, 47);
  assert.equal(images.lines[0].areaM2, 0.4606);
  assert.equal(images.totalAreaM2, 0.9212);
  assert.deepEqual(images.lines.map((line) => line.subjectId).sort(), ['asset-a', 'asset-b']);
});

test('the same image at two sizes stays on two lines and keeps one m² total', () => {
  function stacked(widthCm, rows, assetId) {
    return wall(`w${widthCm}`, widthCm, Array.from({ length: rows }, (_, row) => strip(row, {
      imageAssetId: assetId,
      imageTransform: {
        mode: 'rect-group',
        regionStartX: 0,
        regionWidth: 1,
        regionStartY: row / rows,
        regionHeight: 1 / rows,
      },
    })));
  }
  const wide = stacked(200, 4, 'asset-a');
  const narrow = stacked(150, 2, 'asset-a');
  const names = new Map([['asset-a', 'logo.png']]);
  const images = section(collectPrintAreas([wide, narrow], names), 'image');
  assert.equal(images.lines.length, 2);
  assert.equal(images.lines[0].name, 'logo.png');
  assert.equal(images.lines[0].widthCm, 197);
  assert.equal(images.lines[0].heightCm, 188);
  assert.equal(images.lines[0].areaM2, 3.7036);
  assert.equal(images.lines[1].widthCm, 147.5);
  assert.equal(images.lines[1].heightCm, 94);
  assert.equal(images.lines[1].areaM2, 1.3865);
  assert.equal(images.totalAreaM2, 5.0901);
  const text = withProductionItems(() => (
    formatProductionBomText(resolveProjectBom([wide, narrow], null, names))
  ));
  assert.match(text, /logo\.png · 1 × 197×188 cm · 3,70 m²/);
  assert.match(text, /logo\.png · 1 × 147,5×94 cm · 1,39 m²/);
  assert.match(text, /logo\.png toplam 5,09 m²/);
  assert.match(text, /Toplam 5,09 m²/);
});

test('adjacent rect groups stay separate pieces when their regions restart', () => {
  const first = [0, 1].map((column) => wall(
    `a${column}`,
    100,
    [rectCell(0, column, 0, 2, 1)],
  ));
  const second = [0, 1].map((column) => wall(
    `b${column}`,
    100,
    [strip(0, {
      imageAssetId: 'asset-rect',
      imageTransform: {
        mode: 'rect-group',
        regionStartX: column / 2,
        regionWidth: 1 / 2,
        regionStartY: 0,
        regionHeight: 1,
      },
    })],
  ));
  const images = section(collectPrintAreas([...first, ...second]), 'image');
  assert.equal(images.lines[0].quantity, 2);
  assert.equal(images.lines[0].widthCm, 196);
  assert.equal(images.lines[0].heightCm, 47);
  assert.equal(images.totalAreaM2, 1.8424);
});

test('lightbox and mesh are separate pieces and their print is not also an image', () => {
  const lightbox = wall('light', 100, [0, 1, 2].map((row) => strip(row, {
    imageAssetId: 'printed-on-fabric',
    fabricGroupId: 'fabric-light',
    fabricType: 'lightbox',
  })));
  const mesh = wall('mesh', 200, [0, 1].map((row) => strip(row, {
    fabricGroupId: 'fabric-mesh',
    fabricType: 'mesh',
    fabricImageAssetId: 'mesh-print',
  })));
  const areas = collectPrintAreas([lightbox, mesh]);
  assert.equal(section(areas, 'image'), null);
  const light = section(areas, 'lightbox');
  const meshSection = section(areas, 'mesh');
  assert.equal(light.label, 'Lightbox Bezi');
  assert.equal(meshSection.label, 'Mesh - Delikli Branda');
  assert.equal(light.lines[0].widthCm, 98);
  assert.equal(light.lines[0].heightCm, 141);
  assert.equal(light.lines[0].areaM2, 1.3818);
  assert.equal(meshSection.lines[0].widthCm, 197);
  assert.equal(meshSection.lines[0].heightCm, 94);
  assert.equal(meshSection.lines[0].areaM2, 1.8518);
  assert.equal(meshSection.lines[0].name, 'Görsel');
  assert.equal(meshSection.lines[0].subjectId, 'mesh-print');
});

test('a colored lightbox is named by its hex and is not an image line', () => {
  const lightbox = wall('light', 100, [0, 1].map((row) => strip(row, {
    fabricGroupId: 'fabric-light',
    fabricType: 'lightbox',
    fabricColor: '#E11D48',
  })));
  const areas = collectPrintAreas([lightbox]);
  assert.equal(section(areas, 'image'), null);
  const light = section(areas, 'lightbox');
  assert.equal(light.lines[0].name, '#e11d48');
  assert.equal(light.lines[0].widthCm, 98);
  assert.equal(light.lines[0].heightCm, 94);
  assert.equal(light.lines[0].areaM2, 0.9212);
});

test('styrofoam logos use width × height and ignore thickness', () => {
  const areas = collectPrintAreas([
    { id: 'f1', type: 'illuminated-foam', itemKey: 'illuminated-foam', widthCm: 80, heightCm: 40, depthCm: 3 },
    { id: 'f2', itemKey: 'illuminated-foam', widthCm: 80, heightCm: 40, depthCm: 3 },
    { id: 'f3', type: 'illuminated-foam', widthCm: 200, heightCm: 150, depthCm: 3 },
  ]);
  const foam = section(areas, 'foam');
  assert.equal(foam.label, 'Işıklı Strafor / Logo');
  assert.equal(foam.lines.length, 2);
  assert.equal(foam.lines[0].widthCm, 200);
  assert.equal(foam.lines[0].heightCm, 150);
  assert.equal(foam.lines[0].quantity, 1);
  assert.equal(foam.lines[0].areaM2, 3);
  assert.equal(foam.lines[1].quantity, 2);
  assert.equal(foam.lines[1].widthCm, 80);
  assert.equal(foam.lines[1].heightCm, 40);
  assert.equal(foam.lines[1].areaM2, 0.32);
  assert.equal(foam.lines[1].totalAreaM2, 0.64);
  assert.equal(foam.totalAreaM2, 3.64);
});

test('two identical strafor logos keep the detail total and bind that total to illuminated-foam', () => {
  const names = new Map([['logo', '000_kyrox-letter.svg']]);
  const modules = [0, 1].map((index) => ({
    id: `foam-${index}`,
    type: 'illuminated-foam',
    itemKey: 'illuminated-foam',
    widthCm: 200,
    heightCm: 56,
    imageAssetId: 'logo',
  }));
  const foam = section(collectPrintAreas(modules, names), 'foam');
  assert.equal(foam.lines.length, 1);
  assert.equal(foam.lines[0].name, '000_kyrox-letter.svg');
  assert.equal(foam.lines[0].quantity, 2);
  assert.equal(foam.lines[0].widthCm, 200);
  assert.equal(foam.lines[0].heightCm, 56);
  assert.equal(foam.lines[0].areaM2, 1.12);
  assert.equal(foam.lines[0].totalAreaM2, 2.24);
  assert.equal(foam.totalAreaM2, 2.24);
  withProductionItems(() => {
    const bom = resolveProjectBom(modules, null, names);
    const line = bom.lines.find((entry) => entry.itemKey === 'illuminated-foam');
    assert.equal(line.quantity, foam.totalAreaM2);
    assert.equal(line.quantity, 2.24);
    assert.equal(line.unit, 'metre_kare');
    assert.equal(line.name, 'Işıklı Strafor / Logo');
    assert.equal(bom.lines.filter((entry) => entry.itemKey === 'digital_print').length, 0);
    assert.equal(bom.lines.filter((entry) => entry.itemKey === 'mesh_fabric').length, 0);
    assert.equal(bom.lines.filter((entry) => entry.itemKey === 'lightbox_fabric').length, 0);
    assert.equal(bom.lines.filter((entry) => entry.itemKey === 'illuminated-foam').length, 1);
    assert.equal(bom.unresolved.some((entry) => entry.itemKey === 'illuminated-foam'), false);
    const text = formatProductionBomText(bom);
    assert.match(text, /000_kyrox-letter\.svg · 2 × 200×56 cm · 1,12 m² · toplam 2,24 m²/);
    assert.match(text, /Toplam 2,24 m²/);
  });
});

test('counter and base faces and the door leaf join the print list at their own panel size', () => {
  const banko = {
    id: 'banko',
    type: 'counter',
    widthCm: 100,
    heightCm: 100,
    faces: {
      frontLower: {
        widthCm: 98,
        heightCm: 47,
        imageAssetId: 'logo',
        imageTransform: {
          mode: 'rect-group',
          regionStartX: 0,
          regionStartY: 0,
          regionWidth: 1,
          regionHeight: 0.5,
        },
      },
      frontUpper: {
        widthCm: 98,
        heightCm: 47,
        imageAssetId: 'logo',
        imageTransform: {
          mode: 'rect-group',
          regionStartX: 0,
          regionStartY: 0.5,
          regionWidth: 1,
          regionHeight: 0.5,
        },
      },
      leftLower: {
        widthCm: 48.5,
        heightCm: 47,
        fabricGroupId: 'banko-mesh',
        fabricType: 'mesh',
        fabricImageAssetId: 'mesh-logo',
      },
      leftUpper: { widthCm: 48.5, heightCm: 47 },
      rightLower: {
        widthCm: 48.5,
        heightCm: 47,
        fabricGroupId: 'banko-light',
        fabricType: 'lightbox',
        fabricColor: '#112233',
      },
      rightUpper: {
        widthCm: 48.5,
        heightCm: 47,
        fabricGroupId: 'banko-light',
        fabricType: 'lightbox',
        fabricColor: '#112233',
      },
    },
  };
  const base = {
    id: 'base',
    type: 'base',
    widthCm: 100,
    faces: {
      front: { widthCm: 98, heightCm: 47, imageAssetId: 'logo' },
      left: { widthCm: 48.5, heightCm: 47 },
      right: { widthCm: 48.5, heightCm: 47 },
    },
  };
  const door = {
    id: 'door',
    type: 'door',
    widthCm: 100,
    heightCm: 350,
    strips: [strip(0, { itemKey: 'panel_98', imageAssetId: 'wall-logo' })],
    surface: { itemKey: 'door_leaf_100', imageAssetId: 'leaf-logo' },
  };
  const areas = collectPrintAreas([banko, base, door], new Map([
    ['logo', 'logo.png'],
    ['mesh-logo', 'mesh.png'],
    ['leaf-logo', 'kapi.png'],
    ['wall-logo', 'serit.png'],
  ]));
  const images = section(areas, 'image');
  const mesh = section(areas, 'mesh');
  const light = section(areas, 'lightbox');
  const byName = (lines, name) => lines.find((line) => line.name === name);
  assert.equal(byName(images.lines, 'logo.png').widthCm, 98);
  assert.equal(byName(images.lines, 'logo.png').heightCm, 94);
  assert.equal(byName(images.lines, 'logo.png').quantity, 1);
  assert.equal(byName(images.lines, 'logo.png').areaM2, 0.9212);
  const baseLine = images.lines.find((line) => line.name === 'logo.png' && line.heightCm === 47);
  assert.equal(baseLine.widthCm, 98);
  assert.equal(baseLine.quantity, 1);
  assert.equal(byName(images.lines, 'kapi.png').widthCm, 100);
  assert.equal(byName(images.lines, 'kapi.png').heightCm, 200);
  assert.equal(byName(images.lines, 'serit.png').widthCm, 98);
  assert.equal(byName(images.lines, 'serit.png').heightCm, 47);
  assert.equal(mesh.lines[0].name, 'mesh.png');
  assert.equal(mesh.lines[0].widthCm, 48.5);
  assert.equal(mesh.lines[0].heightCm, 47);
  assert.equal(light.lines[0].name, '#112233');
  assert.equal(light.lines[0].widthCm, 48.5);
  assert.equal(light.lines[0].heightCm, 94);
});

test('the same image on two separate counter faces stays two pieces of that face size', () => {
  const banko = {
    id: 'banko',
    type: 'counter',
    faces: {
      leftLower: { widthCm: 48.5, heightCm: 47, imageAssetId: 'logo' },
      rightLower: { widthCm: 48.5, heightCm: 47, imageAssetId: 'logo' },
    },
  };
  const images = section(collectPrintAreas([banko], new Map([['logo', 'logo.png']])), 'image');
  assert.equal(images.lines.length, 1);
  assert.equal(images.lines[0].quantity, 2);
  assert.equal(images.lines[0].widthCm, 48.5);
  assert.equal(images.lines[0].heightCm, 47);
});

test('project BOM carries print areas without adding them to hardware lines', () => {
  const bom = resolveProjectBom([]);
  assert.deepEqual(bom.printAreas, []);
  assert.deepEqual(bom.lines, []);
});

test('print section totals become production leaves and the detail table stays', () => {
  const printed = wall('images', 100, [
    strip(0, { imageAssetId: 'asset-a', imageTransform: { mode: 'single' } }),
    strip(1, { imageAssetId: 'asset-b', imageTransform: { mode: 'single' } }),
  ]);
  const lightbox = wall('light', 100, [0, 1, 2].map((row) => strip(row, {
    fabricGroupId: 'fabric-light',
    fabricType: 'lightbox',
    fabricImageAssetId: 'light-print',
  })));
  const mesh = wall('mesh', 200, [0, 1].map((row) => strip(row, {
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
  withProductionItems(() => {
    const bom = resolveProjectBom([printed, lightbox, mesh, foam]);
    const image = section(bom.printAreas, 'image');
    const light = section(bom.printAreas, 'lightbox');
    const meshSection = section(bom.printAreas, 'mesh');
    const foamSection = section(bom.printAreas, 'foam');
    assert.equal(image.totalAreaM2, 0.9212);
    assert.equal(light.totalAreaM2, 1.3818);
    assert.equal(meshSection.totalAreaM2, 1.8518);
    assert.equal(foamSection.totalAreaM2, 0.32);

    const material = (itemKey) => bom.lines.find((line) => line.itemKey === itemKey);
    const digital = material('digital_print');
    const fabric = material('lightbox_fabric');
    const meshLine = material('mesh_fabric');
    assert.equal(digital.name, 'Dijital Baskı');
    assert.equal(digital.quantity, image.totalAreaM2);
    assert.equal(digital.unit, 'metre_kare');
    assert.equal(fabric.name, 'Lightbox Bezi');
    assert.equal(fabric.quantity, light.totalAreaM2);
    assert.equal(fabric.unit, 'metre_kare');
    assert.equal(meshLine.name, 'Mesh Baskı');
    assert.equal(meshLine.quantity, meshSection.totalAreaM2);
    assert.equal(meshLine.unit, 'metre_kare');
    const foamLine = material('illuminated-foam');
    assert.equal(foamLine.name, 'Işıklı Strafor / Logo');
    assert.equal(foamLine.quantity, foamSection.totalAreaM2);
    assert.equal(foamLine.unit, 'metre_kare');
    assert.equal(bom.lines.filter((line) => line.itemKey === 'digital_print').length, 1);
    assert.equal(bom.lines.filter((line) => line.itemKey === 'illuminated-foam').length, 1);
    assert.equal(image.lines.length, 2);
    assert.equal(groupBomLines([digital, fabric, meshLine]).map((group) => group.id).join(','), 'production');
  });
});

test('a wall recipe stays intact when its print area becomes digital_print', () => {
  const moduleState = createModuleStateFromCatalogKey('wall_100_350');
  moduleState.strips[0].imageAssetId = 'asset-a';
  withProductionItems(() => {
    const bom = resolveProjectBom([moduleState]);
    const panels = bom.lines.find((line) => line.itemKey === 'panel_98');
    const digital = bom.lines.find((line) => line.itemKey === 'digital_print');
    const image = section(bom.printAreas, 'image');
    assert.equal(panels.quantity, 7);
    assert.equal(panels.unit, 'adet');
    assert.equal(digital.quantity, image.totalAreaM2);
    assert.equal(digital.quantity, 0.4606);
    assert.equal(digital.unit, 'metre_kare');
    assert.equal(bom.lines.filter((line) => line.itemKey === 'digital_print').length, 1);
  });
});

test('an imported strip without a panel identity takes it from the parent recipe', () => {
  const wall = normalizeModuleItemState({
    id: 'old-wall',
    type: 'flat-panel',
    itemKey: 'wall_50_350',
    widthCm: 50,
    heightCm: 350,
    strips: [
      {
        id: 's0',
        color: '#112233',
        stripIndex: 0,
        imageAssetId: 'mavi',
        imageTransform: { mode: 'single' },
      },
      {
        id: 's1',
        color: '#112233',
        stripIndex: 1,
        imageAssetId: 'gvn',
        fabricGroupId: 'group-1',
        fabricType: 'lightbox',
        fabricImageAssetId: 'gvn',
      },
    ],
  });
  assert.equal(wall.strips[0].itemKey, 'panel_48_5');
  assert.equal(wall.strips[0].widthCm, 48.5);
  assert.equal(wall.strips[0].heightCm, 47);
  assert.equal(wall.strips[0].imageAssetId, 'mavi');
  assert.equal(wall.strips[0].color, '#112233');
  assert.equal(wall.strips[1].fabricGroupId, 'group-1');
  assert.equal(wall.strips[1].fabricType, 'lightbox');
  assert.equal(wall.strips[1].fabricImageAssetId, 'gvn');

  const kept = normalizeModuleItemState({
    id: 'kept',
    type: 'flat-panel',
    itemKey: 'wall_50_350',
    strips: [{ id: 's', stripIndex: 0, itemKey: 'panel_98', imageAssetId: 'keep' }],
  });
  assert.equal(kept.strips[0].itemKey, 'panel_98');
  assert.equal(kept.strips[0].imageAssetId, 'keep');

  const door = normalizeModuleItemState({
    id: 'old-door',
    type: 'door',
    itemKey: 'wall_door_100_350',
    strips: [{
      id: 's4',
      stripIndex: 4,
      color: '#abcdef',
      imageAssetId: 'gvn-mesh',
      fabricGroupId: 'mesh-1',
      fabricType: 'mesh',
      fabricImageAssetId: 'gvn-mesh',
    }],
    surface: {
      id: 'leaf',
      color: '#123456',
      imageAssetId: 'leaf-art',
      imageTransform: { mode: 'single' },
    },
  });
  assert.equal(door.strips[0].itemKey, 'panel_98');
  assert.equal(door.strips[0].widthCm, 98);
  assert.equal(door.strips[0].heightCm, 47);
  assert.equal(door.strips[0].color, '#abcdef');
  assert.equal(door.strips[0].fabricType, 'mesh');
  assert.equal(door.surface.color, '#123456');
  assert.equal(door.surface.imageAssetId, 'leaf-art');

  withProductionItems(() => {
    const bom = resolveProjectBom([wall, door]);
    const image = section(bom.printAreas, 'image');
    const light = section(bom.printAreas, 'lightbox');
    const mesh = section(bom.printAreas, 'mesh');
    const mavi = image.lines.find((line) => line.subjectId === 'mavi');
    assert.equal(mavi.widthCm, 48.5);
    assert.equal(mavi.heightCm, 47);
    assert.equal(light.lines.find((line) => line.subjectId === 'gvn').widthCm, 48.5);
    assert.equal(mesh.lines.find((line) => line.subjectId === 'gvn-mesh').widthCm, 98);
    assert.equal(mesh.lines.find((line) => line.subjectId === 'gvn-mesh').heightCm, 47);
    assert.equal(bom.lines.find((line) => line.itemKey === 'digital_print').quantity, image.totalAreaM2);
    assert.equal(bom.lines.find((line) => line.itemKey === 'lightbox_fabric').quantity, light.totalAreaM2);
    assert.equal(bom.lines.find((line) => line.itemKey === 'mesh_fabric').quantity, mesh.totalAreaM2);
  });
});

test('aynı görseli kullanan bağımsız kopya bloklar baskıda iki ayrı parça sayılır', () => {
  const modules = ['source', 'copy'].map(blockId => ({ id: blockId, type: 'box-block', faces: Object.fromEntries([0, 1].map(index => [index, {
    widthCm: 100, heightCm: 50, imageAssetId: 'same-logo', imageTransform: { mode: 'size-group', blockId,
      regionStartX: index / 2, regionWidth: 0.5, regionStartY: 0, regionHeight: 1 },
  }])) }));
  const print = section(collectPrintAreas(modules), 'image');
  assert.equal(print.lines.length, 1);
  assert.equal(print.lines[0].widthCm, 200);
  assert.equal(print.lines[0].heightCm, 50);
  assert.equal(print.lines[0].quantity, 2);
  assert.equal(print.totalAreaM2, 2);
});
