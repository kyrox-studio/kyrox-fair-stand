import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCatalogItem,
} from '../src/catalog.js';
import {
  createFlatPanelModuleState,
  createModuleStateFromDescriptor,
  duplicateModuleState,
  normalizeModuleItemState,
} from '../src/designState.js';
import { getItem, resolveItemKey } from '../src/items.js';
import { getModuleBehavior, getModuleCollisionHeightRangeCm, getModuleRotationStepDeg } from '../src/moduleBehavior.js';
import { placementsOverlap } from '../src/modulePlacement.js';
import { resolveModuleContract } from '../src/moduleContracts.js';
import {
  getModuleRecipe,
} from './recipeParentItemKey.js';

const CATALOG_CARDS = { wall_100_350: 'Panel' };

const WALL_KEYS = ['wall_50_350', 'wall_100_350', 'wall_150_350', 'wall_200_350'];

const EXPECTED = {
  wall_50_350: {
    name: 'Panel 50',
    widthCm: 50,
    recipeQuantities: {
      profile_41_5: 2, upright_346_5: 2, panel_48_5: 7, connector_start: 2, connector_single: 13,
    },
  },
  wall_100_350: {
    name: 'Panel 100',
    widthCm: 100,
    recipeQuantities: {
      profile_91: 2, upright_346_5: 2, panel_98: 7, connector_start: 2, connector_single: 13,
    },
  },
  wall_150_350: {
    name: 'Panel 150',
    widthCm: 150,
    recipeQuantities: {
      profile_140_5: 2, upright_346_5: 2, panel_147_5: 7, connector_start: 2, connector_single: 13,
    },
  },
  wall_200_350: {
    name: 'Panel 200',
    widthCm: 200,
    recipeQuantities: {
      profile_190: 2, upright_346_5: 2, panel_197: 7, connector_start: 2, connector_single: 13,
    },
  },
};

for (const itemKey of WALL_KEYS) {
  test(`${itemKey}: canonical composite identity, state and recipe parity`, () => {
    const item = getItem(itemKey);
    const expected = EXPECTED[itemKey];
    const catalog = getCatalogItem(itemKey);

    assert.equal(item.itemKey, itemKey);
    assert.equal(item.name, expected.name);
    assert.equal(item.type, 'flat-panel');
    assert.equal(item.composition?.mode, 'recipe');
    assert.equal(item.composition?.moduleType, undefined);
    assert.equal(item.dimensions.widthCm, expected.widthCm);
    assert.equal(Object.hasOwn(item, 'unit'), false);
    assert.deepEqual(item.dimensions, { widthCm: expected.widthCm });

    // Genişlik ailesi (migration 0082): katalogda aile başına tek kart, başlık ölçüsüz;
    // diğer genişlikler gizlidir ve genişlik penceresinden Item'ın kendisiyle kurulur.
    if (CATALOG_CARDS[itemKey]) {
      assert.equal(catalog.itemKey, itemKey);
      assert.equal(catalog.label, CATALOG_CARDS[itemKey]);
      assert.equal(catalog.previewId, item.previewId);
      assert.equal(Object.hasOwn(catalog, 'type'), false);
      assert.equal(Object.hasOwn(catalog, 'widthCm'), false);
    } else {
      assert.equal(catalog, null);
    }

    const state = createModuleStateFromDescriptor(catalog ?? { itemKey, type: item.type });
    assert.equal(state.itemKey, itemKey);
    assert.equal(state.itemKey, itemKey);
    assert.equal(state.type, 'flat-panel');
    assert.equal(state.widthCm, expected.widthCm);
    assert.equal(state.strips.length, 7);

    const byWidth = createFlatPanelModuleState(expected.widthCm);
    assert.equal(byWidth.itemKey, itemKey);
    assert.equal(byWidth.itemKey, itemKey);

    assert.equal(getModuleBehavior(state).placement, 'wall');
    assert.equal(getModuleBehavior(state).moveSnapCm, 10);
    assert.equal(getModuleRotationStepDeg(state), 15);

    const contract = resolveModuleContract(itemKey);
    assert.equal(contract.bom.mode, 'recipe');
    assert.equal(contract.bom.source, 'src/moduleRecipes.js');

    const recipe = getModuleRecipe('flat-panel', expected.widthCm);
    const quantities = Object.fromEntries(
      recipe.items.map((entry) => [entry.itemKey ?? entry.partId, entry.quantity]),
    );
    assert.deepEqual(quantities, expected.recipeQuantities);

    assert.equal(resolveItemKey(state), itemKey);
    const missingKey = JSON.parse(JSON.stringify(state));
    delete missingKey.itemKey;
    assert.equal(resolveItemKey(missingKey), null);
    assert.equal(normalizeModuleItemState(missingKey).itemKey, undefined);

    const duplicate = duplicateModuleState(state);
    assert.notEqual(duplicate.id, state.id);
    assert.equal(duplicate.itemKey, itemKey);
    assert.notEqual(duplicate.strips[0].id, state.strips[0].id);
  });
}

