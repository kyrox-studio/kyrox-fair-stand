import test from 'node:test';
import assert from 'node:assert/strict';

import './registerCanonicalItemCatalog.mjs';
import { createModuleStateFromCatalogKey } from '../src/designState.js';
import { composeAutomaticStandWall, getAutomaticWallCapacityCm } from '../src/automaticWall.js';
import { planAutomaticFascia } from '../src/autoFascia.js';
import { createModulePlacement, validateModulePlacement } from '../src/modulePlacement.js';
import { resolveProjectBom } from '../src/projectBom.js';
import {
  createAutomaticFasciaStates,
  describeStandSizeChangeReport,
  planStandSizeChange,
  standSizeChangeRemovesContent,
} from '../src/standResize.js';

const STAND_TYPES = ['back-wall', 'l-left', 'l-right', 'u-stand'];
const SIZES = [[700, 600], [300, 300], [500, 250], [450, 650]];

function buildStand(standType, xCm, yCm) {
  const wall = composeAutomaticStandWall({
    wallWidthCm: getAutomaticWallCapacityCm({ standType, standXCm: xCm, standYCm: yCm }),
    standType,
    standXCm: xCm,
    standYCm: yCm,
  });
  assert.equal(wall.ok, true, wall.message);
  return wall.widths.map((widthCm, index) => {
    const moduleState = createModuleStateFromCatalogKey(`wall_${widthCm}_350`);
    moduleState.placement = { ...wall.placements[index] };
    moduleState.locked = true;
    return moduleState;
  });
}

function plan(standType, modules, from, to, extra = {}) {
  return planStandSizeChange({
    stand: { standType, xCm: from[0], yCm: from[1], wallHeightCm: 350, ...extra },
    modules,
    toXCm: to[0],
    toYCm: to[1],
    boothType: 'maxima',
  });
}

function wallCoverage(modules, wallId) {
  const axis = wallId === 'back' ? 'xCm' : 'yCm';
  return modules
    .filter((module) => module.type === 'flat-panel' && module.placement?.wallId === wallId)
    .map((module) => [Number(module.placement[axis]), Number(module.placement[axis]) + Number(module.widthCm)])
    .sort((a, b) => a[0] - b[0]);
}

function assertContinuous(ranges, lengthCm, label) {
  let cursor = 0;
  for (const [start, end] of ranges) {
    assert.equal(start, cursor, `${label}: gap or overlap at ${cursor}`);
    cursor = end;
  }
  assert.equal(cursor, lengthCm, `${label}: wall ends at ${cursor}`);
}

for (const standType of STAND_TYPES) {
  for (const [toX, toY] of SIZES) {
    test(`${standType} 500×400 → ${toX}×${toY}: walls cover the new edges, placements and BOM are valid`, () => {
      const result = plan(standType, buildStand(standType, 500, 400), [500, 400], [toX, toY]);
      assert.equal(result.ok, true, result.message);
      const fresh = buildStand(standType, toX, toY);
      for (const wallId of ['back', 'left', 'right']) {
        const expected = wallCoverage(fresh, wallId);
        if (!expected.length) {
          assert.equal(wallCoverage(result.modules, wallId).length, 0);
          continue;
        }
        assertContinuous(wallCoverage(result.modules, wallId), wallId === 'back' ? toX : toY, `${standType} ${wallId}`);
      }
      for (const module of result.modules) {
        const check = validateModulePlacement({
          placement: module.placement,
          widthCm: module.widthCm,
          standType,
          standXCm: toX,
          standYCm: toY,
        });
        assert.equal(check.ok, true, `${module.itemKey}: ${check.message}`);
      }
      const bom = resolveProjectBom(result.modules);
      const freshBom = resolveProjectBom(fresh);
      assert.equal(bom.unresolved.length, 0);
      assert.equal(bom.appliedCornerCount, freshBom.appliedCornerCount);
    });
  }
}

test('planning does not mutate input; same size and unknown booth type', () => {
  const modules = buildStand('l-left', 500, 400);
  const before = structuredClone(modules);
  plan('l-left', modules, [500, 400], [300, 300]);
  assert.deepEqual(modules, before);

  const same = plan('l-left', modules, [500, 400], [500, 400]);
  assert.equal(same.changed, false);
  assert.equal(same.modules, modules);

  const unsupported = planStandSizeChange({
    stand: { standType: 'l-left', xCm: 500, yCm: 400 }, modules, toXCm: 600, toYCm: 400, boothType: 'package',
  });
  assert.equal(unsupported.ok, false);
});

