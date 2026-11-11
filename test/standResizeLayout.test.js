import test from 'node:test';
import assert from 'node:assert/strict';

import './registerCanonicalItemCatalog.mjs';
import { createModuleStateFromCatalogKey } from '../src/designState.js';
import { planAutomaticDepot } from '../src/autoDepot.js';
import { planAutomaticFascia } from '../src/autoFascia.js';
import { createModulePlacement, placementsOverlap, validateModulePlacement } from '../src/modulePlacement.js';
import { resolveProjectBom } from '../src/projectBom.js';
import { getModulesLockState } from '../src/moduleLock.js';
import {
  composeStandWallStates,
  createAutomaticFasciaStates,
  createAutomaticWallLampStates,
  createDepotLampStates,
  createDepotStates,
  describeStandLayoutChangeReport,
  createFurnitureStates,
  planStandLayoutChange,
  planStandStructureChange,
  standStructureChangeRemovesContent,
} from '../src/standResize.js';
import { planAutomaticFurniture } from '../src/autoFurniture.js';

const STAND_TYPES = ['back-wall', 'u-stand', 'l-left', 'l-right', 'island'];
const X = 600;
const Y = 400;

function buildStand(standType, { depot = null, xCm = X, yCm = Y } = {}) {
  const depotPlan = depot ? planAutomaticDepot({ standType, standXCm: xCm, standYCm: yCm, sizeKey: depot }) : null;
  const walls = composeStandWallStates({ standType, standXCm: xCm, standYCm: yCm, wallHeightCm: 350, depotPlan });
  assert.equal(walls.ok, true, walls.message);
  const modules = [...walls.modules];
  // Kurulum sırası: duvarlar, duvar projektörleri, depo, depo projektörleri.
  modules.push(...createAutomaticWallLampStates(modules, { standXCm: xCm, standYCm: yCm }));
  if (depotPlan?.ok) {
    modules.push(...createDepotStates(depotPlan, 350));
    modules.push(...createDepotLampStates(modules));
  }
  return modules;
}

function plan(fromType, toType, modules, extra = {}) {
  return planStandLayoutChange({
    stand: { standType: fromType, xCm: X, yCm: Y, wallHeightCm: 350, ...extra },
    modules,
    toStandType: toType,
    boothType: 'maxima',
  });
}

function unresolvedKeys(bom) {
  return bom.unresolved.map((entry) => entry.itemKey).sort();
}

function wallCoverage(modules, wallId) {
  const axis = wallId === 'back' ? 'xCm' : 'yCm';
  return modules
    .filter((module) => module.type === 'flat-panel' && module.placement?.wallId === wallId && !module.autoFascia)
    .map((module) => [Number(module.placement[axis]), Number(module.placement[axis]) + Number(module.widthCm)])
    .sort((a, b) => a[0] - b[0]);
}

for (const fromType of STAND_TYPES) {
  for (const toType of STAND_TYPES) {
    if (fromType === toType) continue;
    test(`${fromType} → ${toType}: walls match a fresh ${toType}, placements and BOM are valid`, () => {
      const result = plan(fromType, toType, buildStand(fromType));
      assert.equal(result.ok, true, result.message);
      const fresh = buildStand(toType);
      for (const wallId of ['back', 'left', 'right']) {
        assert.deepEqual(wallCoverage(result.modules, wallId), wallCoverage(fresh, wallId), `${wallId}`);
      }
      for (const module of result.modules) {
        const check = validateModulePlacement({
          placement: module.placement, widthCm: module.widthCm, standType: toType, standXCm: X, standYCm: Y,
        });
        assert.equal(check.ok, true, `${module.itemKey}: ${check.message}`);
      }
      // Projektörler dahil BOM sıfırdan kurulan standla birebir aynı (test kataloğunda projektörün birimi
      // yok; çözülemeyen satırlar da aynı olmalı, yani projektör sayısı da tutar).
      const bom = resolveProjectBom(result.modules);
      const freshBom = resolveProjectBom(fresh);
      assert.deepEqual(unresolvedKeys(bom), unresolvedKeys(freshBom));
      assert.ok(unresolvedKeys(bom).every((key) => key === 'led_floodlight'));
      assert.equal(bom.appliedCornerCount, freshBom.appliedCornerCount);
    });
  }
}

test('same layout: nothing changes', () => {
  const modules = buildStand('u-stand');
  const result = plan('u-stand', 'u-stand', modules);
  assert.equal(result.changed, false);
  assert.equal(result.modules, modules);
  const unsupported = planStandLayoutChange({
    stand: { standType: 'u-stand', xCm: X, yCm: Y }, modules, toStandType: 'l-left', boothType: 'package',
  });
  assert.equal(unsupported.ok, false);
});

