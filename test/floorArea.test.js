import test from 'node:test';
import { getItem } from '../src/items.js';
import assert from 'node:assert/strict';

import {
  defaultFloorAreaRect,
  floorFrameBarCounts,
  floorTilePieceCounts,
  rectangleFromCorners,
  resolveSplitFloorBomLines,
  validateFloorArea,
} from '../src/floorArea.js';
import { getFloorItem } from '../src/items.js';
import { resolveProjectBom } from '../src/projectBom.js';
import { PROJECT_ARCHIVE_VERSION } from '../src/projectImportValidation.js';

const stand = { standType: 'island', xCm: 500, yCm: 500, itemKey: 'hali' };

// Halının birimi DB'den (metre_kare).
const HALI_UNIT = getItem('hali').unit;

function quantities(bom) {
  return bom.lines
    .filter((line) => ['hali', 'karolaj', 'karolaj_yarim', 'parke-acik', 'parke-sari', 'parke-beton'].includes(line.itemKey))
    .map((line) => [line.itemKey, line.quantity, line.unit]);
}

test('500x500 hali plus 200x300 karolaj bills 19 m2 and 6 tiles', () => {
  const bom = resolveProjectBom([], {
    ...stand,
    floorArea: { xCm: 100, yCm: 100, widthCm: 200, depthCm: 300, itemKey: 'karolaj', color: null },
  });
  assert.deepEqual(quantities(bom), [
    ['hali', 19, HALI_UNIT],
    ['karolaj', 6, 'adet'],
  ]);
  assert.equal(bom.modules.length, 0);
});


test('a stand without floorArea keeps the legacy single-floor bill', () => {
  const hali = resolveProjectBom([], { xCm: 500, yCm: 400, itemKey: 'hali' });
  assert.deepEqual(quantities(hali), [['hali', 20, HALI_UNIT]]);

  const even = resolveProjectBom([], { xCm: 500, yCm: 400, itemKey: 'karolaj' });
  assert.deepEqual(quantities(even), [['karolaj', 20, 'adet']]);

  const partial = resolveProjectBom([], { xCm: 550, yCm: 400, itemKey: 'karolaj' });
  assert.deepEqual(quantities(partial), [['karolaj', 20, 'adet'], ['karolaj_yarim', 4, 'adet']]);
  assert.equal(resolveSplitFloorBomLines({ xCm: 550, yCm: 400, itemKey: 'karolaj' }), null);
});

test('karolaj edge pieces are listed as half tiles; the 50x50 corner counts as half', () => {
  assert.deepEqual(
    quantities(resolveProjectBom([], { xCm: 350, yCm: 350, itemKey: 'karolaj' })),
    [['karolaj', 9, 'adet'], ['karolaj_yarim', 7, 'adet']],
  );
  assert.deepEqual(
    quantities(resolveProjectBom([], { xCm: 50, yCm: 50, itemKey: 'karolaj' })),
    [['karolaj_yarim', 1, 'adet']],
  );
  assert.deepEqual(
    floorTilePieceCounts({ xCm: 450, yCm: 300 }, getFloorItem('karolaj')),
    { full: 12, half: 3 },
  );
});

test('karolaj frame bars share tile edges: 1 tile 4, 2 tiles 7, 3 tiles 10', () => {
  const bars = (stand) => resolveProjectBom([], { ...stand, itemKey: 'karolaj' }).lines
    .filter((line) => line.itemKey.startsWith('profile_karolaj_'))
    .map((line) => [line.itemKey, line.quantity, line.unit]);
  assert.deepEqual(bars({ xCm: 100, yCm: 100 }), [['profile_karolaj_100', 4, 'adet']]);
  assert.deepEqual(bars({ xCm: 200, yCm: 100 }), [['profile_karolaj_100', 7, 'adet']]);
  assert.deepEqual(bars({ xCm: 300, yCm: 100 }), [['profile_karolaj_100', 10, 'adet']]);
  // Kullanıcı örneği: 6 × 3,5 m → 51 adet 1 m + 7 adet 50 cm.
  assert.deepEqual(bars({ xCm: 600, yCm: 350 }), [
    ['profile_karolaj_100', 51, 'adet'],
    ['profile_karolaj_50', 7, 'adet'],
  ]);
  // Genişlik de yarım: son sütunun yatay kenarları 50 cm.
  assert.deepEqual(bars({ xCm: 650, yCm: 350 }), [
    ['profile_karolaj_100', 54, 'adet'],
    ['profile_karolaj_50', 13, 'adet'],
  ]);
  const counts = floorFrameBarCounts({ xCm: 50, yCm: 50 }, getFloorItem('karolaj'));
  assert.deepEqual([...counts], [[50, 4]]);
});

