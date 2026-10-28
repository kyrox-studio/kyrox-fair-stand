import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCatalogItem,
} from '../src/catalog.js';

test('Panel Bazalı catalog entries kaldırıldı', () => {
  for (const width of [100, 150, 200]) {
    const moduleKey = `wall_base_${width}`;
    assert.equal(getCatalogItem(moduleKey), null, moduleKey);
    assert.equal(getCatalogItem(moduleKey) != null, false, moduleKey);
  }
});
