import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCatalogItem,
} from '../src/catalog.js';
import { createBaseModuleState, duplicateModuleState } from '../src/designState.js';
import { getItem } from '../src/items.js';
import {
  rotateModulePlacementAroundCenter,
  snapPlacementToModules,
  snapPlacementToStand,
  validatePlacementAgainstModules,
} from '../src/modulePlacement.js';

test('baza catalog exposes 100 150 200 cm sizes at 50 x 50 cm depth and height', () => {
  const base100 = getItem('base_100');
  const base150 = getItem('base_150');
  const base200 = getItem('base_200');
  assert.deepEqual(
    [base100.dimensions.widthCm, base150.dimensions.widthCm, base200.dimensions.widthCm],
    [100, 150, 200],
  );
  assert.equal(base100.dimensions.depthCm, 50);
  assert.equal(base100.dimensions.heightCm, 50);
  // Baza kartı tek (0083, kart 100): başlık ölçüsüz, 150 / 200 ölçü penceresinden gelir.
  assert.equal(getCatalogItem('base_100').label, 'Baza');
  assert.equal(getCatalogItem('base_150'), null);
  assert.equal(getCatalogItem('base_200'), null);
  assert.equal(base150.name, 'Baza 150');
});

test('baza state has independent front left and right editable panels', () => {
  const base = createBaseModuleState(150);
  assert.equal(base.type, 'base');
  assert.equal(base.widthCm, 150);
  assert.equal(base.depthCm, 50);
  assert.equal(base.heightCm, 50);
  assert.deepEqual(Object.keys(base.faces), ['front', 'left', 'right']);
  assert.notEqual(base.faces.front.id, base.faces.left.id);
  base.faces.front.color = '#112233';
  assert.equal(base.faces.left.color, '#ffffff');
  assert.equal(createBaseModuleState(50), null);
});

test('duplicating a baza preserves design and creates independent face ids', () => {
  const source = createBaseModuleState(200);
  source.faces.right.imageAssetId = 'base-art';
  const copy = duplicateModuleState(source);
  assert.notEqual(copy.id, source.id);
  assert.equal(copy.faces.right.imageAssetId, 'base-art');
  for (const key of ['front', 'left', 'right']) {
    assert.notEqual(copy.faces[key].id, source.faces[key].id);
  }
});

test('baza uses the same 50 cm free footprint and four-direction center rotation as banko', () => {
  const placed = snapPlacementToStand({
    standType: 'u-stand',
    widthCm: 150,
    depthCm: 50,
    forceFree: true,
    pointerXCm: 220,
    pointerYCm: 20,
    standXCm: 800,
    standYCm: 600,
  });
  assert.equal(placed.ok, true);
  assert.equal(placed.placement.wallId, 'free');
  assert.equal(placed.placement.yCm, 25);

  const rotated = rotateModulePlacementAroundCenter(placed.placement, 150, 90, 50);
  assert.equal(rotated.rotationZDeg, 90);
  assert.equal((rotated.xCm - 25) % 50, 0);
  assert.equal(Math.abs(rotated.yCm % 50), 0);
});

test('all baza widths fit exact logical grid gaps next to thin Maxima modules', () => {
  [100, 150, 200].forEach((widthCm) => {
    const modules = [{
      id: 'separator',
      type: 'separator',
      widthCm: 300,
      placement: { xCm: widthCm, yCm: 0, zCm: 0, rotationZDeg: 90, wallId: 'right' },
    }];
    const snapped = snapPlacementToModules({
      moduleId: 'base',
      moduleType: 'base',
      widthCm,
      depthCm: 50,
      pointerXCm: widthCm / 2,
      pointerYCm: 125,
      rotationZDeg: 0,
      modules,
      standType: 'u-stand',
      standXCm: widthCm,
      standYCm: 400,
    });
    assert.equal(snapped?.snapKind, 'face', String(widthCm));
    assert.equal(snapped?.placement.xCm, 0, String(widthCm));
    assert.equal(validatePlacementAgainstModules({
      moduleId: 'base',
      moduleType: 'base',
      widthCm,
      depthCm: 50,
      placement: snapped.placement,
      modules,
      standType: 'u-stand',
      standXCm: widthCm,
      standYCm: 400,
    }).ok, true, String(widthCm));
  });
});

test('baza physical depth still rejects real body overlap', () => {
  const modules = [{
    id: 'base-a',
    type: 'base',
    widthCm: 150,
    depthCm: 50,
    placement: { xCm: 100, yCm: 125, zCm: 0, rotationZDeg: 0, wallId: 'free' },
  }];
  const overlap = validatePlacementAgainstModules({
    moduleId: 'base-b',
    moduleType: 'base',
    widthCm: 100,
    depthCm: 50,
    placement: { xCm: 150, yCm: 150, zCm: 0, rotationZDeg: 0, wallId: 'free' },
    modules,
    standType: 'island',
    standXCm: 800,
    standYCm: 600,
  });
  assert.equal(overlap.ok, false);
});
