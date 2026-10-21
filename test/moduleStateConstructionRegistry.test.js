import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCatalogItem,
  listCatalogItems,
} from '../src/catalog.js';
import { createModuleStateFromDescriptor } from '../src/designState.js';
import { getItem } from '../src/items.js';

test('canonical state construction registry instantiates every catalog entry', () => {
  assert.equal(listCatalogItems().map((item) => item.itemKey).length, 63);

  for (const itemKey of listCatalogItems().map((item) => item.itemKey)) {
    const descriptor = getCatalogItem(itemKey);
    const state = createModuleStateFromDescriptor(descriptor);
    assert.ok(state, `${itemKey} must resolve to a runtime module state`);
    assert.equal(state.type, getItem(itemKey).type, `${itemKey} type must come from Item`);
    assert.equal(state.itemKey, getItem(itemKey).widthVariants?.[0] ?? itemKey, `${itemKey} kanonik ürün kimliğine çözülmeli`);
    assert.equal(Object.hasOwn(state, 'catalogKey'), false, `${itemKey} must not write a second product identity`);
  }
});

test('canonical state construction preserves placement only when explicitly requested', () => {
  const descriptor = {
    ...getCatalogItem('wall_100_350'),
    placement: { xCm: 100, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' },
  };

  const fresh = createModuleStateFromDescriptor(descriptor, { itemKey: 'wall_100_350' });
  assert.equal(fresh.placement, undefined);

  const restored = createModuleStateFromDescriptor(descriptor, {
    itemKey: 'wall_100_350',
    preservePlacement: true,
  });
  assert.deepEqual(restored.placement, descriptor.placement);
  assert.notEqual(restored.placement, descriptor.placement);
});

test('canonical registry includes the active non-catalog illuminated-foam family', () => {
  const state = createModuleStateFromDescriptor(
    { type: 'illuminated-foam', widthCm: 180, heightCm: 45, haloColor: '#abcdef' },
    { imageAssetId: 'asset-1' },
  );

  assert.ok(state);
  assert.equal(state.type, 'illuminated-foam');
  assert.equal(state.itemKey, 'illuminated-foam');
  assert.equal(state.imageAssetId, 'asset-1');
  assert.equal(state.widthCm, 180);
  assert.equal(state.heightCm, 45);
  assert.equal(Object.hasOwn(state, 'catalogKey'), false);
});

test('automatic catalog-equivalent descriptors receive canonical catalog identity', () => {
  const wall = createModuleStateFromDescriptor({ type: 'flat-panel', widthCm: 100 });
  const door = createModuleStateFromDescriptor({ type: 'door', widthCm: 100 });
  const normalSeparator = createModuleStateFromDescriptor({ type: 'separator', widthCm: 100 });
  const vineSeparator = createModuleStateFromDescriptor({
    itemKey: 'wall_separator_100_350_sarmasik',
    type: 'separator',
  });
  const guessedVine = createModuleStateFromDescriptor({
    type: 'separator',
    widthCm: 100,
    modelFile: 'wall_separator_100_sarmasik.glb',
  });

  assert.equal(wall.itemKey, 'wall_100_350');
  assert.equal(door.itemKey, 'wall_door_100_350');
  assert.equal(normalSeparator.itemKey, 'wall_separator_100_350');
  assert.equal(vineSeparator.itemKey, 'wall_separator_100_350_sarmasik');
  assert.equal(guessedVine, null);
});

test('main.js delegates construction instead of owning a parallel type dispatcher', async () => {
  const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(source, /createModuleStateFromDescriptor/);
  assert.doesNotMatch(source, /createFlatPanelModuleState/);
  assert.doesNotMatch(source, /createMiniFridgeModuleState/);
  assert.doesNotMatch(source, /createIlluminatedFoamModuleState/);
  assert.doesNotMatch(source, /if \(module\.type === 'flat-panel'\)/);
});
