import test from 'node:test';
import assert from 'node:assert/strict';

import { createModulePlacement } from '../src/modulePlacement.js';
import {
  addFlatPanelBackStrips,
  countRemovedPanels,
  createFlatPanelModuleState,
  removePanelStrips,
  restoreRemovedPanels,
  supportsPanelRemoval,
} from '../src/designState.js';
import { resolveProjectBom } from '../src/projectBom.js';
import { collectPrintAreas } from '../src/printAreaBom.js';

// Panel kaldırma (kullanıcı kararı 2026-11-12): düz duvarın ön / arka bant paneli kaldırılır;
// üretim listesinde panel ve iki yan aparatı düşer (köşe yanında köşe aparatı), en alt bant
// kalkarsa 2 başlangıç düşer. Arka panel yalnız sayılmaz.

function qty(bom, itemKey) {
  return bom.lines.find((line) => line.itemKey === itemKey)?.quantity ?? 0;
}

function wall(id, { xCm = 0, yCm = 0, rotationZDeg = 0, itemKey = 'wall_200_350', widthCm = 200 } = {}) {
  const moduleState = createFlatPanelModuleState({ itemKey, widthCm });
  moduleState.id = id;
  moduleState.placement = createModulePlacement({ xCm, yCm, rotationZDeg });
  return moduleState;
}

test('yalnız tam boy düz duvar panel kaldırmayı destekler', () => {
  assert.equal(supportsPanelRemoval(wall('a')), true);
  assert.equal(supportsPanelRemoval(wall('s', { itemKey: 'wall_100_short_2', widthCm: 100 })), false);
});

test('kaldırılan bant işaretlenir, görsel / cam / kumaş silinir, geri eklenince boş panel döner', () => {
  const moduleState = wall('a');
  const strip = moduleState.strips[2];
  strip.imageAssetId = 'asset-1';
  strip.isGlass = true;
  strip.fabricGroupId = 'fabric-1';
  const id = strip.id;
  assert.equal(removePanelStrips(moduleState, [{ side: 'front', stripIndex: 2 }]), 1);
  assert.equal(strip.removed, true);
  assert.equal(strip.id, id);
  assert.equal(strip.imageAssetId, null);
  assert.equal(strip.isGlass, undefined);
  assert.equal(strip.fabricGroupId, undefined);
  assert.equal(removePanelStrips(moduleState, [{ side: 'front', stripIndex: 2 }]), 0);
  assert.equal(countRemovedPanels(moduleState), 1);
  assert.equal(restoreRemovedPanels(moduleState), 1);
  assert.equal(strip.removed, undefined);
  assert.equal(countRemovedPanels(moduleState), 0);
});

test('ortadan bir panel: panel −1, tekli −2, başlangıç aynı', () => {
  const before = resolveProjectBom([wall('a')]);
  assert.equal(qty(before, 'panel_197'), 7);
  assert.equal(qty(before, 'connector_single'), 13);
  assert.equal(qty(before, 'connector_start'), 2);
  const moduleState = wall('a');
  removePanelStrips(moduleState, [{ side: 'front', stripIndex: 3 }]);
  const after = resolveProjectBom([moduleState]);
  assert.equal(qty(after, 'panel_197'), 6);
  assert.equal(qty(after, 'connector_single'), 11);
  assert.equal(qty(after, 'connector_start'), 2);
  // Çerçeve aynı kalır.
  assert.equal(qty(after, 'profile_190'), 2);
  assert.equal(qty(after, 'upright_346_5'), 2);
});

test('en alt bant kalkarsa 2 başlangıç da düşer', () => {
  const moduleState = wall('a');
  removePanelStrips(moduleState, [{ side: 'front', stripIndex: 0 }]);
  const bom = resolveProjectBom([moduleState]);
  assert.equal(qty(bom, 'panel_197'), 6);
  assert.equal(qty(bom, 'connector_single'), 11);
  assert.equal(qty(bom, 'connector_start'), 0);
});

