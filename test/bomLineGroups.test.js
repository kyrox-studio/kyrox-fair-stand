import assert from 'node:assert/strict';
import test from 'node:test';

import { groupBomLines } from '../src/bomLineGroups.js';
import { resolveProjectBom } from '../src/projectBom.js';

test('wall_200 combined leaves group into upright, profile, panel, connector', () => {
  const bom = resolveProjectBom([{ id: 'wall', itemKey: 'wall_200_350', type: 'flat-panel' }]);
  const groups = groupBomLines(bom.lines);
  assert.deepEqual(groups.map((group) => group.label), [
    'Dikmeler',
    'Profiller',
    'Paneller',
    'Aparatlar',
    'Üretim', // her projeye eklenen elektrik panosu (DB)
  ]);
  const panels = groups.find((group) => group.id === 'panel');
  assert.equal(panels.lines.some((line) => line.itemKey === 'panel_197'), true);
  assert.equal(groups.some((group) => group.id === 'extra'), false);
});

test('glass panels stay in Paneller and unknown types fall into Extra', () => {
  const groups = groupBomLines([
    { itemKey: 'panel_cam_197', quantity: 4, unit: 'adet' },
    { itemKey: 'led_floodlight_missing', quantity: 1, unit: 'adet' },
  ]);
  assert.equal(groups[0].label, 'Paneller');
  assert.equal(groups[0].lines[0].itemKey, 'panel_cam_197');
  assert.equal(groups[1].id, 'extra');
  assert.equal(groups[1].label, 'Extra');
});

test('tulle metre total sits under Üretim', () => {
  const groups = groupBomLines([
    { itemKey: 'tulle_fabric', quantity: 18, unit: 'metre_kare' },
  ]);
  assert.deepEqual(groups.map((group) => group.id), ['production']);
  assert.equal(groups[0].label, 'Üretim');
  assert.equal(groups[0].lines[0].itemKey, 'tulle_fabric');
  assert.equal(groups.some((group) => group.id === 'extra'), false);
});

test('shelf_leg sits under Raflar', () => {
  const groups = groupBomLines([
    { itemKey: 'shelf_200', quantity: 1, unit: 'adet' },
    { itemKey: 'shelf_leg', quantity: 10, unit: 'adet' },
  ]);
  assert.deepEqual(groups.map((group) => group.id), ['shelf']);
  assert.deepEqual(groups[0].lines.map((line) => line.itemKey), ['shelf_200', 'shelf_leg']);
});
