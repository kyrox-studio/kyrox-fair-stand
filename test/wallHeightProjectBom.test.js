import test from 'node:test';
import assert from 'node:assert/strict';

import './registerCanonicalItemCatalog.mjs';
import { resolveProjectBom } from '../src/projectBom.js';
import { buildWallHeightProjectModules } from './wallHeightProjects.mjs';

// Her duvar yüksekliğinde aynı L stand projesi (test/wallHeightProjects.mjs): 9 modül,
// 6 yan yana, 1 köşe, 1 T. B = yükseklik / 50. 350’deki değerler eski kilitli sayılardır.
const UPRIGHT_BY_HEIGHT = {
  250: 'upright_247_5',
  300: 'upright_297',
  350: 'upright_346_5',
  400: 'upright_396',
  450: 'upright_445_5',
  500: 'upright_495',
};

for (const [heightText, uprightKey] of Object.entries(UPRIGHT_BY_HEIGHT)) {
  const heightCm = Number(heightText);
  const bands = heightCm / 50;

  test(`${heightCm} cm L stand: joints, uprights, panels and connectors follow the band rule`, () => {
    const bom = resolveProjectBom(buildWallHeightProjectModules(heightCm));
    const qty = (itemKey) => bom.lines.find((line) => line.itemKey === itemKey)?.quantity ?? 0;

    // Bütün modüller çözüldü; 6 yan yana, 1 köşe, 1 T.
    assert.equal(bom.unresolved.length, 0);
    assert.equal(bom.appliedEndToEndCount, 6);
    assert.equal(bom.appliedCornerCount, 1);
    assert.equal(bom.appliedTeeCount, 1);

    // Dikme: 9 modül × 2 − 8 birleşim; yalnız bu yüksekliğin dikmesi.
    assert.equal(qty(uprightKey), 10);
    for (const otherKey of Object.values(UPRIGHT_BY_HEIGHT).filter((key) => key !== uprightKey)) {
      assert.equal(qty(otherKey), 0, otherKey);
    }

    // Panel aileleri (köşe paneline dönüşenler dahil).
    assert.equal(qty('panel_197') + qty('panel_corner_192'), 3 * bands); // 3 × wall_200
    assert.equal(qty('panel_98') + qty('panel_corner_92'), 3 * bands - 6); // kapı B−4, vitrin B−2, wall_100 B
    assert.equal(qty('separator_panel_48_5'), 2 * bands); // iki 50 ayırıcı
    assert.equal(qty('separator_panel_98'), bands); // T ayırıcı

    // Aparatlar.
    assert.equal(qty('connector_start'), 20);
    assert.equal(qty('connector_double'), 6 * bands - 10); // yan yana: B + (B−4) + (B−4) + (B−2) + B + B
    assert.equal(qty('connector_corner'), 3 * (bands - 1)); // köşe iki taraf + T bir taraf
    assert.equal(qty('connector_single'), 3 * bands - 4);

    // Yükseklikten bağımsız parçalar.
    assert.equal(qty('profile_190'), 6);
    assert.equal(qty('profile_91'), 9);
    assert.equal(qty('profile_41_5'), 4);
    assert.equal(qty('door_leaf_100'), 1);
    assert.equal(qty('glass_shelf'), 1);
  });
}
