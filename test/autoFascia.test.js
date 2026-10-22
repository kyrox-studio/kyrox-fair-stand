import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getOpenStandEdges,
  planAutomaticFascia,
  planFasciaEdgeLayout,
  splitFasciaLengthEvenly,
  resolveFasciaPanelItemKey,
  resolveFasciaUprightItemKey,
} from '../src/autoFascia.js';
import { getItem } from '../src/items.js';

const totalWidthByEdge = (plan) => plan.panels.reduce((acc, panel) => {
  acc[panel.edgeId] = (acc[panel.edgeId] ?? 0) + panel.widthCm;
  return acc;
}, {});

const corners = (plan) => plan.uprights.filter((u) => u.role === 'corner').map(({ placement }) => [placement.xCm, placement.yCm]);

test('open edges are the stand edges without an automatic wall', () => {
  assert.deepEqual(getOpenStandEdges('back-wall', 600, 400), ['right', 'front', 'left']);
  assert.deepEqual(getOpenStandEdges('l-left', 600, 400), ['right', 'front']);
  assert.deepEqual(getOpenStandEdges('l-right', 600, 400), ['front', 'left']);
  assert.deepEqual(getOpenStandEdges('u-stand', 600, 400), ['front']);
  assert.deepEqual(getOpenStandEdges('island', 600, 400), ['back', 'right', 'front', 'left']);
});

test('L-left fascia covers front and right edges with one upright at the open corner', () => {
  const plan = planAutomaticFascia({ standType: 'l-left', standXCm: 300, standYCm: 300, rows: 1 });
  assert.equal(plan.ok, true);
  assert.equal(plan.variant, 'wall-short-1');
  assert.deepEqual(totalWidthByEdge(plan), { right: 300, front: 300 });
  assert.deepEqual(plan.panels.map((panel) => panel.widthCm), [200, 100, 200, 100]);
  assert.equal(plan.uprights.filter((u) => u.role === 'span').length, 0);
  assert.deepEqual(corners(plan), [[300, 300]]);
});

test('panels face outward and run along their edge line', () => {
  const plan = planAutomaticFascia({ standType: 'island', standXCm: 400, standYCm: 300, rows: 2 });
  const byEdge = (edgeId) => plan.panels.filter((panel) => panel.edgeId === edgeId).map((panel) => panel.placement);
  assert.ok(byEdge('front').every((p) => p.yCm === 300 && p.rotationZDeg === 0 && p.wallId === 'free'));
  assert.ok(byEdge('back').every((p) => p.yCm === 0 && p.rotationZDeg === 180));
  assert.ok(byEdge('left').every((p) => p.xCm === 0 && p.rotationZDeg === 270));
  assert.ok(byEdge('right').every((p) => p.xCm === 400 && p.rotationZDeg === 90));
  assert.deepEqual(byEdge('front').map((p) => p.xCm), [0, 200]);
  assert.deepEqual(byEdge('right').map((p) => p.yCm), [0, 200]);
  assert.deepEqual(corners(plan), [[0, 0], [400, 0], [0, 300], [400, 300]]);
});

test('upright count follows fully open corners per stand type', () => {
  const count = (standType) => corners(planAutomaticFascia({ standType, standXCm: 500, standYCm: 400, rows: 1 })).length;
  assert.equal(count('u-stand'), 0);
  assert.equal(count('l-left'), 1);
  assert.equal(count('l-right'), 1);
  assert.equal(count('back-wall'), 2);
  assert.equal(count('island'), 4);
});

test('invalid rows or stand size are rejected', () => {
  assert.equal(planAutomaticFascia({ standType: 'l-left', standXCm: 300, standYCm: 300, rows: 3 }).ok, false);
  assert.equal(planAutomaticFascia({ standType: 'l-left', standXCm: 0, standYCm: 300, rows: 1 }).ok, false);
});

