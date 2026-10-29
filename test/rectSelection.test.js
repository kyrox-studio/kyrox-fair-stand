import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createConnectedPanelModulePath,
  createRectSelection,
  modulePanelSegment,
  panelModulesConnected,
} from '../src/rectSelection.js';

function makeGrid(columns = 4, rows = 7) {
  const items = [];
  for (let moduleIndex = 0; moduleIndex < columns; moduleIndex += 1) {
    for (let stripIndex = 0; stripIndex < rows; stripIndex += 1) {
      items.push({ moduleIndex, stripIndex, id: `${moduleIndex}:${stripIndex}` });
    }
  }
  return items;
}

test('selects a complete 3x2 rectangle from two corners', () => {
  const result = createRectSelection(
    makeGrid(),
    { moduleIndex: 0, stripIndex: 1 },
    { moduleIndex: 2, stripIndex: 2 },
  );

  assert.equal(result.ok, true);
  assert.equal(result.columnCount, 3);
  assert.equal(result.rowCount, 2);
  assert.equal(result.panelCount, 6);
  assert.deepEqual(
    result.entries.map((item) => item.id),
    ['0:1', '1:1', '2:1', '0:2', '1:2', '2:2'],
  );
});

test('supports a full vertical 1x7 selection', () => {
  const result = createRectSelection(
    makeGrid(),
    { moduleIndex: 2, stripIndex: 0 },
    { moduleIndex: 2, stripIndex: 6 },
  );

  assert.equal(result.ok, true);
  assert.equal(result.columnCount, 1);
  assert.equal(result.rowCount, 7);
  assert.equal(result.panelCount, 7);
});

test('supports a 10x7 selection', () => {
  const result = createRectSelection(
    makeGrid(10, 7),
    { moduleIndex: 0, stripIndex: 0 },
    { moduleIndex: 9, stripIndex: 6 },
  );

  assert.equal(result.ok, true);
  assert.equal(result.panelCount, 70);
});

test('rejects a rectangle when a cell inside the block is missing', () => {
  const items = makeGrid(3, 3).filter((item) => item.id !== '1:1');
  const result = createRectSelection(
    items,
    { moduleIndex: 0, stripIndex: 0 },
    { moduleIndex: 2, stripIndex: 2 },
  );

  assert.equal(result.ok, false);
});




test('allows rectangle selection across wall-plane metadata', () => {
  const items = makeGrid(3, 2).map((item) => ({
    ...item,
    selectionPlaneKey: item.moduleIndex === 1 ? 'left:90:y:0' : 'back:0:x:0',
  }));
  const result = createRectSelection(
    items,
    { moduleIndex: 0, stripIndex: 0, selectionPlaneKey: 'back:0:x:0' },
    { moduleIndex: 2, stripIndex: 1, selectionPlaneKey: 'right:270:y:1000' },
  );

  assert.equal(result.ok, true);
  assert.equal(result.panelCount, 6);
});


test('rectangle columns ignore gaps from non-panel module indices', () => {
  const items = [
    { moduleIndex: 0, stripIndex: 1, id: '0:1' },
    { moduleIndex: 0, stripIndex: 2, id: '0:2' },
    { moduleIndex: 3, stripIndex: 1, id: '3:1' },
    { moduleIndex: 3, stripIndex: 2, id: '3:2' },
  ];
  const result = createRectSelection(
    items,
    { moduleIndex: 0, stripIndex: 1 },
    { moduleIndex: 3, stripIndex: 2 },
  );

  assert.equal(result.ok, true);
  assert.equal(result.columnCount, 2);
  assert.equal(result.rowCount, 2);
  assert.equal(result.panelCount, 4);
  assert.deepEqual(result.entries.map((item) => item.id), ['0:1', '3:1', '0:2', '3:2']);
});


test('finds a connected free-panel path around an L corner', () => {
  const result = createConnectedPanelModulePath([
    { moduleId: 'a', axis: 'x', startCm: 0, endCm: 100, crossCm: 300 },
    { moduleId: 'b', axis: 'x', startCm: 100, endCm: 200, crossCm: 300 },
    { moduleId: 'c', axis: 'y', startCm: 300, endCm: 400, crossCm: 200 },
  ], 'a', 'c');

  assert.equal(result.ok, true);
  assert.deepEqual(result.moduleIds, ['a', 'b', 'c']);
});

test('does not bridge separate free-panel rows', () => {
  const result = createConnectedPanelModulePath([
    { moduleId: 'a', axis: 'x', startCm: 0, endCm: 100, crossCm: 300 },
    { moduleId: 'b', axis: 'x', startCm: 100, endCm: 200, crossCm: 300 },
    { moduleId: 'other', axis: 'x', startCm: 0, endCm: 100, crossCm: 500 },
  ], 'a', 'other');

  assert.equal(result.ok, false);
  assert.deepEqual(result.moduleIds, []);
});

test('connects a visually joined free-panel corner within panel-depth tolerance', () => {
  const result = createConnectedPanelModulePath([
    { moduleId: 'front-a', axis: 'x', startCm: 100, endCm: 200, crossCm: 300 },
    { moduleId: 'front-b', axis: 'x', startCm: 200, endCm: 300, crossCm: 300 },
    // Dik sıra fiziksel olarak 10 cm duvar gövdesine değiyor, ama
    // mantıksal orta çizgisi yatay uçtan 10 cm kaymış.
    { moduleId: 'right-a', axis: 'y', startCm: 310, endCm: 410, crossCm: 300 },
  ], 'front-a', 'right-a');

  assert.equal(result.ok, true);
  assert.deepEqual(result.moduleIds, ['front-a', 'front-b', 'right-a']);
});

test('does not bridge free-panel rows farther apart than panel depth', () => {
  const result = createConnectedPanelModulePath([
    { moduleId: 'front', axis: 'x', startCm: 0, endCm: 100, crossCm: 300 },
    { moduleId: 'separate', axis: 'x', startCm: 100, endCm: 200, crossCm: 312 },
  ], 'front', 'separate');

  assert.equal(result.ok, false);
  assert.deepEqual(result.moduleIds, []);
});


test('module panel segments follow the selection plane and touch end to end', () => {
  const back = (xCm) => modulePanelSegment({ wallId: 'back', xCm, yCm: 0 }, 200);
  assert.deepEqual(back(0), { axis: 'x', crossCm: 0, startCm: 0, endCm: 200 });
  assert.equal(panelModulesConnected(back(0), back(200)), true);
  assert.equal(panelModulesConnected(back(0), back(400)), false);
  const turned = modulePanelSegment({ wallId: 'free', xCm: 50, yCm: 10, rotationZDeg: 90 }, 100);
  assert.deepEqual(turned, { axis: 'y', crossCm: 50, startCm: 10, endCm: 110 });
  assert.equal(modulePanelSegment(null, 200), null);
  assert.equal(modulePanelSegment({ wallId: 'back', xCm: 0, yCm: 0 }, 0), null);
});
