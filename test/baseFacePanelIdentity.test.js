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

// #385 (2026-11-16) liste tarafında yüzlere reçete sırasıyla kimlik yazınca hata geri geldi: bazada sol
// yan, L bankoda sol / sağ yüzler yanlış panel sayıldı. Liste ve panel dökümü de yüz rolünü kullanır.
const BOX_ITEMS = [
  'base_100', 'base_150', 'base_200',
  'desk_banko_100', 'desk_banko_150', 'desk_banko_200',
  'desk_banko_100_l', 'desk_banko_150_l', 'desk_banko_200_l',
];

test('liste / panel dökümü: baza ve banko yüzleri kendi rolündeki paneli sayar', async () => {
  const { collectPanelSurfaces } = await import('../src/panelGlassBom.js');
  for (const itemKey of BOX_ITEMS) {
    const module = createModuleStateFromCatalogKey(itemKey);
    const counted = collectPanelSurfaces(module).map((surface) => surface.itemKey);
    assert.deepEqual(counted, Object.values(module.faces).map((face) => face.itemKey), itemKey);
    const narrow = Object.entries(module.faces)
      .filter(([faceKey]) => faceKey.startsWith('left') || faceKey.startsWith('return'))
      .map(([, face]) => face.itemKey);
    assert.ok(narrow.every((key) => key === 'panel_48_5'), itemKey);
  }
});

test('liste: genişliği değişmiş bankoda eskimiş yüz kimliği rolüne göre onarılır', async () => {
  const { collectPanelSurfaces } = await import('../src/panelGlassBom.js');
  const counter = createModuleStateFromCatalogKey('desk_banko_200');
  counter.faces.frontLower = { ...counter.faces.frontLower, itemKey: 'panel_98' };
  counter.faces.leftUpper = { ...counter.faces.leftUpper, itemKey: 'panel_98' };
  const counted = collectPanelSurfaces(counter).map((surface) => surface.itemKey);
  assert.deepEqual(counted, ['panel_197', 'panel_197', 'panel_48_5', 'panel_48_5', 'panel_48_5', 'panel_48_5']);
});

test('panel dökümü: tek baza ve L banko listedeki yüz panelleriyle aynı ölçüleri sayar', async () => {
  const { resolveProjectBom } = await import('../src/projectBom.js');
  const sizes = (itemKey) => {
    const module = createModuleStateFromCatalogKey(itemKey);
    module.id = 'm';
    module.placement = { xCm: 0, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'free' };
    const rows = resolveProjectBom([module]).panelAssignments.groups.flatMap((group) => group.rows);
    return Object.fromEntries(rows.map((row) => [row.widthCm, row.quantity]));
  };
  assert.deepEqual(sizes('base_200'), { 197: 1, 48.5: 2 });
  assert.deepEqual(sizes('desk_banko_100_l'), { 98: 4, 48.5: 4 });
});
