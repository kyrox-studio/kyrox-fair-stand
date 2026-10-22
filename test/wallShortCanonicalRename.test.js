import test from 'node:test';
import assert from 'node:assert/strict';

import { getCatalogItem } from '../src/catalog.js';
import { createModuleStateFromDescriptor, normalizeModuleItemState } from '../src/designState.js';
import { resolveItemBom } from '../src/itemBom.js';
import {
  getItem,
  isWallShortFamilyDescriptor,
  listRegisteredItems,
  resolveItemDefaultZCm,
  resolveSceneDimensions,
} from '../src/items.js';
import { getModuleMagneticSnapStrategy, requiresShortUpJointSnap } from '../src/moduleBehavior.js';

const CANONICAL = Object.freeze([
  ['wall_200_short_1', 'wall-short-1', 300, 50, 'Panel Tek Sıra 200'],
  ['wall_150_short_1', 'wall-short-1', 300, 50, 'Panel Tek Sıra 150'],
  ['wall_100_short_1', 'wall-short-1', 300, 50, 'Panel Tek Sıra 100'],
  ['wall_50_short_1', 'wall-short-1', 300, 50, 'Panel Tek Sıra 50'],
  ['wall_200_short_2', 'wall-short-2', 250, 100, 'Panel Çift Sıra 200'],
  ['wall_150_short_2', 'wall-short-2', 250, 100, 'Panel Çift Sıra 150'],
  ['wall_100_short_2', 'wall-short-2', 250, 100, 'Panel Çift Sıra 100'],
  ['wall_50_short_2', 'wall-short-2', 250, 100, 'Panel Çift Sıra 50'],
]);

// Katalogda varyant başına tek kart (migration 0079); diğer genişlikler genişlik penceresinden gelir.
const CATALOG_CARDS = new Set(['wall_100_short_1', 'wall_100_short_2']);

const LEGACY_KEYS = Object.freeze({
  wall_200_short_up_1: 'wall_200_short_1',
  wall_150_short_up_1: 'wall_150_short_1',
  wall_100_short_up_1: 'wall_100_short_1',
  wall_50_short_up_1: 'wall_50_short_1',
  wall_200_short_up_2: 'wall_200_short_2',
  wall_150_short_up_2: 'wall_150_short_2',
  wall_100_short_up_2: 'wall_100_short_2',
  wall_50_short_up_2: 'wall_50_short_2',
});

