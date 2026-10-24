import test from 'node:test';
import assert from 'node:assert/strict';

import { createModuleStateFromCatalogKey, normalizeModuleItemState } from '../src/designState.js';
import { resolveProjectBom } from '../src/projectBom.js';

function shortPanel(itemKey, id, xCm, yCm = 0, rotationZDeg = 180, zCm = 300) {
  const module = createModuleStateFromCatalogKey(itemKey);
  module.id = id;
  module.placement = { xCm, yCm, zCm, rotationZDeg, wallId: 'free' };
  return module;
}

function upright(id, xCm, yCm, rotationZDeg = 180) {
  const module = createModuleStateFromCatalogKey('upright_346_5');
  module.id = id;
  module.placement = { xCm, yCm, zCm: 0, rotationZDeg, wallId: 'free' };
  return module;
}

const quantity = (modules, itemKey) => resolveProjectBom(modules).lines
  .filter((line) => line.itemKey === itemKey)
  .reduce((sum, line) => sum + Number(line.quantity), 0);

test('uç uca kısa panel birleşiminde tam boy dikme varsa kalan tek 49,5 de düşer', () => {
  const left = shortPanel('wall_200_short_1', 'short-a', 0);
  const right = shortPanel('wall_200_short_1', 'short-b', 200);
  // Birleşim yalnız iki panelle: 3 dikme (iki dış uç + ortak uç).
  assert.equal(quantity([left, right], 'upright_49_5'), 3);
  // Birleşimde tam boy dikme: ortak uç dikmesi de düşer, yalnız iki dış uç kalır.
  const post = upright('post', 196, 0);
  assert.equal(quantity([left, right, post], 'upright_49_5'), 2);
});

test('köşe kısa panel birleşiminde tam boy dikme varsa köşe 49,5 düşer', () => {
  const front = shortPanel('wall_200_short_1', 'front', 0, 0, 180);
  const side = shortPanel('wall_200_short_1', 'side', 0, 0, 270);
  const withoutPost = quantity([front, side], 'upright_49_5');
  const post = upright('corner', 0, 0, 270);
  assert.equal(quantity([front, side, post], 'upright_49_5'), withoutPost - 1);
});

for (const level of [1, 2]) {
  for (const width of [50, 100, 150, 200]) {
    for (const rotation of [0, 90, 180, 270]) {
      test(`ortak uç: ${level} sıra, ${width} cm, ${rotation} derece; taşıyıcı bir kez ikame eder`, () => {
        const vertical = rotation === 90 || rotation === 270;
        const key = `wall_${width}_short_${level}`;
        const uprightKey = level === 1 ? 'upright_49_5' : 'upright_99';
        const z = level === 1 ? 300 : 250;
        const a = shortPanel(key, 'a', 0, 0, rotation, z);
        const b = shortPanel(key, 'b', vertical ? 0 : width, vertical ? width : 0, rotation, z);
        const post = upright('post', vertical ? 0 : width - 4, vertical ? width - 4 : 0, rotation);
        assert.equal(quantity([a, b], uprightKey), 3);
        const inputs = [[a, b, post], [b, post, a], [post, a, b], [post, b, a]];
        for (const modules of inputs) {
          assert.equal(quantity(modules, uprightKey), 2);
          assert.equal(quantity(modules, 'upright_346_5'), 1);
        }
        const duplicate = { ...structuredClone(post), id: 'post-2' };
        assert.equal(quantity([a, b, post, duplicate], uprightKey), 2);
        assert.equal(quantity([a, b, post, duplicate], 'upright_346_5'), 2);
      });
    }
  }
}

test('taşıyıcı birleşimden uzakta, gövde ortasında veya yükseklik bandı dışındaysa ortak dikme kalır', () => {
  const pair = [shortPanel('wall_200_short_1', 'a', 0), shortPanel('wall_200_short_1', 'b', 200)];
  const outsideBand = upright('above', 196, 0);
  outsideBand.placement.zCm = 400;
  const tooShort = createModuleStateFromCatalogKey('upright_297');
  tooShort.id = 'too-short';
  tooShort.placement = { xCm: 196, yCm: 0, zCm: 0, rotationZDeg: 180, wallId: 'free' };
  const partialBand = upright('partial', 196, 0);
  partialBand.placement.zCm = 320;
  for (const post of [upright('far', 500, 0), upright('middle', 96, 0),
    upright('wrong-line', 196, 20), outsideBand, tooShort, partialBand]) {
    assert.equal(quantity([...pair, post], 'upright_49_5'), 3, post.id);
  }
});

test('mevcut 3,5 cm üst boşluk toleransının dışındaki taşıyıcı ortak dikmeyi kaldırmaz', () => {
  const pair = [shortPanel('wall_200_short_1', 'a', 0), shortPanel('wall_200_short_1', 'b', 200)];
  const post = upright('post', 196, 0);
  assert.equal(quantity([...pair, post], 'upright_49_5'), 2);
  post.placement.zCm = -0.1;
  assert.equal(quantity([...pair, post], 'upright_49_5'), 3);
});

test('49,5 ve 99 aynı uçta birleşince yalnız kalan uzun kısa dikme ikame edilir', () => {
  const a = shortPanel('wall_100_short_1', 'a', 0);
  const b = shortPanel('wall_200_short_2', 'b', 100, 0, 180, 250);
  const post = upright('post', 96, 0);
  assert.equal(quantity([a, b], 'upright_49_5'), 1);
  assert.equal(quantity([a, b], 'upright_99'), 2);
  assert.equal(quantity([a, b, post], 'upright_49_5'), 1);
  assert.equal(quantity([a, b, post], 'upright_99'), 1);
});

test('farklı yükseklik bantları tek ortak dikme gibi birleştirilmez', () => {
  const a = shortPanel('wall_200_short_1', 'a', 0, 0, 180, 200);
  const b = shortPanel('wall_200_short_1', 'b', 200, 0, 180, 300);
  assert.equal(quantity([a, b], 'upright_49_5'), 4);
  assert.equal(quantity([a, b, upright('post', 196, 0)], 'upright_49_5'), 2);
});

test('üç kısa panelin iki birleşimi ayrı izlenir; tekrarlı taşıyıcı fazla düşüm yapmaz', () => {
  const panels = [0, 100, 200].map((x, i) => shortPanel('wall_100_short_1', `s${i}`, x));
  assert.equal(quantity(panels, 'upright_49_5'), 4);
  const posts = [upright('p1', 96, 0), upright('p2', 196, 0)];
  assert.equal(quantity([...panels, ...posts], 'upright_49_5'), 2);
  const allEnds = [upright('left', -4, 0), ...posts, upright('right', 296, 0), upright('duplicate', 96, 0)];
  assert.equal(quantity([...panels, ...allEnds], 'upright_49_5'), 0);
});

test('kayıt ve açılış normalizasyonu BOM sonucunu korur; hesap proje verisini değiştirmez', () => {
  const modules = [shortPanel('wall_200_short_1', 'a', 0), shortPanel('wall_200_short_1', 'b', 200), upright('post', 196, 0)];
  const before = structuredClone(modules);
  const rows = ms => resolveProjectBom(ms).lines.map(({ itemKey, quantity, unit }) => ({ itemKey, quantity, unit }))
    .sort((a, b) => a.itemKey.localeCompare(b.itemKey));
  const expected = rows(modules);
  assert.deepEqual(modules, before);
  const reopened = JSON.parse(JSON.stringify(modules)).map(normalizeModuleItemState);
  assert.deepEqual(rows(reopened), expected);
});
