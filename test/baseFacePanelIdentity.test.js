import test from 'node:test';
import assert from 'node:assert/strict';

import './registerCanonicalItemCatalog.mjs';
import { createModuleStateFromCatalogKey, normalizeModuleItemState } from '../src/designState.js';

// Kullanıcı projesi 452d4cc1 (2026-11-13): dört bazanın üç yüzüne aynı görsel uygulanınca dijital
// baskı listesi 8 × 200×49,5 + 4 × 50×49,5 yazıyordu; doğrusu 4 × 200 + 8 × 50. Bazanın ön yüzü geniş
// panel, iki yanı dar paneldir; reçete sırasıyla damgalanınca sol yan 200'lük panel alıyordu.

test('yeni baza: ön yüz geniş panel, sol ve sağ yan dar panel', () => {
  const base = createModuleStateFromCatalogKey('base_200');
  assert.equal(base.faces.front.itemKey, 'panel_197');
  assert.equal(base.faces.left.itemKey, 'panel_48_5');
  assert.equal(base.faces.right.itemKey, 'panel_48_5');
});

test('eski kayıtta sol yanı 200 olan baza açılışta düzelir; görsel ve renk durur', () => {
  const base = createModuleStateFromCatalogKey('base_200');
  base.faces.left = { ...base.faces.left, itemKey: 'panel_197', widthCm: 200, imageAssetId: 'sari', color: '#ffcc00' };
  const repaired = normalizeModuleItemState(base);
  assert.equal(repaired.faces.left.itemKey, 'panel_48_5');
  assert.equal(repaired.faces.left.imageAssetId, 'sari');
  assert.equal(repaired.faces.left.color, '#ffcc00');
  assert.equal(repaired.faces.front.itemKey, 'panel_197');
});