test('U → L left: kept walls keep their images and overlays; the right wall goes with its items', () => {
  const modules = buildStand('u-stand');
  const panelOn = (wallId) => modules.find((module) => module.type === 'flat-panel' && module.placement.wallId === wallId);
  const back = panelOn('back');
  const left = panelOn('left');
  const right = panelOn('right');
  const rightLamps = modules.filter((module) => module.type === 'led-floodlight' && module.placement.wallId === 'right');
  assert.ok(rightLamps.length > 0);
  back.strips[0].imageAssetId = 'asset-back';
  left.strips[0].imageAssetId = 'asset-left';
  right.strips[0].imageAssetId = 'asset-right';
  const tvBack = createModuleStateFromCatalogKey('tv_42');
  tvBack.placement = createModulePlacement({ xCm: 200, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' });
  const tvRight = createModuleStateFromCatalogKey('tv_42');
  tvRight.placement = createModulePlacement({ xCm: X, yCm: 100, zCm: 0, rotationZDeg: 90, wallId: 'right' });

  const result = plan('u-stand', 'l-left', [...modules, tvBack, tvRight]);
  const ids = new Set(result.modules.map((module) => module.id));
  assert.ok(ids.has(back.id) && ids.has(left.id) && ids.has(tvBack.id));
  assert.equal(result.modules.find((module) => module.id === back.id).strips[0].imageAssetId, 'asset-back');
  assert.ok(!ids.has(right.id) && !ids.has(tvRight.id));
  assert.deepEqual(result.report.removedWalls, ['right']);
  assert.equal(result.report.removedImages, 1);
  // Sağ duvardaki TV ve duvarın projektörleri duvarla birlikte kalkar.
  assert.equal(result.report.removedItems, 1 + rightLamps.length);
  assert.ok(!rightLamps.some((lamp) => ids.has(lamp.id)));
  const lines = describeStandLayoutChangeReport(result.report);
  assert.ok(lines.some((line) => line.includes('Sağ duvar kalkacak')));
});

test('back wall → U: empty locked walls are added on both sides', () => {
  const result = plan('back-wall', 'u-stand', buildStand('back-wall'));
  assert.deepEqual(result.report.addedWalls.sort(), ['left', 'right']);
  const added = result.modules.filter((module) => module.type === 'flat-panel'
    && ['left', 'right'].includes(module.placement.wallId));
  assert.ok(added.length > 0);
  assert.equal(result.report.addedPanels, added.length);
  assert.ok(added.every((module) => module.locked === true && module.strips.every((strip) => !strip.imageAssetId)));
});

test('kept wall with manually deleted panels is refilled on a layout change', () => {
  // Kullanıcı kararı 2026-11-10: U'da sırt panelleri elle silinip yerleşim değişince sırt duvar dolar.
  const modules = buildStand('u-stand').filter((module) => module.type !== 'flat-panel'
    || module.placement.wallId !== 'back' || module.placement.xCm >= 300);
  const result = plan('u-stand', 'l-left', modules);
  assert.equal(result.ok, true, result.message);
  assert.deepEqual(wallCoverage(result.modules, 'back'), wallCoverage(buildStand('l-left'), 'back'));
  assert.ok(result.report.filledPanels > 0);
  const lampXs = (list) => list.filter((module) => module.type === 'led-floodlight' && module.placement.wallId === 'back')
    .map((module) => module.placement.xCm).sort((a, b) => a - b);
  assert.deepEqual(lampXs(result.modules), lampXs(buildStand('l-left')));
  assert.ok(describeStandLayoutChangeReport(result.report).some((line) => line.includes('boşluklar')));
});

test('island: every edge wall goes; free content stays', () => {
  const desk = createModuleStateFromCatalogKey('desk_banko_100');
  desk.placement = createModulePlacement({ xCm: 250, yCm: 250, zCm: 0, rotationZDeg: 0, wallId: 'free' });
  const result = plan('u-stand', 'island', [...buildStand('u-stand'), desk]);
  assert.equal(result.modules.filter((module) => ['back', 'left', 'right'].includes(module.placement.wallId)).length, 0);
  assert.deepEqual(result.modules.find((module) => module.id === desk.id).placement, desk.placement);
});

test('new edge walls stand outside the area: an item at the edge is not moved', () => {
  const box = createModuleStateFromCatalogKey('box_block');
  box.placement = createModulePlacement({ xCm: 0, yCm: 200, zCm: 0, rotationZDeg: 0, wallId: 'free' });
  const result = plan('back-wall', 'l-left', [...buildStand('back-wall'), box]);
  assert.deepEqual(result.modules.find((module) => module.id === box.id).placement, box.placement);
  assert.equal(result.report.clampedItems, 0);
});

test('an item hit by the moved depot moves inside with its cluster', () => {
  const box = createModuleStateFromCatalogKey('desk_banko_100');
  box.placement = createModulePlacement({ xCm: 20, yCm: 50, zCm: 0, rotationZDeg: 0, wallId: 'free' });
  const neighbour = createModuleStateFromCatalogKey('desk_banko_100');
  neighbour.placement = createModulePlacement({ xCm: 120, yCm: 50, zCm: 0, rotationZDeg: 0, wallId: 'free' });
  const result = plan('u-stand', 'l-left', [...buildStand('u-stand', { depot: '100x100' }), box, neighbour], {
    depot: { enabled: true, sizeKey: '100x100', includeContents: false },
  });
  assert.equal(result.ok, true, result.message);
  const byId = Object.fromEntries(result.modules.map((module) => [module.id, module]));
  const depot = result.modules.filter((module) => module.autoDepot);
  assert.ok(!depot.some((piece) => placementsOverlap(piece, byId[box.id])));
  assert.equal(byId[neighbour.id].placement.xCm - byId[box.id].placement.xCm, 100);
  assert.equal(byId[neighbour.id].placement.yCm - byId[box.id].placement.yCm, 0);
  assert.equal(result.report.clampedItems, 2);
});

test('depot moves to the new layout spot; unchanged spot keeps the depot as is', () => {
  const uStand = buildStand('u-stand', { depot: '100x100' });
  const depotIds = uStand.filter((module) => module.autoDepot).map((module) => module.id);
  const same = plan('u-stand', 'back-wall', uStand, { depot: { enabled: true, sizeKey: '100x100', includeContents: false } });
  assert.equal(same.report.depotRebuilt, false);
  for (const id of depotIds) assert.ok(same.modules.some((module) => module.id === id));

  const moved = plan('u-stand', 'l-left', uStand, { depot: { enabled: true, sizeKey: '100x100', includeContents: false } });
  assert.equal(moved.ok, true, moved.message);
  assert.equal(moved.report.depotRebuilt, true);
  const fresh = buildStand('l-left', { depot: '100x100' });
  const shape = (modules) => modules
    .filter((module) => module.autoDepot || module.depotBack || module.depotSide)
    .map((module) => `${module.type}:${module.widthCm}:${module.placement.wallId}:${module.placement.xCm}:${module.placement.yCm}`)
    .sort();
  assert.deepEqual(shape(moved.modules), shape(fresh));
  assert.equal(
    moved.modules.filter((module) => module.type === 'led-floodlight').length,
    fresh.filter((module) => module.type === 'led-floodlight').length,
  );
});

test('fascia is rebuilt for the new open edges', () => {
  const walls = buildStand('u-stand');
  const fascia = createAutomaticFasciaStates(planAutomaticFascia({ standType: 'u-stand', standXCm: X, standYCm: Y, rows: 1 }), 350);
  const result = plan('u-stand', 'island', [...walls, ...fascia], { fascia: { enabled: true, rows: 1 } });
  assert.equal(result.ok, true, result.message);
  assert.equal(result.report.fasciaRebuilt, true);
  const expected = createAutomaticFasciaStates(planAutomaticFascia({ standType: 'island', standXCm: X, standYCm: Y, rows: 1 }), 350);
  assert.equal(result.modules.filter((module) => module.autoFascia).length, expected.length);
});

function change(fromStand, modules, to) {
  return planStandStructureChange({
    stand: { xCm: X, yCm: Y, wallHeightCm: 350, ...fromStand }, modules, to, boothType: 'maxima',
  });
}

const DEPOT = { enabled: true, sizeKey: '100x100', includeContents: false };

test('adding a depot builds it like a fresh stand and asks nothing', () => {
  const result = change({ standType: 'u-stand' }, buildStand('u-stand'), { depot: DEPOT });
  assert.equal(result.ok, true, result.message);
  assert.equal(result.report.depotAdded, true);
  assert.equal(standStructureChangeRemovesContent(result.report), false);
  const shape = (modules) => modules
    .filter((module) => module.autoDepot || module.depotBack || module.depotSide)
    .map((module) => `${module.type}:${module.widthCm}:${module.placement.xCm}:${module.placement.yCm}`).sort();
  assert.deepEqual(shape(result.modules), shape(buildStand('u-stand', { depot: '100x100' })));
  assert.deepEqual(result.stand.depot, DEPOT);
});

test('removing a depot asks first and rebuilds a plain back wall', () => {
  const result = change({ standType: 'u-stand', depot: DEPOT }, buildStand('u-stand', { depot: '100x100' }), {
    depot: { enabled: false },
  });
  assert.equal(result.report.depotRemoved, true);
  assert.equal(standStructureChangeRemovesContent(result.report), true);
  assert.equal(result.modules.filter((module) => module.autoDepot || module.depotBack).length, 0);
  assert.deepEqual(wallCoverage(result.modules, 'back'), wallCoverage(buildStand('u-stand'), 'back'));
});

test('depot contents toggle only adds / removes the fixtures; depot walls stay', () => {
  const modules = buildStand('u-stand', { depot: '100x100' });
  const wallIds = modules.filter((module) => module.autoDepot).map((module) => module.id);
  const added = change({ standType: 'u-stand', depot: DEPOT }, modules, { depot: { ...DEPOT, includeContents: true } });
  assert.equal(added.report.depotContentsAdded, 4);
  assert.equal(standStructureChangeRemovesContent(added.report), false);
  for (const id of wallIds) assert.ok(added.modules.some((module) => module.id === id));
  const removed = change({ standType: 'u-stand', depot: { ...DEPOT, includeContents: true } }, added.modules, { depot: DEPOT });
  assert.equal(removed.report.removedDepotItems, 4);
  assert.equal(standStructureChangeRemovesContent(removed.report), true);
  for (const id of wallIds) assert.ok(removed.modules.some((module) => module.id === id));
});

test('an item in the new depot spot is pushed out with its cluster', () => {
  const desk = createModuleStateFromCatalogKey('desk_banko_100');
  desk.placement = createModulePlacement({ xCm: 260, yCm: 50, zCm: 0, rotationZDeg: 0, wallId: 'free' });
  const result = change({ standType: 'u-stand' }, [...buildStand('u-stand'), desk], { depot: DEPOT });
  const moved = result.modules.find((module) => module.id === desk.id);
  assert.ok(!result.modules.filter((module) => module.autoDepot).some((piece) => placementsOverlap(piece, moved)));
  assert.equal(result.report.clampedItems, 1);
});

test('fascia: adding asks nothing, removing asks; images follow position', () => {
  const walls = buildStand('u-stand');
  const added = change({ standType: 'u-stand' }, walls, { fascia: { enabled: true, rows: 1 } });
  assert.equal(added.report.fasciaRebuilt, true);
  assert.equal(standStructureChangeRemovesContent(added.report), false);
  const fascia = added.modules.filter((module) => module.autoFascia);
  assert.ok(fascia.length > 0);
  const removed = change({ standType: 'u-stand', fascia: { enabled: true, rows: 1 } }, added.modules, { fascia: { enabled: false } });
  assert.equal(removed.report.fasciaRemoved, true);
  assert.equal(removed.modules.filter((module) => module.autoFascia).length, 0);
  assert.equal(standStructureChangeRemovesContent(removed.report), true);
});

test('furniture: adding always adds the set; removing takes one of each, the one nearest the set spot', () => {
  const walls = buildStand('u-stand');
  const added = change({ standType: 'u-stand' }, walls, { furniture: { enabled: true } });
  const set = createFurnitureStates(planAutomaticFurniture({ standXCm: X, standYCm: Y }));
  assert.equal(added.report.furnitureAdded, set.length);
  assert.equal(standStructureChangeRemovesContent(added.report), false);

  // Set iki kez eklenmiş + kullanıcının uzakta bir bankosu: kaldırınca her üründen yalnız birer tane gider.
  const twice = change({ standType: 'u-stand' }, added.modules, { furniture: { enabled: true } });
  const removed = change({ standType: 'u-stand', furniture: { enabled: true } }, twice.modules, { furniture: { enabled: false } });
  assert.equal(removed.report.furnitureRemoved, set.length);
  assert.equal(standStructureChangeRemovesContent(removed.report), true);
  for (const item of set) {
    const before = twice.modules.filter((module) => module.itemKey === item.itemKey).length;
    const after = removed.modules.filter((module) => module.itemKey === item.itemKey).length;
    assert.equal(after, before - set.filter((other) => other.itemKey === item.itemKey).length);
  }
  const none = change({ standType: 'u-stand', furniture: { enabled: true } }, walls, { furniture: { enabled: false } });
  assert.equal(none.report.furnitureRemoved, 0);
});

test('layout change keeps the user lock choice for new walls, fascia and lamps', () => {
  const unlocked = buildStand('back-wall').map((module) => {
    const next = structuredClone(module);
    delete next.locked;
    return next;
  });
  const result = change({ standType: 'back-wall' }, unlocked, { standType: 'u-stand', fascia: { enabled: true, rows: 1 } });
  assert.equal(result.ok, true, result.message);
  assert.ok(result.report.addedWalls.length > 0);
  assert.equal(getModulesLockState(result.modules).locked, 0);
});
