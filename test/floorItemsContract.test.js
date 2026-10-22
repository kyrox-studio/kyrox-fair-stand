import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCatalogItem,
  listCatalogItems,
} from '../src/catalog.js';
import {
  getFloorItem,
  getFloorSelectLabel,
  getItem,
  isCarpetFloorItem,
  isGridTileFloorItem,
  isParquetFloorItem,
  listFloorItems,
  resolveStandFloorItemKey,
} from '../src/items.js';

const EXPECTED_SELECT = [
  ['karolaj', 'Karolaj · 100 × 100 cm'],
  ['hali', 'Halı'],
  ['parke-acik', 'Beyaz Meşe'],
  ['parke-sari', 'Sarı Meşe'],
  ['parke-beton', 'Beton Parke'],
];

test('floor Items use existing floorType keys and stay off the module catalog', () => {
  const items = listFloorItems();
  assert.deepEqual(items.map((item) => item.itemKey), EXPECTED_SELECT.map(([key]) => key));
  assert.equal(listCatalogItems().map((item) => item.itemKey).length, 60);

  for (const [itemKey, selectLabel] of EXPECTED_SELECT) {
    const item = getFloorItem(itemKey);
    assert.equal(getItem(itemKey), item);
    assert.equal(item.type, 'floor');
    assert.equal(getFloorSelectLabel(item), selectLabel);
    assert.equal(getCatalogItem(itemKey), null);
    assert.equal(getCatalogItem(itemKey) != null, false);
  }

  const karolaj = getItem('karolaj');
  const hali = getItem('hali');
  assert.equal(karolaj.dimensions.widthCm, 100);
  assert.equal(karolaj.dimensions.depthCm, 100);
  assert.equal(karolaj.defaultColor, 0xe9edf1);
  assert.equal(karolaj.paintable, true);
  assert.equal(hali.defaultColor, 0x8b8f94);
  assert.equal(hali.paintable, true);
  assert.equal(Object.hasOwn(hali, 'dimensions'), false);

  assert.equal(isParquetFloorItem(getItem('parke-acik')), true);
  assert.equal(getItem('parke-acik').dimensions.widthCm, 140);
  assert.equal(getItem('parke-acik').dimensions.depthCm, 16);
  assert.equal(getItem('parke-sari').dimensions.widthCm, 140);
  assert.equal(getItem('parke-beton').dimensions.widthCm, 112);
  assert.equal(getItem('parke-beton').dimensions.depthCm, 28);
  assert.equal(getItem('parke-beton').paintable, false);
  assert.equal(getFloorItem('parke'), null);
  assert.equal(isGridTileFloorItem(karolaj), true);
  assert.equal(isCarpetFloorItem(hali), true);
  assert.equal(isCarpetFloorItem(karolaj), false);
  assert.equal(resolveStandFloorItemKey({ floorType: 'hali' }), 'karolaj');
  assert.equal(resolveStandFloorItemKey({ itemKey: 'parke-beton', floorType: 'hali' }), 'parke-beton');
  assert.equal(resolveStandFloorItemKey({ itemKey: 'hali' }), 'hali');
});
