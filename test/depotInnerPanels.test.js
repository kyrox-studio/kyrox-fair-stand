import test from 'node:test';
import assert from 'node:assert/strict';

import { planAutomaticDepot, AUTO_DEPOT_SIZES } from '../src/autoDepot.js';
import { addFlatPanelBackStrips } from '../src/designState.js';
import { DEPOT_INNER_BAND_LIMIT, resolveProjectBom } from '../src/projectBom.js';
import { composeStandWallStates, createDepotStates } from '../src/standResize.js';

// Depo içi paneller (kullanıcı kararı 2026-11-16): deponun içine bakan duvar yüzü alttaki 4 bantla
// sayılır, "Depo içi paneller" grubunda görünür ve toplama dahildir; sahne ve aparatlar değişmez.
const STAND_TYPES = ['back-wall', 'u-stand', 'l-left', 'l-right', 'island'];
const SIZE_KEYS = Object.keys(AUTO_DEPOT_SIZES);
const WALL_HEIGHT_CM = 350;

function standWithDepot(standType, sizeKey, { depotBackFaces = false } = {}) {
  const depotPlan = planAutomaticDepot({ standType, standXCm: 600, standYCm: 400, sizeKey });
  assert.equal(depotPlan.ok, true, `${standType} ${sizeKey}: ${depotPlan.message}`);
  const walls = composeStandWallStates({
    standType,
    standXCm: 600,
    standYCm: 400,
    wallHeightCm: WALL_HEIGHT_CM,
    depotPlan,
  });
  assert.equal(walls.ok, true, `${standType} ${sizeKey}: ${walls.message}`);
  const depot = createDepotStates(depotPlan, WALL_HEIGHT_CM);
  if (depotBackFaces) {
    for (const moduleState of depot) {
      if (moduleState.type === 'flat-panel') addFlatPanelBackStrips(moduleState);
    }
  }
  return [...walls.modules, ...depot];
}

function panelLineTotal(bom) {
  return bom.lines
    .filter((line) => /^panel_/.test(line.itemKey))
    .reduce((sum, line) => sum + line.quantity, 0);
}

function expectedDepotPanels(modules) {
  let count = 0;
  for (const moduleState of modules) {
    if (moduleState.depotBack || moduleState.depotSide) {
      count += Math.min(DEPOT_INNER_BAND_LIMIT, moduleState.strips?.length ?? 0);
    } else if (moduleState.autoDepot && Array.isArray(moduleState.backStrips)) {
      count += Math.min(DEPOT_INNER_BAND_LIMIT, moduleState.backStrips.length);
    }
  }
  return count;
}

for (const standType of STAND_TYPES) {
  for (const sizeKey of SIZE_KEYS) {
    test(`depo içi: ${standType} · ${sizeKey}`, () => {
      const modules = standWithDepot(standType, sizeKey);
      const bom = resolveProjectBom(modules);
      const depotGroup = bom.panelAssignments.groups.find((group) => group.id === 'depot');
      const expected = expectedDepotPanels(modules);
      assert.equal(depotGroup.total, expected);
      if (standType !== 'island') {
        // Stand duvarının depoya düşen kısmı her zaman vardır.
        assert.ok(expected > 0, `${standType} ${sizeKey}: depo içine bakan stand duvarı bulunamadı`);
      }
      // Depo içi paneller yalnız alttaki 4 banttır.
      for (const panel of bom.panelAssignments.panels.filter((entry) => entry.group === 'depot')) {
        const owner = modules.find((moduleState) => moduleState.id === panel.moduleId);
        const strip = [...(owner.strips ?? []), ...(owner.backStrips ?? [])].find((entry) => entry.id === panel.surfaceId);
        assert.ok(strip.stripIndex < DEPOT_INNER_BAND_LIMIT);
      }
      // Toplama dahil: listedeki panel satırları ile döküm aynı sayıyı verir.
      assert.equal(bom.panelAssignments.total, panelLineTotal(bom));

      // Depo içine bakan her duvar listede 7 değil 4 panel sayılır; aparatlar değişmez.
      const unlimited = resolveProjectBom(modules.map((moduleState) => {
        const { depotBack, depotSide, autoDepot, ...rest } = moduleState;
        return rest;
      }));
      const droppedBands = modules
        .filter((moduleState) => moduleState.depotBack || moduleState.depotSide)
        .reduce((sum, moduleState) => sum + Math.max(0, (moduleState.strips?.length ?? 0) - DEPOT_INNER_BAND_LIMIT), 0);
      assert.equal(panelLineTotal(unlimited) - panelLineTotal(bom), droppedBands);
      const connectors = (result) => result.lines
        .filter((line) => line.itemKey.startsWith('connector_'))
        .map((line) => `${line.itemKey}=${line.quantity}`)
        .sort();
      assert.deepEqual(connectors(bom), connectors(unlimited));
    });
  }
}

test('depo duvarına arka yüz eklenince iç yüzün alttaki 4 bandı depo içi sayılır (Ada dahil)', () => {
  for (const standType of STAND_TYPES) {
    const modules = standWithDepot(standType, '200x200', { depotBackFaces: true });
    const bom = resolveProjectBom(modules);
    const depotGroup = bom.panelAssignments.groups.find((group) => group.id === 'depot');
    assert.equal(depotGroup.total, expectedDepotPanels(modules), standType);
    assert.ok(depotGroup.total > 0, standType);
    assert.equal(bom.panelAssignments.total, panelLineTotal(bom), standType);
  }
});
