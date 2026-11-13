import test from 'node:test';
import assert from 'node:assert/strict';

import { createModulePlacement } from '../src/modulePlacement.js';
import { resolveProjectBom } from '../src/projectBom.js';
import { resolveWallCornerEnds } from '../src/wallCornerJoints.js';

// Köşe birleşimi sahne çizimi (kullanıcı kararı 2026-11-12): köşede tek ortak dikme çizilir.
// Bu okuma yalnız renderer içindir; üretim listesi aynı kalır.

function wall(id, { xCm, yCm, rotationZDeg, widthCm = 200, itemKey = 'wall_200_350', type = 'flat-panel' } = {}) {
  return {
    id,
    type,
    itemKey,
    widthCm,
    depthCm: 10,
    placement: createModulePlacement({ xCm, yCm, rotationZDeg }),
  };
}

function qty(bom, itemKey) {
  return bom.lines.find((line) => line.itemKey === itemKey)?.quantity ?? 0;
}

test('iç köşe: iki duvar köşedeki ucunu bilir, ortak dikmeyi kimliği küçük olan çizer', () => {
  // U Stand arka sağ köşesi: arka duvar 300–500 (ön +y), sağ duvar x=500'de 0–200 (ön −x).
  const modules = [wall('a', { xCm: 300, yCm: 0, rotationZDeg: 0 }), wall('b', { xCm: 500, yCm: 0, rotationZDeg: 270 })];
  const ends = resolveWallCornerEnds(modules);
  assert.deepEqual(ends.get('a'), [{ localXSign: 1, ownsPost: true }]);
  assert.deepEqual(ends.get('b'), [{ localXSign: -1, ownsPost: false }]);
});

test('dış köşe: ön yüzler dışa bakınca da uçlar ve tek sahip aynı kuralla bulunur', () => {
  const modules = [
    wall('a', { xCm: 300, yCm: 0, rotationZDeg: 180 }),
    wall('b', { xCm: 500, yCm: 0, rotationZDeg: 90 }),
  ];
  const ends = resolveWallCornerEnds(modules);
  assert.deepEqual(ends.get('a'), [{ localXSign: -1, ownsPost: true }]);
  assert.deepEqual(ends.get('b'), [{ localXSign: 1, ownsPost: false }]);
});

test('yan yana birleşim köşe dikmesi kuralına girmez', () => {
  assert.equal(resolveWallCornerEnds([
    wall('a', { xCm: 0, yCm: 0, rotationZDeg: 0 }),
    wall('b', { xCm: 200, yCm: 0, rotationZDeg: 0 }),
  ]).size, 0);
});

test('separatör ve vitrin köşesi: ortak dikmeyi kimliği büyük olsa da duvar çizer', () => {
  const separator = resolveWallCornerEnds([
    wall('a-sep', { xCm: 300, yCm: 0, rotationZDeg: 0, widthCm: 50, itemKey: 'wall_separator_50_350', type: 'separator' }),
    wall('z-wall', { xCm: 350, yCm: 0, rotationZDeg: 270 }),
  ]);
  assert.equal(separator.get('a-sep')[0].ownsPost, false);
  assert.equal(separator.get('z-wall')[0].ownsPost, true);
  const showcase = resolveWallCornerEnds([
    wall('a-case', { xCm: 300, yCm: 0, rotationZDeg: 0, widthCm: 100, itemKey: 'wall_showcase_100_2_350', type: 'showcase-2' }),
    wall('z-wall', { xCm: 400, yCm: 0, rotationZDeg: 270 }),
  ]);
  assert.equal(showcase.get('a-case')[0].ownsPost, false);
  assert.equal(showcase.get('a-case')[0].localXSign, 1);
  assert.equal(showcase.get('z-wall')[0].ownsPost, true);
});

test('kısa duvar köşesi: ortak dikmeyi üretim listesinin tuttuğu (kapsayan) modül çizer', () => {
  // İki aynı kısa duvar: kimliği küçük olan düşer, öteki tutulur ve çizer.
  const shorts = resolveWallCornerEnds([
    wall('s1', { xCm: 300, yCm: 0, rotationZDeg: 0, itemKey: 'wall_200_short_2' }),
    wall('s2', { xCm: 500, yCm: 0, rotationZDeg: 270, itemKey: 'wall_200_short_2' }),
  ]);
  assert.equal(shorts.get('s1')?.length, 1);
  assert.equal(shorts.get('s2')?.length, 1);
  assert.equal([shorts.get('s1')[0], shorts.get('s2')[0]].filter((end) => end.ownsPost).length, 1);
  // Tam boy duvar + kısa duvar: tam boy duvar dikmesini tutar ve çizer.
  const mixed = resolveWallCornerEnds([
    wall('a-short', { xCm: 300, yCm: 0, rotationZDeg: 0, itemKey: 'wall_200_short_2' }),
    wall('z-wall', { xCm: 500, yCm: 0, rotationZDeg: 270 }),
  ]);
  assert.equal(mixed.get('a-short')[0].ownsPost, false);
  assert.equal(mixed.get('z-wall')[0].ownsPost, true);
});

test('köşe dikmesi çizimi üretim listesini değiştirmez: iki duvarlı iç köşe 3 dikme', () => {
  const modules = [wall('a', { xCm: 300, yCm: 0, rotationZDeg: 0 }), wall('b', { xCm: 500, yCm: 0, rotationZDeg: 270 })];
  resolveWallCornerEnds(modules);
  const bom = resolveProjectBom(modules);
  assert.equal(bom.appliedCornerCount, 1);
  assert.equal(qty(bom, 'upright_346_5'), 3);
});