const RECIPE = Object.freeze({
  wall_200_short_1: [['profile_190', 2], ['upright_49_5', 2], ['panel_197', 1], ['connector_start', 2], ['connector_single', 3]],
  wall_150_short_1: [['profile_140_5', 2], ['upright_49_5', 2], ['panel_147_5', 1], ['connector_start', 2], ['connector_single', 3]],
  wall_100_short_1: [['profile_91', 2], ['upright_49_5', 2], ['panel_98', 1], ['connector_start', 2], ['connector_single', 3]],
  wall_50_short_1: [['profile_41_5', 2], ['upright_49_5', 2], ['panel_48_5', 1], ['connector_start', 2], ['connector_single', 3]],
  wall_200_short_2: [['profile_190', 2], ['upright_99', 2], ['panel_197', 2], ['connector_start', 2], ['connector_single', 3]],
  wall_150_short_2: [['profile_140_5', 2], ['upright_99', 2], ['panel_147_5', 2], ['connector_start', 2], ['connector_single', 3]],
  wall_100_short_2: [['profile_91', 2], ['upright_99', 2], ['panel_98', 2], ['connector_start', 2], ['connector_single', 3]],
  wall_50_short_2: [['profile_41_5', 2], ['upright_99', 2], ['panel_48_5', 2], ['connector_start', 2], ['connector_single', 3]],
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function quantities(itemKey) {
  return Object.fromEntries(
    resolveItemBom(itemKey).map((line) => [line.itemKey, line.quantity]),
  );
}

test('catalog resolves 8 wall-short item keys and does not register legacy keys', () => {
  const registered = new Set(listRegisteredItems().map((item) => item.itemKey));
  for (const [itemKey, variant, defaultZCm, heightCm, name] of CANONICAL) {
    const item = getItem(itemKey);
    assert.equal(item?.itemKey, itemKey);
    assert.equal(item.variant, variant);
    assert.equal(item.name, name);
    assert.equal(item.type, 'flat-panel');
    assert.equal(resolveItemDefaultZCm(itemKey), defaultZCm);
    const scene = resolveSceneDimensions(item);
    assert.equal(scene.heightCm, heightCm);
    assert.equal(scene.depthCm, 10);
    assert.equal(getCatalogItem(itemKey)?.itemKey ?? null, CATALOG_CARDS.has(itemKey) ? itemKey : null);
    assert.equal(isWallShortFamilyDescriptor(item), true);
  }
  for (const legacyKey of Object.keys(LEGACY_KEYS)) {
    assert.equal(registered.has(legacyKey), false);
    assert.equal(getItem(legacyKey), null);
  }
});

test('wall-short-1 and wall-short-2 are the family variants', () => {
  assert.equal(isWallShortFamilyDescriptor({ variant: 'wall-short-1' }), true);
  assert.equal(isWallShortFamilyDescriptor({ variant: 'wall-short-2' }), true);
  assert.equal(isWallShortFamilyDescriptor({ itemKey: 'wall_50_short_1' }), true);
  assert.equal(isWallShortFamilyDescriptor({ itemKey: 'wall_200_350', type: 'flat-panel' }), false);
});

test('legacy project load maps item key and variant before catalog identity sticks', () => {
  const loaded = normalizeModuleItemState({
    type: 'flat-panel',
    itemKey: 'wall_200_short_up_1',
    variant: 'short-up-1',
    placement: { xCm: 10, yCm: 20, zCm: 300, rotationZDeg: 90, wallId: 'back' },
  });
  assert.equal(loaded.itemKey, 'wall_200_short_1');
  assert.equal(loaded.variant, 'wall-short-1');
  assert.equal(getItem(loaded.itemKey)?.variant, 'wall-short-1');
  assert.equal(loaded.placement.zCm, 300);
  assert.equal(loaded.placement.rotationZDeg, 90);
  assert.equal(isWallShortFamilyDescriptor(loaded), true);
});

test('legacy variant on an already canonical key is rewritten', () => {
  const loaded = normalizeModuleItemState({
    type: 'flat-panel',
    itemKey: 'wall_150_short_2',
    variant: 'short-up-2',
  });
  assert.equal(loaded.itemKey, 'wall_150_short_2');
  assert.equal(loaded.variant, 'wall-short-2');
});

test('canonical load is idempotent', () => {
  const canonical = {
    type: 'flat-panel',
    itemKey: 'wall_100_short_1',
    variant: 'wall-short-1',
    placement: { xCm: 0, yCm: 0, zCm: 300, rotationZDeg: 0, wallId: 'back' },
  };
  const once = normalizeModuleItemState(clone(canonical));
  const twice = normalizeModuleItemState(clone(once));
  assert.equal(once.itemKey, 'wall_100_short_1');
  assert.equal(twice.itemKey, 'wall_100_short_1');
  assert.equal(twice.variant, 'wall-short-1');
  assert.equal(twice.placement.zCm, 300);
  assert.equal(twice.placement.rotationZDeg, 0);
});

test('save roundtrip persists the canonical key', () => {
  const loaded = normalizeModuleItemState({
    type: 'flat-panel',
    itemKey: 'wall_50_short_up_2',
    variant: 'short-up-2',
    placement: { xCm: 0, yCm: 0, zCm: 250, rotationZDeg: 180, wallId: 'left' },
  });
  const saved = clone(loaded);
  assert.equal(saved.itemKey, 'wall_50_short_2');
  assert.equal(JSON.stringify(saved).includes('short_up'), false);
  assert.equal(JSON.stringify(saved).includes('short-up'), false);
  const reloaded = normalizeModuleItemState(clone(saved));
  assert.equal(reloaded.itemKey, 'wall_50_short_2');
  assert.equal(reloaded.variant, 'wall-short-2');
  assert.equal(reloaded.placement.zCm, 250);
  assert.equal(reloaded.placement.rotationZDeg, 180);
});

test('8 wall-short recipes keep the previous leaf quantities', () => {
  for (const [itemKey, rows] of Object.entries(RECIPE)) {
    const composition = Object.fromEntries(
      getItem(itemKey).composition.items.map((row) => [row.itemKey, row.quantity]),
    );
    const bom = quantities(itemKey);
    for (const [childKey, quantity] of rows) {
      assert.equal(composition[childKey], quantity, `${itemKey} composition ${childKey}`);
      assert.equal(bom[childKey], quantity, `${itemKey} bom ${childKey}`);
    }
    assert.equal(Object.keys(composition).length, rows.length);
  }
});

test('upright short-up-joint snap token is unchanged', () => {
  const upright = createModuleStateFromDescriptor(getCatalogItem('upright_346_5'));
  assert.equal(requiresShortUpJointSnap(upright), true);
  assert.equal(getModuleMagneticSnapStrategy(upright), 'short-up-joint');
});