const WALL_SHORT_2 = {
  wall_50_short_2: {
    widthCm: 50,
    parentKey: 'wall_50_350',
    recipeQuantities: {
      profile_41_5: 2, upright_99: 2, panel_48_5: 2, connector_start: 2, connector_single: 3,
    },
  },
  wall_100_short_2: {
    widthCm: 100,
    parentKey: 'wall_100_350',
    recipeQuantities: {
      profile_91: 2, upright_99: 2, panel_98: 2, connector_start: 2, connector_single: 3,
    },
  },
  wall_150_short_2: {
    widthCm: 150,
    parentKey: 'wall_150_350',
    recipeQuantities: {
      profile_140_5: 2, upright_99: 2, panel_147_5: 2, connector_start: 2, connector_single: 3,
    },
  },
  wall_200_short_2: {
    widthCm: 200,
    parentKey: 'wall_200_350',
    recipeQuantities: {
      profile_190: 2, upright_99: 2, panel_197: 2, connector_start: 2, connector_single: 3,
    },
  },
};

// Kısa panelde katalog kartı varyant başına tek (migration 0079); diğer genişlikler katalogda
// gizlidir ve Item'dan kurulur (genişlik penceresinin yolu). Kart da kendi ölçülü adını taşır.
const WALL_SHORT_CARDS = Object.freeze({
  // Kart genişlik sorar; başlık ölçüsüzdür (sahnedeki parça Item adını taşır).
  wall_100_short_1: 'Panel Tek Sıra',
  wall_100_short_2: 'Panel Çift Sıra',
});

function wallShortDescriptor(itemKey) {
  const catalog = getCatalogItem(itemKey);
  if (Object.hasOwn(WALL_SHORT_CARDS, itemKey)) {
    assert.equal(catalog?.itemKey, itemKey);
    assert.equal(catalog.label, WALL_SHORT_CARDS[itemKey]);
    return catalog;
  }
  assert.equal(catalog, null, `${itemKey} katalogda gizli olmalı`);
  return { itemKey, type: 'flat-panel' };
}

for (const [itemKey, expected] of Object.entries(WALL_SHORT_2)) {
  test(`${itemKey} is a hanging two-panel Item that does not replace ${expected.parentKey}`, () => {
    const item = getItem(itemKey);
    const parent = getItem(expected.parentKey);
    const catalog = wallShortDescriptor(itemKey);

    assert.equal(item.itemKey, itemKey);
    assert.equal(item.name, `Panel Çift Sıra ${expected.widthCm}`);
    assert.equal(item.type, 'flat-panel');
    assert.equal(item.variant, 'wall-short-2');
    assert.deepEqual(item.stripOccupancy, { align: 'top', stripCount: 2 });
    assert.equal(item.composition.moduleType, undefined);
    assert.deepEqual(item.dimensions, { widthCm: expected.widthCm });
    assert.equal(parent.composition.moduleType, undefined);
    assert.equal(parent.stripOccupancy, undefined);
    assert.equal(item.variant, 'wall-short-2');
    assert.deepEqual(item.stripOccupancy, { align: 'top', stripCount: 2 });
    assert.equal(resolveItemKey({ type: 'flat-panel', widthCm: expected.widthCm }), null);
    assert.equal(resolveItemKey({ itemKey: expected.parentKey }), expected.parentKey);
    assert.equal(resolveItemKey(catalog), itemKey);

    const state = createModuleStateFromDescriptor(catalog);
    assert.equal(state.itemKey, itemKey);
    assert.equal(state.strips.length, 2);

    const recipe = getModuleRecipe('wall-short-2', expected.widthCm);
    const quantities = Object.fromEntries(
      recipe.items.map((entry) => [entry.itemKey ?? entry.partId, entry.quantity]),
    );
    assert.deepEqual(quantities, expected.recipeQuantities);
  });
}