test('panel images stay on surviving panels; removed panel images are counted', () => {
  const modules = buildStand('back-wall', 500, 400);
  const first = modules.find((module) => module.placement.xCm === 0);
  const last = modules.reduce((a, b) => (a.placement.xCm > b.placement.xCm ? a : b));
  first.strips[0].imageAssetId = 'asset-first';
  last.strips[0].imageAssetId = 'asset-last';
  const result = plan('back-wall', modules, [500, 400], [200, 400]);
  const kept = result.modules.find((module) => module.id === first.id);
  assert.equal(kept.strips[0].imageAssetId, 'asset-first');
  assert.ok(!result.modules.some((module) => module.id === last.id));
  assert.equal(result.report.removedImages, 1);
});

test('a wall that does not reach the open end is not extended', () => {
  const modules = buildStand('l-left', 500, 400).filter((module) => module.placement.wallId !== 'back' || module.placement.xCm < 300);
  const result = plan('l-left', modules, [500, 400], [700, 400]);
  assert.equal(result.report.addedPanels, 0);

  // Sırt duvar iki uçtan uzar: yalnız duvarın ulaştığı (sol) uca panel girer, kısa bırakılan sağ uç uzamaz.
  const back = buildStand('back-wall', 500, 400).filter((module) => module.placement.xCm < 300);
  const symmetric = plan('back-wall', back, [500, 400], [700, 400]);
  assert.equal(symmetric.report.addedPanels, 1);
  assert.deepEqual(wallCoverage(symmetric.modules, 'back')[0], [0, 100]);
  // Eski duvar 0–400 idi, 100 sağa kayar ve 500'de biter; sağ uçtaki 500–700 boş kalır.
  assert.equal(Math.max(...wallCoverage(symmetric.modules, 'back').map(([, end]) => end)), 500);
});

