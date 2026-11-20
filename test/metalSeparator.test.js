import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { getItem } from '../src/items.js';
import { resolveProjectBom } from '../src/projectBom.js';
import { formatProductionBomText } from '../src/productionBomPanel.js';
import { duplicateModuleState } from '../src/designState.js';

function qty(lines, itemKey) {
  const line = lines.find((entry) => entry.itemKey === itemKey);
  return line ? line.quantity : 0;
}

// Metal separatör ölçüsü panelin sahne ölçüsünden (kesim payı; 2026-11-20), alan boşsa Item ölçüsünden.
const PANEL = getItem('panel_197');
const W = PANEL.sceneDimensions?.widthCm ?? PANEL.dimensions.widthCm;
const H = PANEL.sceneDimensions?.heightCm ?? PANEL.dimensions.heightCm;
const cm = (value) => String(value).replace('.', ',');

function wall(strips) {
  return {
    id: 'wall',
    itemKey: 'wall_200_350',
    type: 'flat-panel',
    strips,
  };
}

test('metal separator is a hidden square-metre item that can take a price', () => {
  const item = getItem('metal_separator');
  assert.equal(item.name, 'Metal Separatör');
  assert.equal(item.type, 'panel-glass');
  assert.equal(item.unit, 'metre_kare');
  assert.equal(item.catalogVisible, false);
  assert.equal(item.isCostEnabled, true);
  assert.equal(item.isRender, false);
});

test('one ctrl group is a single width by height, priced in square metres', () => {
  const strips = Array.from({ length: 7 }, (_, index) => ({
    itemKey: 'panel_197',
    isMetalSeparator: index < 2,
    metalSeparatorGroupId: index < 2 ? 'group-a' : null,
    stripIndex: index,
  }));
  const bom = resolveProjectBom([wall(strips)]);
  const metal = bom.lines.find((entry) => entry.itemKey === 'metal_separator');
  const section = bom.printAreas.find((entry) => entry.id === 'metal');
  assert.equal(qty(bom.lines, 'panel_197'), 5);
  assert.equal(qty(bom.lines, 'panel_cam_197'), 0);
  assert.equal(section.lines.length, 1);
  assert.equal(section.lines[0].widthCm, W);
  assert.equal(section.lines[0].heightCm, 2 * H);
  assert.equal(section.lines[0].quantity, 1);
  assert.equal(metal.unit, 'metre_kare');
  assert.equal(metal.quantity, section.totalAreaM2);
  assert.equal(metal.quantity, (W * 2 * H) / 10000);
});

test('panels side by side in one ctrl group share one width', () => {
  const strip = (groupId) => Array.from({ length: 7 }, (_, index) => ({
    itemKey: 'panel_197',
    isMetalSeparator: index === 0,
    metalSeparatorGroupId: index === 0 ? groupId : null,
    stripIndex: index,
  }));
  const bom = resolveProjectBom([
    { ...wall(strip('group-a')), id: 'left' },
    { ...wall(strip('group-a')), id: 'right' },
  ]);
  const section = bom.printAreas.find((entry) => entry.id === 'metal');
  assert.equal(section.lines.length, 1);
  assert.equal(section.lines[0].widthCm, 2 * W);
  assert.equal(section.lines[0].heightCm, H);
  assert.equal(section.lines[0].quantity, 1);
  assert.equal(qty(bom.lines, 'metal_separator'), (2 * W * H) / 10000);
});

test('separate groups keep their own measurements and add up in square metres', () => {
  const left = Array.from({ length: 7 }, (_, index) => ({
    itemKey: 'panel_197',
    isMetalSeparator: index === 0,
    metalSeparatorGroupId: index === 0 ? 'group-a' : null,
    stripIndex: index,
  }));
  const right = Array.from({ length: 7 }, (_, index) => ({
    itemKey: 'panel_197',
    isMetalSeparator: index === 0,
    metalSeparatorGroupId: index === 0 ? 'group-b' : null,
    stripIndex: index,
  }));
  const bom = resolveProjectBom([
    { ...wall(left), id: 'left' },
    { ...wall(right), id: 'right' },
  ]);
  const section = bom.printAreas.find((entry) => entry.id === 'metal');
  assert.equal(section.lines.length, 1);
  assert.equal(section.lines[0].widthCm, W);
  assert.equal(section.lines[0].heightCm, H);
  assert.equal(section.lines[0].quantity, 2);
  assert.equal(qty(bom.lines, 'metal_separator'), section.totalAreaM2);
  const text = formatProductionBomText(bom);
  const panelsStart = text.indexOf('\nPaneller\n');
  const productionStart = text.indexOf('\nÜretim\n');
  const panels = text.slice(panelsStart, productionStart);
  assert.ok(panels.includes(`2 x Metal Separatör ${cm(W)} × ${cm(H)} cm - metre_kare`), panels);
  assert.doesNotMatch(panels, /Toplam /);
  const total = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format((2 * W * H) / 10000);
  assert.ok(text.slice(productionStart).includes(`${total} × Metal Separatör · metre_kare · metal_separator`), text);
  assert.doesNotMatch(text, /Toplam \d/);
});

