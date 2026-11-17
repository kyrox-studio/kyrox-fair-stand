import test from 'node:test';
import assert from 'node:assert/strict';

import { detectBoxRunJoints, resolveBoxRunEnds } from '../src/boxRunJoints.js';
import { createModuleStateFromCatalogKey } from '../src/designState.js';
import { resolveProjectBom } from '../src/projectBom.js';
import { resolveWallCornerEnds } from '../src/wallCornerJoints.js';

// Yan yana baza / banko (kullanıcı kararı 2026-11-16): ortak uçta dikme ve yan profil tek; aradaki
// yan paneller ve aparatları düşer; sahne aynı uçta tek dikme çizer.
function box(itemKey, id, xCm, yCm = 0, rotationZDeg = 0) {
  const module = createModuleStateFromCatalogKey(itemKey);
  module.id = id;
  module.placement = { xCm, yCm, zCm: 0, rotationZDeg, wallId: 'free' };
  return module;
}

function row(itemKey, count, { rotationZDeg = 0, vertical = false } = {}) {
  return Array.from({ length: count }, (_, index) => box(
    itemKey,
    `m${index}`,
    vertical ? 0 : index * 100,
    vertical ? index * 100 : 0,
    rotationZDeg,
  ));
}

function totals(modules) {
  return Object.fromEntries(resolveProjectBom(modules).lines.map((line) => [line.itemKey, line.quantity]));
}

test('yan yana iki banko: ortak uçta dikme ve 41,5 tek, aradaki dört yan panel ve aparatı düşer', () => {
  const single = totals(row('desk_banko_100', 1));
  const pair = totals(row('desk_banko_100', 2));
  assert.equal(pair.upright_99, 2 * single.upright_99 - 2);
  assert.equal(pair.profile_41_5, 2 * single.profile_41_5 - 2);
  assert.equal(pair.panel_48_5, 2 * single.panel_48_5 - 4);
  assert.equal(pair.connector_start, 2 * single.connector_start - 4);
  assert.equal(pair.connector_single, 2 * single.connector_single - 8);
  // Ön paneller, ön profiller ve tabla değişmez.
  assert.equal(pair.panel_98, 2 * single.panel_98);
  assert.equal(pair.profile_91, 2 * single.profile_91);
  assert.equal(pair.counter_top_110_60, 2);
});

test('üç banko: iki birleşim; yön ve dönüş sayımı değiştirmez', () => {
  const expected = { upright_99: 8, profile_41_5: 8, panel_48_5: 4 };
  for (const options of [{}, { rotationZDeg: 180 }, { rotationZDeg: 90, vertical: true }, { rotationZDeg: 270, vertical: true }]) {
    const result = totals(row('desk_banko_100', 3, options));
    for (const [key, quantity] of Object.entries(expected)) assert.equal(result[key], quantity, `${key} ${JSON.stringify(options)}`);
  }
});

test('birleşmeyen bankolar: aralıklı, farklı derinlik hattı ya da L banko', () => {
  const gap = [box('desk_banko_100', 'a', 0), box('desk_banko_100', 'b', 110)];
  assert.equal(detectBoxRunJoints(gap).length, 0);
  const shifted = [box('desk_banko_100', 'a', 0), box('desk_banko_100', 'b', 100, 20)];
  assert.equal(detectBoxRunJoints(shifted).length, 0);
  const withL = [box('desk_banko_100', 'a', 0), box('desk_banko_100_l', 'b', 100)];
  assert.equal(detectBoxRunJoints(withL).length, 0);
  // Baza ile banko aynı aile değildir.
  const mixed = [box('base_100', 'a', 0), box('desk_banko_100', 'b', 100)];
  assert.equal(detectBoxRunJoints(mixed).length, 0);
});

test('yan yana baza: liste dizi formülünde, panel dökümünde aradaki yanaklar sayılmaz', () => {
  const pair = row('base_100', 2);
  const result = resolveProjectBom(pair);
  const quantity = (key) => result.lines.find((line) => line.itemKey === key)?.quantity;
  assert.equal(quantity('upright_49_5'), 6);
  assert.equal(quantity('profile_41_5'), 6);
  const sideFaceIds = new Set([pair[0].faces.right.id, pair[1].faces.left.id]);
  const counted = result.modules.flatMap((entry) => entry.panelSurfaces ?? []);
  assert.equal(counted.some((surface) => sideFaceIds.has(surface.id)), false);
  assert.equal(counted.some((surface) => surface.id === pair[0].faces.left.id), true);
});

test('sahne: birleşimin önceki modülü dikmeyi çizer, sonraki o uçta çizmez; uç yönü dönüşe göre', () => {
  const ends = resolveBoxRunEnds(row('desk_banko_100', 2));
  assert.deepEqual(ends.get('m0'), [{ boxRun: true, localXSign: 1, ownsPost: true }]);
  assert.deepEqual(ends.get('m1'), [{ boxRun: true, localXSign: -1, ownsPost: false }]);
  const turned = resolveBoxRunEnds(row('desk_banko_100', 2, { rotationZDeg: 180 }));
  assert.equal(turned.get('m0')[0].localXSign, -1);
  assert.equal(turned.get('m1')[0].localXSign, 1);
  // Köşe / birleşim çözümü aynı uçları sahneye taşır.
  const corner = resolveWallCornerEnds(row('base_100', 3));
  assert.equal(corner.get('m1').filter((end) => end.boxRun).length, 2);
});
