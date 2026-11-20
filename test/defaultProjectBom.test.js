import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveItemBom } from '../src/itemBom.js';
import { getItem, initializeItemRegistry, listRegisteredItems } from '../src/items.js';
import { resolveProjectBom } from '../src/projectBom.js';
import { loadCanonicalItemCatalog } from './registerCanonicalItemCatalog.mjs';

// Elektrik panosu DB'de (test kataloğu `scripts/export-test-catalog.py` ile DB'den) her projeye bir adet eklenen
// üretim kalemidir; kalem katalogdan kalkarsa liste boş kalır.
test('every project bill includes one elektrik panosu', () => {
  assert.equal(getItem('elektrik_panosu')?.type, 'production');
  {
    const empty = resolveProjectBom([]);
    assert.deepEqual(empty.modules, []);
    assert.deepEqual(
      empty.lines.map((line) => [line.itemKey, line.name, line.quantity, line.unit]),
      [['elektrik_panosu', 'Elektrik Panosu', 1, 'adet']],
    );

    const itemKey = 'wall_100_350';
    const single = resolveItemBom(itemKey);
    const bom = resolveProjectBom([
      { id: 'm1', itemKey },
      { id: 'm2', itemKey },
    ]);
    const panel = bom.lines.find((line) => line.itemKey === 'elektrik_panosu');
    assert.equal(panel.quantity, 1);
    assert.equal(panel.unit, 'adet');
    assert.equal(bom.modules.some((entry) => entry.lines.some((line) => line.itemKey === 'elektrik_panosu')), false);
    for (const line of single) {
      const total = bom.lines.find((entry) => entry.itemKey === line.itemKey && entry.unit === line.unit);
      assert.equal(total.quantity, line.quantity * 2);
    }
  }
  const snapshot = listRegisteredItems().map((item) => structuredClone(item));
  initializeItemRegistry(snapshot.filter((item) => item.itemKey !== 'elektrik_panosu'));
  try {
    assert.deepEqual(resolveProjectBom([]).lines, []);
  } finally {
    loadCanonicalItemCatalog();
  }
});
