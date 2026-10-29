import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCatalogItem,
} from '../src/catalog.js';
import { createBarStoolModuleState } from '../src/designState.js';

test('Bar Taburesi katalog ve state kimliği sabittir', () => {
  const item = getCatalogItem('furniture_bar_stool_classic');
  assert.ok(item);
  assert.equal(item.label, 'Bar Taburesi');
  assert.equal(item.previewId, 1);
  assert.equal(Object.hasOwn(item, 'type'), false);
  assert.ok(getCatalogItem('furniture_bar_stool_classic') != null);

  const state = createBarStoolModuleState();
  assert.equal(state.type, 'bar-stool');
  assert.equal(state.widthCm, 60);
  assert.equal(state.depthCm, 55);
  assert.equal(state.heightCm, 121);
});
