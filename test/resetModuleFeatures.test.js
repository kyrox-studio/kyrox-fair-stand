import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addFlatPanelBackStrips,
  clearModuleFeatures,
  createModuleStateFromCatalogKey,
  removePanelStrips,
  supportsFlatPanelBackStrips,
  supportsPanelRemoval,
} from '../src/designState.js';
import { listRegisteredItems } from '../src/items.js';

// Tüm Özellikleri Kaldır (kullanıcı kararı 2026-11-20): yalnız atamalar kalkar; arka yüz ve kaldırılmış panel kalır.
// Katalogdaki her modül sınanır: yeni eklenen modül de bu testten geçer.
function surfacesOf(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) { node.forEach((child) => surfacesOf(child, out)); return out; }
  if ((typeof node.id === 'string' && node.id.startsWith('surface')) || Object.hasOwn(node, 'imageAssetId')) out.push(node);
  for (const [key, child] of Object.entries(node)) if (key !== 'placement' && key !== 'imageTransform') surfacesOf(child, out);
  return out;
}

function decorate(module) {
  for (const surface of surfacesOf(module)) {
    surface.imageAssetId = 'asset-1';
    surface.imageTransform = { mode: 'cover', scale: 2 };
    surface.isGlass = true;
    surface.isMetalSeparator = true;
    surface.metalSeparatorGroupId = 'metal-1';
    surface.fabricGroupId = 'fabric-1';
    surface.fabricType = 'lightbox';
    surface.fabricOwnerSurfaceIds = [surface.id];
    surface.panelFinish = 'panel_finish_mese';
    if (Object.hasOwn(surface, 'color')) surface.color = '#c0392b';
  }
}

test('her katalog modülünde atamalar kalkar; arka yüz, kaldırılmış panel ve kimlikler kalır', () => {
  let checked = 0;
  let withBack = 0;
  let withRemoved = 0;
  for (const item of listRegisteredItems()) {
    let module;
    try { module = createModuleStateFromCatalogKey(item.itemKey); } catch { continue; }
    if (!module) continue;
    const fresh = structuredClone(module);
    if (supportsFlatPanelBackStrips(module)) addFlatPanelBackStrips(module);
    if (supportsPanelRemoval(module)) removePanelStrips(module, [{ side: 'front', stripIndex: module.strips?.[0]?.stripIndex ?? 0 }]);
    const before = structuredClone(module);
    decorate(module);
    const cleared = clearModuleFeatures(module, fresh);
    const surfaces = surfacesOf(cleared);
    if (!surfaces.length) continue;
    checked += 1;
    if (cleared.backStrips?.length) withBack += 1;
    if (surfaces.some((surface) => surface.removed === true)) withRemoved += 1;
    for (const surface of surfaces) {
      for (const key of ['isGlass', 'isMetalSeparator', 'metalSeparatorGroupId', 'fabricGroupId', 'fabricType', 'fabricOwnerSurfaceIds', 'panelFinish']) {
        assert.equal(Object.hasOwn(surface, key), false, `${item.itemKey} ${key}`);
      }
      if (Object.hasOwn(surface, 'imageAssetId')) assert.equal(surface.imageAssetId, null, item.itemKey);
      if (Object.hasOwn(surface, 'color')) assert.notEqual(surface.color, '#c0392b', `${item.itemKey} renk`);
    }
    // Yapı: yüzey kimlikleri, arka yüz ve kaldırılmış paneller aynı.
    assert.deepEqual(surfaces.map((surface) => surface.id), surfacesOf(before).map((surface) => surface.id), item.itemKey);
    assert.equal(cleared.backStrips?.length, before.backStrips?.length, item.itemKey);
    assert.deepEqual(surfaces.map((surface) => surface.removed === true), surfacesOf(before).map((surface) => surface.removed === true), item.itemKey);
    // Renk katalog rengine döner.
    const beforeColors = surfacesOf(before).map((surface) => surface.color);
    assert.deepEqual(surfaces.map((surface) => surface.color), beforeColors, `${item.itemKey} katalog rengi`);
  }
  assert.ok(checked >= 30, `${checked} modül`);
  assert.ok(withBack >= 5, `${withBack} arka yüzlü modül`);
  assert.ok(withRemoved >= 3, `${withRemoved} kaldırılmış panelli modül`);
});