test('köşe yanında tekli değil köşe aparatı düşer; köşe paneli düşer', () => {
  const corner = () => [wall('a', { xCm: 300 }), wall('b', { xCm: 500, rotationZDeg: 270 })];
  const before = resolveProjectBom(corner());
  assert.equal(qty(before, 'panel_corner_192'), 14);
  assert.equal(qty(before, 'connector_single'), 14);
  assert.equal(qty(before, 'connector_corner'), 12);
  const modules = corner();
  removePanelStrips(modules[0], [{ side: 'front', stripIndex: 3 }]);
  const after = resolveProjectBom(modules);
  assert.equal(qty(after, 'panel_corner_192'), 13);
  assert.equal(qty(after, 'connector_single'), 13);
  assert.equal(qty(after, 'connector_corner'), 11);
  const moduleA = after.modules.find((entry) => entry.moduleId === 'a');
  assert.equal(moduleA.lines.find((line) => line.itemKey === 'connector_corner')?.quantity, 5);
});

test('arka yüz ön yüz gibi aparat alır; arka panel kaldırılınca panel ve iki yan aparatı düşer', () => {
  const moduleState = wall('a');
  addFlatPanelBackStrips(moduleState);
  const full = resolveProjectBom([moduleState]);
  assert.equal(qty(full, 'panel_197'), 14);
  assert.equal(qty(full, 'connector_single'), 26);
  assert.equal(qty(full, 'connector_start'), 4);
  removePanelStrips(moduleState, [{ side: 'back', stripIndex: 1 }]);
  const bom = resolveProjectBom([moduleState]);
  assert.equal(qty(bom, 'panel_197'), 13);
  assert.equal(qty(bom, 'connector_single'), 24);
  assert.equal(qty(bom, 'connector_start'), 4);
  removePanelStrips(moduleState, [{ side: 'back', stripIndex: 0 }]);
  assert.equal(qty(resolveProjectBom([moduleState]), 'connector_start'), 2);
});

test('arka yüz eklemleri ön yüz kuralıyla: yan yana çiftli, köşede arka yüz köşe aparatı öder', () => {
  const withBack = (moduleState) => { addFlatPanelBackStrips(moduleState); return moduleState; };
  const sideBySide = resolveProjectBom([withBack(wall('a')), withBack(wall('b', { xCm: 200 }))]);
  assert.equal(qty(sideBySide, 'connector_single'), 24);
  assert.equal(qty(sideBySide, 'connector_double'), 14);
  assert.equal(qty(sideBySide, 'connector_start'), 8);
  const oneBack = resolveProjectBom([withBack(wall('a')), wall('b', { xCm: 200 })]);
  assert.equal(qty(oneBack, 'connector_single'), 25);
  assert.equal(qty(oneBack, 'connector_double'), 7);
  // b'nin arka yüzü a'ya dayanır: arka yüz köşe aparatı öder, arka paneller köşe paneli.
  const corner = [wall('a', { xCm: 300 }), withBack(wall('b', { xCm: 500, rotationZDeg: 90 }))];
  const cornerBom = resolveProjectBom(corner);
  assert.equal(qty(cornerBom, 'connector_corner'), 12);
  assert.equal(qty(cornerBom, 'connector_single'), 27);
  removePanelStrips(corner[1], [{ side: 'back', stripIndex: 3 }]);
  const removed = resolveProjectBom(corner);
  assert.equal(qty(removed, 'connector_corner'), 11);
  assert.equal(qty(removed, 'connector_single'), 26);
  assert.equal(qty(removed, 'panel_corner_192'), 13);
});

test('kaldırılan panelin görseli baskı listesine girmez', () => {
  const imageLines = (modules) => collectPrintAreas(modules)
    .find((section) => section.id === 'image')?.lines ?? [];
  const moduleState = wall('a');
  moduleState.strips[1].imageAssetId = 'asset-1';
  moduleState.strips[2].imageAssetId = 'asset-2';
  assert.deepEqual(imageLines([moduleState]).map((line) => line.subjectId), ['asset-1', 'asset-2']);
  removePanelStrips(moduleState, [{ side: 'front', stripIndex: 2 }]);
  assert.deepEqual(imageLines([moduleState]).map((line) => line.subjectId), ['asset-1']);
  // Görseli silinmemiş eski kayıt da (yalnız `removed`) baskıya girmez.
  const legacy = wall('b');
  legacy.strips[4].imageAssetId = 'asset-3';
  legacy.strips[4].removed = true;
  assert.deepEqual(imageLines([legacy]), []);
});
