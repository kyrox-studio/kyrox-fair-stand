import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getCatalogItem,
  listCatalogItems,
} from '../src/catalog.js';
import {
  getModuleBehavior,
  hasExplicitModuleBehavior,
} from '../src/moduleBehavior.js';
import { getItem } from '../src/items.js';

test('every catalog module type has an explicit behavior contract', () => {
  const catalogTypes = [...new Set(
    listCatalogItems().map((item) => item.itemKey).map((moduleKey) => getItem(moduleKey)?.type),
  )].filter(Boolean);

  const missingTypes = catalogTypes.filter((type) => !hasExplicitModuleBehavior(type));

  assert.deepEqual(
    missingTypes,
    [],
    `Catalog module types missing explicit behavior: ${missingTypes.join(', ')}`,
  );
});

test('unknown module types remain distinguishable from declared catalog behavior', () => {
  assert.equal(hasExplicitModuleBehavior('__unknown-module-type__'), false);
  assert.deepEqual(getModuleBehavior('__unknown-module-type__'), {
    placement: 'wall',
    moveSnapCm: 10,
    allowSideInsert: true,
    collision: 'segment',
    magneticSnap: 'standard',
    connectionEndpoint: 'segment',
    collisionDepth: 'physical',
    endpointContact: 'standard',
    boundarySnap: 'stand-edge',
    overlapWithTypes: [],
    supportsWallOverlayMount: true,
    wallCapacity: 'include',
    collisionHeight: 'full',
    ghost: {
      kind: 'silhouette',
      renderer: 'module-silhouette',
      opacity: 0.38,
    },
  });
});

test('every declared catalog behavior exposes the complete placement policy schema', () => {
  const requiredKeys = [
    'placement',
    'moveSnapCm',
    'allowSideInsert',
    'collision',
    'magneticSnap',
    'connectionEndpoint',
    'collisionDepth',
    'endpointContact',
    'boundarySnap',
    'overlapWithTypes',
    'supportsWallOverlayMount',
    'wallCapacity',
    'collisionHeight',
    'ghost',
  ];

  for (const moduleKey of listCatalogItems().map((item) => item.itemKey)) {
    const item = getItem(moduleKey);
    const behavior = getModuleBehavior({ itemKey: moduleKey, type: item.type });
    for (const key of requiredKeys) {
      assert.equal(Object.hasOwn(behavior, key), true, `${moduleKey}: missing ${key}`);
    }
  }
});