test('panel item keys resolve to the requested wall-short row variant', () => {
  for (const rows of [1, 2]) {
    for (const widthCm of [50, 100, 150, 200]) {
      const item = getItem(resolveFasciaPanelItemKey(widthCm, rows));
      assert.ok(item, `${widthCm} × ${rows}`);
      assert.equal(item.variant, `wall-short-${rows}`);
      assert.equal(Number(item.dimensions.widthCm), widthCm);
    }
  }
  assert.equal(resolveFasciaPanelItemKey(100, 3), null);
});

test('corner upright is the tallest upright within the wall height', () => {
  assert.equal(resolveFasciaUprightItemKey(350), 'upright_346_5');
  assert.equal(resolveFasciaUprightItemKey(250), 'upright_247_5');
  assert.equal(resolveFasciaUprightItemKey(500), 'upright_495');
});

// Ürün kararı: destekler arası en çok 500 cm; ara dikmeler eşit aralıklı, 50 cm adımda ortaya yakın;
// büyük paneller uçlarda, dolgu parçaları ortaya / dikmeye doğru.
const EDGE_TABLE = [
  [450, [], [450], [200, 50, 200]],
  [500, [], [500], [200, 100, 200]],
  [550, [300], [300, 250], [200, 100, 50, 200]],
  [600, [300], [300, 300], [200, 100, 100, 200]],
  [650, [350], [350, 300], [200, 150, 100, 200]],
  [800, [400], [400, 400], [200, 200, 200, 200]],
  [900, [450], [450, 450], [200, 200, 50, 50, 200, 200]],
  [1000, [500], [500, 500], [200, 200, 100, 100, 200, 200]],
  [1100, [350, 750], [350, 400, 350], [200, 150, 200, 200, 150, 200]],
  [1200, [400, 800], [400, 400, 400], [200, 200, 200, 200, 200, 200]],
  [1600, [400, 800, 1200], [400, 400, 400, 400], [200, 200, 200, 200, 200, 200, 200, 200]],
];

for (const [lengthCm, supports, bays, panels] of EDGE_TABLE) {
  test(`fascia edge ${lengthCm} cm: supports ${supports.join(',') || 'none'}`, () => {
    const layout = planFasciaEdgeLayout(lengthCm);
    assert.equal(layout.ok, true);
    assert.deepEqual(layout.supportOffsetsCm, supports);
    assert.deepEqual(layout.bays, bays);
    assert.deepEqual(layout.panels.map((panel) => panel.widthCm), panels);
  });
}

test('no fascia span exceeds 500 cm and every support sits on a panel joint, 50–5000 cm', () => {
  for (let lengthCm = 50; lengthCm <= 5000; lengthCm += 50) {
    const layout = planFasciaEdgeLayout(lengthCm);
    assert.equal(layout.supportOffsetsCm.length, Math.ceil(lengthCm / 500) - 1, `${lengthCm}`);
    assert.ok(layout.bays.every((bay) => bay <= 500), `${lengthCm}`);
    assert.ok(layout.panels.every((panel) => [50, 100, 150, 200].includes(panel.widthCm)), `${lengthCm}`);
    assert.equal(layout.panels.reduce((sum, panel) => sum + panel.widthCm, 0), lengthCm);
    const joints = new Set(layout.panels.map((panel) => panel.offsetCm));
    assert.ok(layout.supportOffsetsCm.every((offset) => joints.has(offset)), `${lengthCm}`);
  }
});

test('even split puts the extra 50 cm in the middle', () => {
  assert.deepEqual(splitFasciaLengthEvenly(450, 3), [150, 150, 150]);
  assert.deepEqual(splitFasciaLengthEvenly(500, 3), [150, 200, 150]);
  assert.deepEqual(splitFasciaLengthEvenly(250, 2), [150, 100]);
  assert.equal(splitFasciaLengthEvenly(275, 2), null);
});

test('L-left 800 × 800 gets one middle upright on each open edge', () => {
  const plan = planAutomaticFascia({ standType: 'l-left', standXCm: 800, standYCm: 800, rows: 1 });
  const span = plan.uprights.filter((u) => u.role === 'span').map((u) => [u.edgeId, u.placement.xCm, u.placement.yCm]);
  assert.deepEqual(span, [['right', 800, 400], ['front', 400, 800]]);
  assert.deepEqual(corners(plan), [[800, 800]]);
});