test('the panel menu offers metal separator next to glass', () => {
  const source = readFileSync(new URL('../src/moduleContextMenu.js', import.meta.url), 'utf8');
  assert.match(source, /Metal Separatöre Çevir/);
  assert.match(source, /toggle-metal-separator/);
});

test('a duplicated module gets its own metal separator group', () => {
  const strips = Array.from({ length: 7 }, (_, index) => ({
    id: `strip-${index}`,
    itemKey: 'panel_197',
    isMetalSeparator: index < 2,
    metalSeparatorGroupId: index < 2 ? 'metal-original' : null,
    stripIndex: index,
  }));
  const original = wall(strips);
  const copy = duplicateModuleState(original);
  const [first, second] = copy.strips;
  assert.equal(first.isMetalSeparator, true);
  assert.equal(second.isMetalSeparator, true);
  assert.match(first.metalSeparatorGroupId, /^metal-/);
  assert.notEqual(first.metalSeparatorGroupId, 'metal-original');
  assert.equal(second.metalSeparatorGroupId, first.metalSeparatorGroupId);
  assert.equal(copy.strips[2].metalSeparatorGroupId, null);
  assert.equal(original.strips[0].metalSeparatorGroupId, 'metal-original');
});

test('original and duplicate are separate metal pieces in the BOM', () => {
  const strips = Array.from({ length: 7 }, (_, index) => ({
    itemKey: 'panel_197',
    isMetalSeparator: index === 0,
    metalSeparatorGroupId: index === 0 ? 'metal-original' : null,
    stripIndex: index,
  }));
  const original = wall(strips);
  const bom = resolveProjectBom([original, duplicateModuleState(original)]);
  const section = bom.printAreas.find((entry) => entry.id === 'metal');
  assert.equal(section.lines.length, 1);
  assert.equal(section.lines[0].widthCm, W);
  assert.equal(section.lines[0].heightCm, H);
  assert.equal(section.lines[0].quantity, 2);
  assert.equal(qty(bom.lines, 'metal_separator'), (2 * W * H) / 10000);
});

function metalStrips(metalRows, groupId) {
  return Array.from({ length: 7 }, (_, index) => ({
    itemKey: 'panel_197',
    isMetalSeparator: metalRows.includes(index),
    metalSeparatorGroupId: metalRows.includes(index) ? groupId : null,
    stripIndex: index,
  }));
}

function placedWall(id, strips, xCm) {
  return {
    ...wall(strips),
    id,
    widthCm: 200,
    placement: { wallId: 'back', xCm, yCm: 0, zCm: 0, rotationZDeg: 0 },
  };
}

function metalLines(modules) {
  const section = resolveProjectBom(modules).printAreas.find((entry) => entry.id === 'metal');
  return section.lines.map((line) => `${line.quantity}x${line.widthCm}x${line.heightCm}`);
}

test('one group split by another module in between is two pieces', () => {
  assert.deepEqual(metalLines([
    { ...wall(metalStrips([0], 'group-a')), id: 'left' },
    { ...wall(metalStrips([], null)), id: 'middle' },
    { ...wall(metalStrips([0], 'group-a')), id: 'right' },
  ]), [`2x${W}x${H}`]);
});

test('one group whose modules were moved apart is two pieces', () => {
  assert.deepEqual(metalLines([
    placedWall('left', metalStrips([0], 'group-a'), 0),
    placedWall('right', metalStrips([0], 'group-a'), 400),
    placedWall('middle', metalStrips([], null), 200),
  ]), [`2x${W}x${H}`]);
});

test('modules touching on the wall stay one piece whatever their list order', () => {
  assert.deepEqual(metalLines([
    placedWall('left', metalStrips([0], 'group-a'), 0),
    placedWall('far', metalStrips([], null), 600),
    placedWall('right', metalStrips([0], 'group-a'), 200),
  ]), [`1x${2 * W}x${H}`]);
});

test('one group with a gap between rows is two pieces', () => {
  assert.deepEqual(metalLines([wall(metalStrips([0, 2], 'group-a'))]), [`2x${W}x${H}`]);
});

test('a moved-apart two by two group becomes two tall pieces', () => {
  assert.deepEqual(metalLines([
    placedWall('left', metalStrips([0, 1], 'group-a'), 0),
    placedWall('right', metalStrips([0, 1], 'group-a'), 400),
  ]), [`2x${W}x${2 * H}`]);
});
