import test from 'node:test';
import assert from 'node:assert/strict';

import { applyColorOverride } from '../src/designState.js';
import {
  applyGlassOverride,
  remapCopiedSurfaceGroups,
  bindRendererSurfaceState,
  clearFabricFields,
  cloneSurfaceStateForRenderer,
  syncRendererSurfaceState,
} from '../src/surfaceStateBinding.js';

test('renderer kopyası kalıcı yüzey nesnesinden ayrıdır', () => {
  const persistent = {
    id: 'surface-1',
    color: '#ffffff',
    imageAssetId: null,
    imageTransform: { mode: 'single', offsetX: 0, offsetY: 0, repeatX: 1, repeatY: 1, rotation: 0 },
  };
  const bound = bindRendererSurfaceState(persistent);

  assert.equal(bound.persistentSurfaceState, persistent);
  assert.notEqual(bound.surfaceState, persistent);
  assert.deepEqual(bound.surfaceState, persistent);

  bound.surfaceState.color = '#ff0000';
  assert.equal(persistent.color, '#ffffff');
});

test('kalıcı yazı kopyaya senkronlanır; kopya yazısı kalıcıyı değiştirmez', () => {
  const persistent = {
    id: 'surface-2',
    color: '#ffffff',
    imageAssetId: 'asset-a',
    imageTransform: { mode: 'single', offsetX: 0, offsetY: 0, repeatX: 1, repeatY: 1, rotation: 0 },
  };
  const copy = cloneSurfaceStateForRenderer(persistent);
  applyColorOverride(persistent, '#112233');
  syncRendererSurfaceState(copy, persistent);

  assert.equal(persistent.color, '#112233');
  assert.equal(persistent.imageAssetId, null);
  assert.equal(copy.color, '#112233');
  assert.equal(copy.imageAssetId, null);
  assert.notEqual(copy, persistent);

  copy.color = '#abcdef';
  assert.equal(persistent.color, '#112233');
});

test('cam ve kumaş alanları kalıcı nesnede yazılıp kopyadan silinebilir', () => {
  const persistent = { id: 'surface-3', color: '#ffffff' };
  const copy = cloneSurfaceStateForRenderer(persistent);
  applyGlassOverride(persistent, true);
  persistent.fabricGroupId = 'fabric-1';
  syncRendererSurfaceState(copy, persistent);
  assert.equal(copy.isGlass, true);
  assert.equal(copy.fabricGroupId, 'fabric-1');

  clearFabricFields(persistent);
  applyGlassOverride(persistent, false);
  syncRendererSurfaceState(copy, persistent);
  assert.equal(copy.isGlass, false);
  assert.equal('fabricGroupId' in copy, false);
});

test('grup kopyası görsel ve kaplama özelliklerini korur, sahiplik ve blok kimliklerini ayırır', () => {
  const originals = ['a', 'b'].map((id, index) => ({ id, strips: [{ id: `${id}-front`, color: '#123456',
    imageAssetId: 'logo', imageTransform: { mode: 'size-group', blockId: 'image-original', widthCm: 300,
      heightCm: 100, regionStartX: index / 2, regionWidth: 0.5 },
    fabricGroupId: 'fabric-original', fabricImageAssetId: 'fabric-logo', fabricImageFit: 'size',
    fabricImageWidthCm: 300, fabricImageHeightCm: 100, fabricType: 'mesh', fabricLightingOn: true,
    fabricOwnerSurfaceIds: ['a-front', 'b-front'], fabricOwnerModuleIds: ['a', 'b'],
    metalSeparatorGroupId: 'metal-original' }],
    backStrips: [{ id: `${id}-back`, metalSeparatorGroupId: 'metal-back' }],
  }));
  const before = structuredClone(originals);
  const copies = structuredClone(originals);
  copies.forEach(module => { module.id += '-copy'; module.strips[0].id += '-copy'; module.backStrips[0].id += '-copy'; });
  remapCopiedSurfaceGroups(originals, copies);
  const [a, b] = copies.map(module => module.strips[0]);
  assert.equal(a.imageAssetId, 'logo');
  assert.equal(a.imageTransform.widthCm, 300);
  assert.equal(a.fabricImageWidthCm, 300);
  assert.equal(a.fabricImageHeightCm, 100);
  assert.equal(a.fabricType, 'mesh');
  assert.equal(a.fabricLightingOn, true);
  assert.notEqual(a.imageTransform.blockId, 'image-original');
  assert.equal(a.imageTransform.blockId, b.imageTransform.blockId);
  assert.notEqual(a.fabricGroupId, 'fabric-original');
  assert.equal(a.fabricGroupId, b.fabricGroupId);
  assert.deepEqual(a.fabricOwnerModuleIds, ['a-copy', 'b-copy']);
  assert.deepEqual(a.fabricOwnerSurfaceIds, ['a-front-copy', 'b-front-copy']);
  assert.notEqual(a.metalSeparatorGroupId, 'metal-original');
  assert.equal(a.metalSeparatorGroupId, b.metalSeparatorGroupId);
  assert.equal(copies[0].backStrips[0].metalSeparatorGroupId, copies[1].backStrips[0].metalSeparatorGroupId);
  a.imageTransform.widthCm = 50; a.fabricImageWidthCm = 50; a.color = '#ffffff';
  assert.deepEqual(originals, before);
  assert.equal(b.imageTransform.widthCm, 300);
});

test('aynı dosyayı ayrı tekil yüzeylerde kullanan kopya yeni bağımsız bloklar alır', () => {
  const original = { id: 'module', faces: { front: { id: 'front', imageAssetId: 'same', imageTransform: { mode: 'single' } },
    back: { id: 'back', imageAssetId: 'same', imageTransform: { mode: 'single' } } } };
  const copy = structuredClone(original);
  copy.id = 'module-copy'; copy.faces.front.id = 'front-copy'; copy.faces.back.id = 'back-copy';
  remapCopiedSurfaceGroups([original], [copy]);
  assert.notEqual(copy.faces.front.imageTransform.blockId, copy.faces.back.imageTransform.blockId);
  assert.equal(original.faces.front.imageTransform.blockId, undefined);
});