test('split floor counts frame bars only under the karolaj area', () => {
  const bom = resolveProjectBom([], {
    xCm: 500,
    yCm: 500,
    itemKey: 'hali',
    floorArea: { xCm: 100, yCm: 100, widthCm: 150, depthCm: 100, itemKey: 'karolaj', color: null },
  });
  assert.deepEqual(
    bom.lines
      .filter((line) => line.itemKey.startsWith('profile_karolaj_'))
      .map((line) => [line.itemKey, line.quantity]),
    [['profile_karolaj_100', 5], ['profile_karolaj_50', 2]],
  );
});

test('split floor counts karolaj pieces on the tile grid from the stand corner', () => {
  const area = resolveProjectBom([], {
    xCm: 500,
    yCm: 500,
    itemKey: 'hali',
    floorArea: { xCm: 100, yCm: 100, widthCm: 150, depthCm: 100, itemKey: 'karolaj', color: null },
  });
  assert.deepEqual(quantities(area), [
    ['hali', 23.5, HALI_UNIT],
    ['karolaj', 1, 'adet'],
    ['karolaj_yarim', 1, 'adet'],
  ]);

  const base = resolveProjectBom([], {
    xCm: 500,
    yCm: 500,
    itemKey: 'karolaj',
    floorArea: { xCm: 100, yCm: 100, widthCm: 50, depthCm: 100, itemKey: 'hali', color: null },
  });
  assert.deepEqual(quantities(base), [
    ['karolaj', 24, 'adet'],
    ['karolaj_yarim', 1, 'adet'],
    ['hali', 0.5, HALI_UNIT],
  ]);
});

test('an override with the same Item does not split the legacy bill', () => {
  const bom = resolveProjectBom([], {
    xCm: 500,
    yCm: 500,
    itemKey: 'hali',
    floorArea: { xCm: 100, yCm: 100, widthCm: 200, depthCm: 200, itemKey: 'hali' },
  });
  assert.deepEqual(quantities(bom), [['hali', 25, HALI_UNIT]]);
});

test('floor area stays on the 50 cm grid and inside the stand', () => {
  assert.equal(validateFloorArea({
    xCm: 100, yCm: 100, widthCm: 430, depthCm: 200, itemKey: 'parke-acik',
  }, stand).ok, false);
  assert.equal(validateFloorArea({
    xCm: 100, yCm: 100, widthCm: 460, depthCm: 200, itemKey: 'parke-acik',
  }, stand).ok, false);
  assert.equal(validateFloorArea({
    xCm: 100, yCm: 100, widthCm: 480, depthCm: 200, itemKey: 'parke-acik',
  }, stand).ok, false);
  assert.equal(validateFloorArea({
    xCm: 0, yCm: 100, widthCm: 450, depthCm: 200, itemKey: 'parke-acik',
  }, stand).ok, true);
  assert.equal(validateFloorArea({
    xCm: 400, yCm: 0, widthCm: 200, depthCm: 200, itemKey: 'hali',
  }, stand).ok, false);

  const snapped = rectangleFromCorners(
    { xCm: 80, yCm: 80 },
    { xCm: 430, yCm: 260 },
    stand,
  );
  assert.equal(snapped.ok, true);
  assert.equal(snapped.area.xCm % 50, 0);
  assert.equal(snapped.area.widthCm % 50, 0);
  assert.ok(snapped.area.xCm + snapped.area.widthCm <= 500);
});

test('parquet override drops a paint color; carpet keeps it', () => {
  const parquet = validateFloorArea({
    xCm: 50, yCm: 50, widthCm: 200, depthCm: 200, itemKey: 'parke-acik', color: '#112233',
  }, stand);
  assert.equal(parquet.area.color, null);

  const carpet = validateFloorArea({
    xCm: 50, yCm: 50, widthCm: 200, depthCm: 200, itemKey: 'hali', color: '#112233',
  }, { ...stand, itemKey: 'karolaj' });
  assert.equal(carpet.area.color, '#112233');
});

test('default inset is one rectangle and archive version stays 1', () => {
  assert.deepEqual(defaultFloorAreaRect(stand), {
    xCm: 100, yCm: 100, widthCm: 300, depthCm: 300,
  });
  assert.equal(validateFloorArea(null, stand).area, null);
  assert.equal(PROJECT_ARCHIVE_VERSION, 1);
});