const WALL_SHORT_1 = {
  wall_50_short_1: {
    widthCm: 50,
    parentKey: 'wall_50_350',
    recipeQuantities: {
      profile_41_5: 2, upright_49_5: 2, panel_48_5: 1, connector_start: 2, connector_single: 3,
    },
  },
  wall_100_short_1: {
    widthCm: 100,
    parentKey: 'wall_100_350',
    recipeQuantities: {
      profile_91: 2, upright_49_5: 2, panel_98: 1, connector_start: 2, connector_single: 3,
    },
  },
  wall_150_short_1: {
    widthCm: 150,
    parentKey: 'wall_150_350',
    recipeQuantities: {
      profile_140_5: 2, upright_49_5: 2, panel_147_5: 1, connector_start: 2, connector_single: 3,
    },
  },
  wall_200_short_1: {
    widthCm: 200,
    parentKey: 'wall_200_350',
    recipeQuantities: {
      profile_190: 2, upright_49_5: 2, panel_197: 1, connector_start: 2, connector_single: 3,
    },
  },
};

for (const [itemKey, expected] of Object.entries(WALL_SHORT_1)) {
  test(`${itemKey} is a hanging one-panel Item that does not replace ${expected.parentKey}`, () => {
    const item = getItem(itemKey);
    const parent = getItem(expected.parentKey);
    const catalog = wallShortDescriptor(itemKey);

    assert.equal(item.itemKey, itemKey);
    assert.equal(item.name, `Panel Tek Sıra ${expected.widthCm}`);
    assert.equal(item.type, 'flat-panel');
    assert.equal(item.variant, 'wall-short-1');
    assert.deepEqual(item.stripOccupancy, { align: 'top', stripCount: 1 });
    assert.equal(item.composition.moduleType, undefined);
    assert.deepEqual(item.dimensions, { widthCm: expected.widthCm });
    assert.equal(parent.composition.moduleType, undefined);
    assert.equal(parent.stripOccupancy, undefined);
    assert.equal(item.variant, 'wall-short-1');
    assert.deepEqual(item.stripOccupancy, { align: 'top', stripCount: 1 });
    assert.equal(resolveItemKey({ type: 'flat-panel', widthCm: expected.widthCm }), null);
    assert.equal(resolveItemKey({ itemKey: expected.parentKey }), expected.parentKey);
    assert.equal(resolveItemKey(catalog), itemKey);

    const state = createModuleStateFromDescriptor(catalog);
    assert.equal(state.itemKey, itemKey);
    assert.equal(state.strips.length, 1);

    const recipe = getModuleRecipe('wall-short-1', expected.widthCm);
    const quantities = Object.fromEntries(
      recipe.items.map((entry) => [entry.itemKey ?? entry.partId, entry.quantity]),
    );
    assert.deepEqual(quantities, expected.recipeQuantities);
  });
}

test('wall_200_short_2 skips floor collisions but keeps wall snap policy', () => {
  const hanging = {
    id: 'shot',
    itemKey: 'wall_200_short_2',
    type: 'flat-panel',
    widthCm: 200,
    placement: { xCm: 0, yCm: 0, zCm: 250, rotationZDeg: 0, wallId: 'back' },
  };
  const counter = {
    id: 'counter',
    itemKey: 'desk_banko_200',
    type: 'counter',
    widthCm: 200,
    depthCm: 50,
    heightCm: 100,
    placement: { xCm: 0, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'free' },
  };
  const wall = {
    id: 'wall',
    itemKey: 'wall_200_350',
    type: 'flat-panel',
    widthCm: 200,
    placement: { xCm: 0, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' },
  };
  const neighbor = {
    ...hanging,
    id: 'shot-neighbor',
    placement: { xCm: 200, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' },
  };

  const behavior = getModuleBehavior(hanging);
  assert.equal(behavior.magneticSnap, 'standard');
  assert.equal(behavior.moveSnapCm, 10);
  assert.equal(behavior.collision, 'segment');
  assert.equal(behavior.collisionHeight, 'full');
  assert.deepEqual(getModuleCollisionHeightRangeCm(hanging), { minCm: 250, maxCm: 350 });

  assert.equal(placementsOverlap(hanging, counter), false);
  assert.equal(placementsOverlap(hanging, wall), true);
  assert.equal(placementsOverlap(wall, neighbor), false);
});

