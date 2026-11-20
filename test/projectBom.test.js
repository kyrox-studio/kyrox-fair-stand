import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveSplitFloorBomLines } from '../src/floorArea.js';
import { resolveItemBom } from '../src/itemBom.js';
import { resolveProjectBom } from '../src/projectBom.js';
import { getItem, initializeItemRegistry, listRegisteredItems } from '../src/items.js';
import { loadCanonicalItemCatalog } from './registerCanonicalItemCatalog.mjs';

// Her projeye eklenen üretim kalemi (DB: elektrik panosu; `DEFAULT_PROJECT_ITEM_KEY`). Donanım satırları onsuz okunur.
const projectLine = (line) => line.itemKey === 'elektrik_panosu';
const hardware = (bom) => bom.lines.filter((line) => !projectLine(line));

test('empty modules → empty project BOM', () => {
  const bom = resolveProjectBom([]);
  assert.deepEqual(bom.modules, []);
  assert.deepEqual(bom.unresolved, []);
  assert.deepEqual(hardware(bom), []);
});

test('two same walls aggregate leaf quantities ×2', () => {
  const itemKey = 'wall_100_350';
  assert.ok(getItem(itemKey));
  const single = resolveItemBom(itemKey);
  const bom = resolveProjectBom([
    { id: 'm1', itemKey },
    { id: 'm2', itemKey },
  ]);

  assert.equal(bom.modules.length, 2);
  assert.equal(bom.unresolved.length, 0);
  assert.equal(bom.modules[0].status, 'ok');
  assert.ok(bom.modules[0].lines.length > 0);

  for (const line of single) {
    const total = bom.lines.find((entry) => entry.itemKey === line.itemKey && entry.unit === line.unit);
    assert.ok(total, line.itemKey);
    assert.equal(total.quantity, line.quantity * 2);
  }
});

test('missing itemKey is unresolved', () => {
  const bom = resolveProjectBom([{ id: 'orphan', type: 'flat-panel' }]);
  assert.equal(bom.modules.length, 1);
  assert.equal(bom.modules[0].status, 'unresolved');
  assert.equal(bom.unresolved.length, 1);
  assert.match(bom.unresolved[0].message, /itemKey/);
  assert.deepEqual(hardware(bom), []);
});

test('unknown itemKey is unresolved', () => {
  const bom = resolveProjectBom([{ id: 'x', itemKey: 'does_not_exist_item' }]);
  assert.equal(bom.unresolved.length, 1);
  assert.match(bom.unresolved[0].message, /Unknown Item|çözülemedi/i);
});

test('metre_kare floor unit bills the same area as m2', () => {
  const items = listRegisteredItems().map((item) => (
    item.itemKey === 'hali' ? { ...item, unit: 'metre_kare' } : item
  ));
  initializeItemRegistry(items);
  try {
    const hali = resolveProjectBom([], { xCm: 500, yCm: 400, itemKey: 'hali' });
    assert.deepEqual(
      hardware(hali).map((line) => [line.itemKey, line.quantity, line.unit]),
      [['hali', 20, 'metre_kare']],
    );
    const split = resolveSplitFloorBomLines({
      xCm: 500,
      yCm: 500,
      itemKey: 'hali',
      floorArea: { xCm: 100, yCm: 100, widthCm: 200, depthCm: 300, itemKey: 'karolaj', color: null },
    });
    assert.equal(split[0].itemKey, 'hali');
    assert.equal(split[0].quantity, 19);
    assert.equal(split[0].unit, 'metre_kare');
    assert.equal(split[1].unit, 'adet');
  } finally {
    loadCanonicalItemCatalog();
  }
});

// DB'de koltuk takımının birimi var (adet): listede kendi kalemiyle çözülür (2026-11-20).
test('furniture cluster resolves as its own DB line', () => {
  const itemKey = 'furniture_sofa_set_classic';
  const bom = resolveProjectBom([{ id: 'sofa', itemKey }]);
  assert.equal(bom.modules[0].status, 'ok');
  assert.equal(bom.unresolved.length, 0);
  // Takım listede tek kalem olarak sayılır (DB birimi adet).
  assert.deepEqual(hardware(bom).map((line) => [line.itemKey, line.quantity, line.unit]), [[itemKey, 1, 'adet']]);
});

test('floor unit drives the stand line: m2 area or adet tiles', () => {
  const stand = { xCm: 500, yCm: 400 };
  // Zemin adı ve birimi DB'den (hali, parke: metre_kare; karolaj: adet).
  const hali = resolveProjectBom([], { ...stand, itemKey: 'hali' });
  assert.deepEqual(hardware(hali).map((line) => [line.itemKey, line.quantity, line.unit]), [['hali', 20, getItem('hali').unit]]);

  const sari = resolveProjectBom([], { ...stand, itemKey: 'parke-sari' });
  assert.equal(hardware(sari)[0].name, getItem('parke-sari').name);
  assert.equal(hardware(sari)[0].quantity, 20);
  assert.equal(hardware(sari)[0].unit, getItem('parke-sari').unit);

  const karolaj = resolveProjectBom([], { ...stand, itemKey: 'karolaj' });
  assert.deepEqual(
    hardware(karolaj).map((line) => [line.itemKey, line.quantity, line.unit]),
    [['karolaj', 20, 'adet'], ['profile_karolaj_100', 49, 'adet']],
  );

  const partial = resolveProjectBom([], { xCm: 550, yCm: 400, itemKey: 'karolaj' });
  assert.deepEqual(
    hardware(partial).map((line) => [line.itemKey, line.quantity, line.unit]),
    [
      ['karolaj', 20, 'adet'],
      ['karolaj_yarim', 4, 'adet'],
      ['profile_karolaj_100', 53, 'adet'],
      ['profile_karolaj_50', 5, 'adet'],
    ],
  );
});
