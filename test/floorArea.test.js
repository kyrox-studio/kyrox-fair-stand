import test from 'node:test';
import assert from 'node:assert/strict';

import {
  defaultFloorAreaRect,
  rectangleFromCorners,
  resolveSplitFloorBomLines,
  validateFloorArea,
} from '../src/floorArea.js';
import { resolveProjectBom } from '../src/projectBom.js';
import { PROJECT_ARCHIVE_VERSION } from '../src/projectImportValidation.js';

const stand = { standType: 'island', xCm: 500, yCm: 500, itemKey: 'hali' };

function quantities(bom) {
  return bom.lines
    .filter((line) => ['hali', 'karolaj', 'parke-acik', 'parke-sari', 'parke-beton'].includes(line.itemKey))
    .map((line) => [line.itemKey, line.quantity, line.unit]);
}

test('500x500 hali plus 200x300 karolaj bills 19 m2 and 6 tiles', () => {
  const bom = resolveProjectBom([], {
    ...stand,
    floorArea: { xCm: 100, yCm: 100, widthCm: 200, depthCm: 300, itemKey: 'karolaj', color: null },
  });
  assert.deepEqual(quantities(bom), [
    ['hali', 19, 'm2'],
    ['karolaj', 6, 'adet'],
  ]);
  assert.equal(bom.modules.length, 0);
});


test('a stand without floorArea keeps the legacy single-floor bill', () => {
  const hali = resolveProjectBom([], { xCm: 500, yCm: 400, itemKey: 'hali' });
  assert.deepEqual(quantities(hali), [['hali', 20, 'm2']]);

  const even = resolveProjectBom([], { xCm: 500, yCm: 400, itemKey: 'karolaj' });
  assert.deepEqual(quantities(even), [['karolaj', 20, 'adet']]);

  const partial = resolveProjectBom([], { xCm: 550, yCm: 400, itemKey: 'karolaj' });
  assert.equal(partial.lines[0].quantity, 24);
  assert.equal(resolveSplitFloorBomLines({ xCm: 550, yCm: 400, itemKey: 'karolaj' }), null);
});

test('an override with the same Item does not split the legacy bill', () => {
  const bom = resolveProjectBom([], {
    xCm: 500,
    yCm: 500,
    itemKey: 'hali',
    floorArea: { xCm: 100, yCm: 100, widthCm: 200, depthCm: 200, itemKey: 'hali' },
  });
  assert.deepEqual(quantities(bom), [['hali', 25, 'm2']]);
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