test('back wall and U: width grows and shrinks equally on both ends; content stays centred', () => {
  for (const standType of ['back-wall', 'u-stand']) {
    const modules = buildStand(standType, 500, 400);
    const tv = createModuleStateFromCatalogKey('tv_42');
    tv.placement = createModulePlacement({ xCm: 200, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' });
    const desk = createModuleStateFromCatalogKey('desk_banko_100');
    desk.placement = createModulePlacement({ xCm: 300, yCm: 250, zCm: 0, rotationZDeg: 0, wallId: 'free' });

    const grown = plan(standType, [...modules, tv, desk], [500, 400], [700, 400]);
    assert.equal(grown.ok, true, grown.message);
    const grownById = Object.fromEntries(grown.modules.map((module) => [module.id, module]));
    assert.equal(grownById[tv.id].placement.xCm, 300, `${standType} tv`);
    assert.equal(grownById[desk.id].placement.xCm, 400, `${standType} desk`);
    assert.equal(grownById[desk.id].placement.yCm, 250, `${standType} desk y`);
    assertContinuous(wallCoverage(grown.modules, 'back'), 700, `${standType} grown back`);

    const shrunk = plan(standType, [...modules, tv, desk], [500, 400], [300, 400]);
    assert.equal(shrunk.ok, true, shrunk.message);
    const shrunkById = Object.fromEntries(shrunk.modules.map((module) => [module.id, module]));
    assert.equal(shrunkById[tv.id].placement.xCm, 100, `${standType} tv shrunk`);
    assert.equal(shrunkById[desk.id].placement.xCm, 200, `${standType} desk shrunk`);
    assertContinuous(wallCoverage(shrunk.modules, 'back'), 300, `${standType} shrunk back`);
  }
});

test('island: all content moves together by half the difference and is never split', () => {
  const left = createModuleStateFromCatalogKey('box_block');
  left.placement = createModulePlacement({ xCm: 200, yCm: 300, zCm: 0, rotationZDeg: 0, wallId: 'free' });
  const right = createModuleStateFromCatalogKey('box_block');
  right.placement = createModulePlacement({ xCm: 900, yCm: 600, zCm: 0, rotationZDeg: 0, wallId: 'free' });
  const result = plan('island', [left, right], [1200, 900], [2000, 1000]);
  assert.equal(result.ok, true, result.message);
  const byId = Object.fromEntries(result.modules.map((module) => [module.id, module]));
  assert.deepEqual([byId[left.id].placement.xCm, byId[left.id].placement.yCm], [600, 350]);
  assert.deepEqual([byId[right.id].placement.xCm, byId[right.id].placement.yCm], [1300, 650]);

  const shrunk = plan('island', [left, right], [1200, 900], [1000, 900]);
  const shrunkById = Object.fromEntries(shrunk.modules.map((module) => [module.id, module]));
  assert.equal(shrunkById[left.id].placement.xCm, 100);
  assert.equal(shrunkById[right.id].placement.xCm, 800);
});

test('L right: back wall keeps the right corner; overlays on it move with it', () => {
  const modules = buildStand('l-right', 500, 400);
  const tv = createModuleStateFromCatalogKey('tv_42');
  tv.placement = createModulePlacement({ xCm: 300, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' });
  const result = plan('l-right', [...modules, tv], [500, 400], [700, 400]);
  assert.equal(result.modules.find((module) => module.id === tv.id).placement.xCm, 500);
  assertContinuous(wallCoverage(result.modules, 'back'), 700, 'l-right back');

  // Köşe sağda: sağ köşeye yakın TV daralınca kalır, açık (sol) uçtaki TV kalkar.
  const nearOpenEnd = createModuleStateFromCatalogKey('tv_42');
  nearOpenEnd.placement = createModulePlacement({ xCm: 50, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' });
  const shrunk = plan('l-right', [...modules, tv, nearOpenEnd], [500, 400], [200, 400]);
  assert.equal(shrunk.modules.find((module) => module.id === tv.id).placement.xCm, 0);
  assert.ok(!shrunk.modules.some((module) => module.id === nearOpenEnd.id));
  assert.equal(shrunk.report.removedItems, 1);
});

test('free items keep the distance to their nearest edge; groups move as one', () => {
  // L Sol: köşe solda sabit; sırt duvar / U / ada için ortalama ayrı testte.
  const modules = buildStand('l-left', 500, 400);
  const front = createModuleStateFromCatalogKey('desk_banko_100');
  front.placement = createModulePlacement({ xCm: 50, yCm: 320, zCm: 0, rotationZDeg: 0, wallId: 'free' });
  const back = createModuleStateFromCatalogKey('desk_banko_100');
  back.placement = createModulePlacement({ xCm: 50, yCm: 80, zCm: 0, rotationZDeg: 0, wallId: 'free' });
  const groupA = createModuleStateFromCatalogKey('box_block');
  groupA.placement = createModulePlacement({ xCm: 300, yCm: 150, zCm: 0, rotationZDeg: 0, wallId: 'free' });
  const groupB = createModuleStateFromCatalogKey('box_block');
  groupB.placement = createModulePlacement({ xCm: 300, yCm: 250, zCm: 0, rotationZDeg: 0, wallId: 'free' });
  groupA.group = { id: 'group-1', name: 'G' };
  groupB.group = { id: 'group-1', name: 'G' };

  const result = plan('l-left', [...modules, front, back, groupA, groupB], [500, 400], [700, 600]);
  const byId = Object.fromEntries(result.modules.map((module) => [module.id, module]));
  assert.equal(byId[front.id].placement.yCm, 520);
  assert.equal(byId[front.id].placement.xCm, 50);
  assert.equal(byId[back.id].placement.yCm, 80);
  // Grup ortası (y = 200) arka yarıda: ikisi de aynı kalır; x ortası 300 > 250: ikisi de +200.
  assert.equal(byId[groupA.id].placement.yCm, 150);
  assert.equal(byId[groupB.id].placement.yCm, 250);
  assert.equal(byId[groupA.id].placement.xCm, 500);
  assert.equal(byId[groupB.id].placement.xCm, 500);
});

test('items outside a smaller stand are pulled inside', () => {
  const modules = buildStand('back-wall', 600, 600);
  const box = createModuleStateFromCatalogKey('box_block');
  box.placement = createModulePlacement({ xCm: 250, yCm: 280, zCm: 0, rotationZDeg: 0, wallId: 'free' });
  const result = plan('back-wall', [...modules, box], [600, 600], [300, 300]);
  const moved = result.modules.find((module) => module.id === box.id);
  const check = validateModulePlacement({
    placement: moved.placement, widthCm: moved.widthCm, depthCm: moved.depthCm, standType: 'back-wall', standXCm: 300, standYCm: 300,
  });
  assert.equal(check.ok, true, check.message);
  assert.equal(result.report.outsideItems, 0);
});

test('fascia is rebuilt for the new edge and keeps its graphics in place', () => {
  const walls = buildStand('back-wall', 500, 400);
  const fascia = createAutomaticFasciaStates(
    planAutomaticFascia({ standType: 'back-wall', standXCm: 500, standYCm: 400, rows: 1 }),
    350,
  );
  const frontPanels = fascia.filter((module) => module.type === 'flat-panel' && Number(module.placement.rotationZDeg) === 0);
  const firstFront = frontPanels.reduce((a, b) => (a.placement.xCm < b.placement.xCm ? a : b));
  firstFront.strips[0].imageAssetId = 'asset-logo';
  const result = plan('back-wall', [...walls, ...fascia], [500, 400], [700, 400], { fascia: { enabled: true, rows: 1 } });
  assert.equal(result.ok, true, result.message);
  assert.equal(result.report.fasciaRebuilt, true);
  const newFront = result.modules.filter((module) => module.autoFascia && module.type === 'flat-panel'
    && Number(module.placement.rotationZDeg) === 0);
  assert.equal(newFront.reduce((sum, module) => sum + Number(module.widthCm), 0), 700);
  const atStart = newFront.reduce((a, b) => (a.placement.xCm < b.placement.xCm ? a : b));
  assert.equal(atStart.strips[0].imageAssetId, 'asset-logo');
  assert.ok(result.modules.every((module) => !module.autoFascia || fascia.every((old) => old.id !== module.id)));
});

test('depot moves with the wall it belongs to', () => {
  const modules = buildStand('l-right', 500, 400);
  const depotWall = createModuleStateFromCatalogKey('wall_100_350');
  depotWall.placement = createModulePlacement({ xCm: 400, yCm: 100, zCm: 0, rotationZDeg: 0, wallId: 'free' });
  depotWall.autoDepot = true;
  const result = plan('l-right', [...modules, depotWall], [500, 400], [700, 400]);
  assert.equal(result.modules.find((module) => module.id === depotWall.id).placement.xCm, 600);
});

test('floor area is clamped or removed', () => {
  const modules = buildStand('back-wall', 500, 400);
  const area = { xCm: 100, yCm: 100, widthCm: 300, depthCm: 200 };
  const clamped = plan('back-wall', modules, [500, 400], [300, 400], { floorArea: area });
  assert.deepEqual(clamped.floorArea, { ...area, widthCm: 200 });
  assert.equal(clamped.report.floorArea, 'clamped');
  const removed = plan('back-wall', modules, [500, 400], [100, 400], { floorArea: area });
  assert.equal(removed.floorArea, null);
  assert.equal(removed.report.floorArea, 'removed');
});

test('report text lists the changes', () => {
  const result = plan('u-stand', buildStand('u-stand', 500, 400), [500, 400], [700, 600]);
  const lines = describeStandSizeChangeReport(result.report);
  assert.ok(lines.some((line) => line.includes('duvar paneli eklenecek')));
});

function freeBox(xCm, yCm, groupId = null) {
  const box = createModuleStateFromCatalogKey('box_block');
  box.placement = createModulePlacement({ xCm, yCm, zCm: 0, rotationZDeg: 0, wallId: 'free' });
  if (groupId) box.group = { id: groupId, name: groupId };
  return box;
}

function offsetOf(result, source) {
  const moved = result.modules.find((module) => module.id === source.id);
  return [moved.placement.xCm - source.placement.xCm, moved.placement.yCm - source.placement.yCm];
}

test('shrinking: a group that no longer fits moves inside as one piece', () => {
  const a = freeBox(1000, 800, 'g');
  const b = freeBox(1000, 650, 'g');
  const result = plan('island', [a, b], [1200, 900], [800, 500]);
  assert.equal(result.ok, true, result.message);
  assert.deepEqual(offsetOf(result, a), offsetOf(result, b));
  for (const module of result.modules) {
    const check = validateModulePlacement({ placement: module.placement, widthCm: module.widthCm, depthCm: module.depthCm, standType: 'island', standXCm: 800, standYCm: 500 });
    assert.equal(check.ok, true, check.message);
  }
  assert.equal(result.report.outsideItems, 0);
});

test('touching items without a group move together (one edge decision)', () => {
  // A ortanın solunda, B sağında; birbirine değdikleri için ikisi de küme ortasına (300) göre sağ kenarla gider.
  const a = freeBox(200, 150);
  const b = freeBox(300, 150);
  const result = plan('l-left', [...buildStand('l-left', 500, 400), a, b], [500, 400], [700, 400]);
  assert.deepEqual(offsetOf(result, a), [200, 0]);
  assert.deepEqual(offsetOf(result, b), [200, 0]);
});

test('a pulled-in cluster prefers a spot that does not hit another item', () => {
  const a = freeBox(750, 500);
  const obstacle = freeBox(645, 500); // 5 cm boşluk: ayrı küme
  const result = plan('island', [a, obstacle], [1000, 1000], [600, 1000]);
  const byId = Object.fromEntries(result.modules.map((module) => [module.id, module]));
  const check = validateModulePlacement({ placement: byId[a.id].placement, widthCm: 100, depthCm: 50, standType: 'island', standXCm: 600, standYCm: 1000 });
  assert.equal(check.ok, true, check.message);
  assert.equal(result.report.collidingItems, 0);
});

function spanningTulle(xCm, yCm, lengthCm, spanCm, rotationZDeg = 0) {
  const tulle = createModuleStateFromCatalogKey('tulle_fabric');
  tulle.widthCm = lengthCm;
  tulle.heightCm = spanCm;
  tulle.placement = createModulePlacement({ xCm, yCm, zCm: 350, rotationZDeg, wallId: 'free' });
  return tulle;
}

test('tulle covering the stand edge to edge shortens with the stand but never grows', () => {
  const tulle = spanningTulle(0, 200, 505, 400);
  const shrunk = plan('island', [tulle], [500, 400], [300, 300]);
  const small = shrunk.modules.find((module) => module.id === tulle.id);
  assert.equal(small.widthCm, 305); // 5 cm taşma payı korunur
  assert.equal(small.placement.xCm, 0);
  assert.equal(small.heightCm, 300);
  assert.equal(small.placement.yCm, 150);
  assert.equal(shrunk.report.shortenedTulles, 2);
  assert.ok(describeStandSizeChangeReport(shrunk.report).some((line) => line.includes('tül')));

  const grown = plan('island', [tulle], [500, 400], [800, 600]);
  const big = grown.modules.find((module) => module.id === tulle.id);
  assert.equal(big.widthCm, 505);
  assert.equal(big.heightCm, 400);
  assert.equal(grown.report.shortenedTulles, 0);

  // Uçtan uca olmayan tül kısalmaz.
  const partial = spanningTulle(100, 200, 200, 100);
  const kept = plan('island', [partial], [500, 400], [300, 300]).modules.find((module) => module.id === partial.id);
  assert.equal(kept.widthCm, 200);
  assert.equal(kept.heightCm, 100);

  // 90° dönük tülde boy Y ekseninde.
  const turned = spanningTulle(250, 0, 400, 500, 90);
  const turnedShrunk = plan('island', [turned], [500, 400], [500, 300]).modules.find((module) => module.id === turned.id);
  assert.equal(turnedShrunk.widthCm, 300);
  assert.equal(turnedShrunk.heightCm, 500);
});

test('growing asks nothing; shrinking that removes something asks first', () => {
  const grown = plan('back-wall', buildStand('back-wall', 500, 400), [500, 400], [700, 600]);
  assert.equal(standSizeChangeRemovesContent(grown.report), false);
  const shrunk = plan('back-wall', buildStand('back-wall', 500, 400), [500, 400], [300, 400]);
  assert.equal(standSizeChangeRemovesContent(shrunk.report), true);
  const box = createModuleStateFromCatalogKey('box_block');
  box.placement = createModulePlacement({ xCm: 100, yCm: 100, zCm: 0, rotationZDeg: 0, wallId: 'free' });
  // Yalnız kaydırma / kısaltma: hiçbir şey kalkmıyorsa pencere açılmaz.
  const moveOnly = plan('island', [box], [500, 400], [450, 400]);
  assert.equal(standSizeChangeRemovesContent(moveOnly.report), false);
  assert.equal(standSizeChangeRemovesContent({ floorArea: 'removed' }), true);
  assert.equal(standSizeChangeRemovesContent({ outsideItems: 1 }), true);
});
