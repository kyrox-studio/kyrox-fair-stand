import test from 'node:test';
import assert from 'node:assert/strict';

import './registerCanonicalItemCatalog.mjs';
import { createModulePlacement, rotateModulePlacementAroundCenter } from '../src/modulePlacement.js';
import { resolveProjectBom } from '../src/projectBom.js';
import { STAND_DIMENSIONS } from '../src/standDimensions.js';

// Korunan davranışlar (yerleşim / baza BOM pilot taraması, 2026-11-11). Kaynak karar:
// PENDING_ITEM_DECISIONS.md B.13 Baza; REFACTOR.md 2026-10-19 duvar yüksekliği (baza host listesi).

function qty(bom, itemKey) {
  const line = bom.lines.find((entry) => entry.itemKey === itemKey);
  return line ? line.quantity : 0;
}

const FLUSH_CM = (50 + STAND_DIMENSIONS.depthCm) / 2;

function baza(id, itemKey, widthCm, { xCm = 0, yCm = FLUSH_CM, rotationZDeg = 0 } = {}) {
  return {
    id,
    itemKey,
    type: 'base',
    widthCm,
    depthCm: 50,
    placement: createModulePlacement({ xCm, yCm, rotationZDeg, wallId: 'free' }),
  };
}

function host(id, itemKey, widthCm, { xCm = 0, yCm = 0, rotationZDeg = 0 } = {}) {
  return { id, itemKey, widthCm, placement: createModulePlacement({ xCm, yCm, rotationZDeg }) };
}

test('wall_200 dört çeyrek dönüşte merkezini korur ve başa döner', () => {
  const start = { xCm: 300, yCm: 200, zCm: 0, rotationZDeg: 0, wallId: 'free' };
  let placement = start;
  const centers = [];
  for (let turn = 0; turn < 4; turn += 1) {
    placement = rotateModulePlacementAroundCenter(placement, 200, 90);
    const vertical = placement.rotationZDeg === 90 || placement.rotationZDeg === 270;
    centers.push({
      xCm: placement.xCm + (vertical ? 0 : 100),
      yCm: placement.yCm + (vertical ? 100 : 0),
    });
  }
  centers.forEach((center) => assert.deepEqual(center, { xCm: 400, yCm: 200 }));
  assert.deepEqual(placement, start);
});

test('türetilmiş yükseklikteki duvar (wall_200_250) baza host’udur', () => {
  const bom = resolveProjectBom([
    host('wall', 'wall_200_250', 200),
    baza('base', 'base_200', 200),
  ]);
  assert.equal(qty(bom, 'upright_49_5'), 2);
  assert.equal(qty(bom, 'profile_190'), 4);
});

test('short (wall_200_short_2) baza host’u değildir', () => {
  const bom = resolveProjectBom([
    host('short', 'wall_200_short_2', 200),
    baza('base', 'base_200', 200),
  ]);
  assert.equal(qty(bom, 'upright_49_5'), 4);
});

test('dikey (90°) duvar sırtındaki dikey baza da host sayılır', () => {
  const bom = resolveProjectBom([
    host('wall', 'wall_200_350', 200, { xCm: 0, yCm: 0, rotationZDeg: 90 }),
    baza('base', 'base_200', 200, { xCm: FLUSH_CM, yCm: 0, rotationZDeg: 90 }),
  ]);
  assert.equal(qty(bom, 'upright_49_5'), 2);
  assert.equal(qty(bom, 'profile_190'), 4);
});

// B.13: "Paylaşılan arka dikme bir kez düşer." Dizideki iki baza farklı yüzlerden host'a yaslıysa
// ortak sınırdaki iki dikme ayrı hatlardadır (biri arka, biri ön); ikisi de düşer.
test('iki baza karşı yüzlerden host’a yaslıysa her yüzün dikmesi ayrı düşer', () => {
  const bom = resolveProjectBom([
    host('w1', 'wall_200_350', 200, { xCm: 0, yCm: 0 }),
    host('w2', 'wall_200_350', 200, { xCm: 200, yCm: 2 * FLUSH_CM }),
    baza('a', 'base_200', 200, { xCm: 0 }),
    baza('b', 'base_200', 200, { xCm: 200 }),
  ]);
  // 2 baza = 6 köşe dikmesi; w1 arka hattın 0 ve 1. dikmesini, w2 ön hattın 1 ve 2. dikmesini alır.
  assert.equal(qty(bom, 'upright_49_5'), 2);
});
