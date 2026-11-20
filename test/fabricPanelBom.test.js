import test from 'node:test';
import assert from 'node:assert/strict';

import { createModuleStateFromCatalogKey, removePanelStrips, supportsPanelRemoval } from '../src/designState.js';
import { getItem, initializeItemRegistry, listRegisteredItems } from '../src/items.js';
import { resolveProjectBom } from '../src/projectBom.js';

// Lightbox / Mesh kaldırılan panelin yerine konur (kullanıcı kararı 2026-11-20): kaplanan her panel ve iki yan
// aparatı listeden düşer, en alt bant kaplanınca başlangıçlar da; kumaş m² olarak eklenir. Katalogdaki her
// panel kaldırılabilen modül sınanır.
// Test kataloğunda kumaş kalemleri yok: m² satırı için metal separatörün kopyası olarak eklenir.
const metal = getItem('metal_separator');
const fabricItems = ['mesh_fabric', 'lightbox_fabric'].filter((key) => !getItem(key));
if (fabricItems.length) {
  initializeItemRegistry([...listRegisteredItems(), ...fabricItems.map((itemKey) => ({ ...metal, itemKey, name: itemKey }))]);
}

const stand = { standType: 'island', xCm: 1000, yCm: 1000, itemKey: 'karolaj' };
const FABRIC_LINES = new Set(['mesh_fabric', 'lightbox_fabric']);

function placed(itemKey) {
  const module = createModuleStateFromCatalogKey(itemKey);
  if (!module) return null;
  module.id = 'm1';
  module.placement = { xCm: 300, yCm: 300, zCm: 0, rotationZDeg: 0, wallId: 'free' };
  return module;
}

function cover(module, indexes, kind) {
  const strips = module.strips.filter((strip) => indexes.includes(strip.stripIndex));
  for (const strip of strips) {
    strip.fabricGroupId = `fabric-${kind}`;
    strip.fabricType = kind;
    strip.fabricOwnerSurfaceIds = strips.map((entry) => entry.id);
  }
}

const lines = (module, { withFabric = false } = {}) => resolveProjectBom([module], stand).lines
  .filter((line) => !/karolaj/.test(line.itemKey) && (withFabric || !FABRIC_LINES.has(line.itemKey)))
  .map((line) => `${line.itemKey}:${Number(line.quantity.toFixed(4))}`)
  .sort();

test('Lightbox / Mesh kaplanan panel, kaldırılan panel gibi panel ve aparatıyla düşer (tüm katalog)', () => {
  let checked = 0;
  for (const item of listRegisteredItems()) {
    let probe;
    try { probe = placed(item.itemKey); } catch { continue; }
    if (!probe || !supportsPanelRemoval(probe) || (probe.strips?.length ?? 0) < 3) continue;
    const bands = probe.strips.map((strip, index) => (Number.isInteger(strip.stripIndex) ? strip.stripIndex : index));
    for (const indexes of [bands.slice(1, 3), bands]) {
      const removed = placed(item.itemKey);
      removePanelStrips(removed, indexes.map((stripIndex) => ({ side: 'front', stripIndex })));
      for (const kind of ['lightbox', 'mesh']) {
        const covered = placed(item.itemKey);
        cover(covered, indexes, kind);
        assert.deepEqual(lines(covered), lines(removed), `${item.itemKey} ${kind} ${indexes.join(',')}`);
        assert.ok(lines(covered, { withFabric: true }).some((line) => line.startsWith(`${kind}_fabric:`)), `${item.itemKey} ${kind} m²`);
        const dokum = resolveProjectBom([covered], stand).panelAssignments.groups.reduce((sum, group) => sum + group.total, 0);
        const panels = resolveProjectBom([covered], stand).lines
          .filter((line) => getItem(line.itemKey)?.type === 'panel').reduce((sum, line) => sum + line.quantity, 0);
        assert.equal(dokum, panels, `${item.itemKey} ${kind} döküm = liste`);
      }
    }
    checked += 1;
  }
  assert.ok(checked >= 4, `${checked} modül`);
});

test('boydan boya Lightbox: panel, tekli ve başlangıç aparatı kalmaz; profil ve dikme kalır', () => {
  const wall = placed('wall_100_350');
  cover(wall, wall.strips.map((strip) => strip.stripIndex), 'lightbox');
  const result = lines(wall);
  assert.ok(result.every((line) => !/^(panel_|connector_)/.test(line)), result.join(' '));
  assert.ok(result.some((line) => line.startsWith('profile_')));
  assert.ok(result.some((line) => line.startsWith('upright_')));
});

test('2 panel Lightbox: 2 panel ve 4 tekli aparat düşer, başlangıç kalır', () => {
  const plain = placed('wall_100_350');
  const wall = placed('wall_100_350');
  cover(wall, [2, 3], 'lightbox');
  const count = (entries, key) => Number(entries.find((line) => line.startsWith(`${key}:`))?.split(':')[1] ?? 0);
  assert.equal(count(lines(plain), 'panel_98') - count(lines(wall), 'panel_98'), 2);
  assert.equal(count(lines(plain), 'connector_single') - count(lines(wall), 'connector_single'), 4);
  assert.equal(count(lines(wall), 'connector_start'), count(lines(plain), 'connector_start'));
});

test('şerit paneli olan her modülde kaplanan panel listeden düşer, döküm listeyle aynı (tüm katalog)', () => {
  let checked = 0;
  for (const item of listRegisteredItems()) {
    let plain;
    try { plain = placed(item.itemKey); } catch { continue; }
    const panelStrips = (plain?.strips ?? []).filter((strip) => getItem(strip.itemKey)?.type === 'panel');
    if (panelStrips.length < 2) continue;
    const target = panelStrips[panelStrips.length - 1].stripIndex;
    const covered = placed(item.itemKey);
    cover(covered, [target], 'mesh');
    const total = (module) => resolveProjectBom([module], stand).lines
      .filter((line) => getItem(line.itemKey)?.type === 'panel').reduce((sum, line) => sum + line.quantity, 0);
    assert.equal(total(plain) - total(covered), 1, item.itemKey);
    const dokum = resolveProjectBom([covered], stand).panelAssignments.groups.reduce((sum, group) => sum + group.total, 0);
    assert.equal(dokum, total(covered), `${item.itemKey} döküm = liste`);
    checked += 1;
  }
  assert.ok(checked >= 10, `${checked} modül`);
});

// Baza / banko yüzleri (2026-11-20): kaplanan yüz paneli ve iki yan tekli aparatıyla düşer; alt banttaki yüz
// (bazada her yüz, bankoda alt yüzler) kendi 2 başlangıcını da düşürür. Bazanın satırları dizi formülünden gelir.
function placedAt(itemKey, id, xCm) {
  const module = createModuleStateFromCatalogKey(itemKey);
  module.id = id;
  module.placement = { xCm, yCm: 300, zCm: 0, rotationZDeg: 0, wallId: 'free' };
  return module;
}
const count = (bom, key) => bom.lines.filter((line) => line.itemKey === key).reduce((sum, line) => sum + line.quantity, 0);
const panelTotal = (bom) => bom.lines.filter((line) => getItem(line.itemKey)?.type === 'panel').reduce((sum, line) => sum + line.quantity, 0);
const dokumTotal = (bom) => bom.panelAssignments.groups.reduce((sum, group) => sum + group.total, 0);

test('baza ve banko: kaplanan her yüz panel, 2 tekli ve alt bantta 2 başlangıç düşürür; döküm = liste', () => {
  let checked = 0;
  for (const item of listRegisteredItems().filter((entry) => ['base', 'counter'].includes(entry.type))) {
    const plain = placedAt(item.itemKey, 'b1', 300);
    if (!plain?.faces) continue;
    const before = resolveProjectBom([plain], stand);
    for (const [faceKey] of Object.entries(plain.faces)) {
      const covered = placedAt(item.itemKey, 'b1', 300);
      Object.assign(covered.faces[faceKey], { fabricGroupId: 'g', fabricType: 'lightbox' });
      const after = resolveProjectBom([covered], stand);
      const label = `${item.itemKey} ${faceKey}`;
      assert.equal(panelTotal(before) - panelTotal(after), 1, `${label} panel`);
      assert.equal(count(before, 'connector_single') - count(after, 'connector_single'), 2, `${label} tekli`);
      assert.equal(count(before, 'connector_start') - count(after, 'connector_start'), /Upper$/.test(faceKey) ? 0 : 2, `${label} başlangıç`);
      assert.equal(dokumTotal(after), panelTotal(after), `${label} döküm`);
    }
    const all = placedAt(item.itemKey, 'b1', 300);
    Object.values(all.faces).forEach((face) => Object.assign(face, { fabricGroupId: 'g', fabricType: 'mesh' }));
    const bom = resolveProjectBom([all], stand);
    assert.equal(panelTotal(bom), 0, `${item.itemKey} panel kalmaz`);
    assert.equal(count(bom, 'connector_start'), 0, `${item.itemKey} başlangıç kalmaz`);
    checked += 1;
  }
  assert.ok(checked >= 6, `${checked} baza / banko`);
});

test('yan yana iki bazada içteki kaplanan yüz iki kez düşülmez', () => {
  const a = placedAt('base_100', 'a', 200);
  const b = placedAt('base_100', 'b', 300);
  const plain = resolveProjectBom([a, b], stand);
  const a2 = placedAt('base_100', 'a', 200);
  const b2 = placedAt('base_100', 'b', 300);
  Object.assign(a2.faces.right, { fabricGroupId: 'g', fabricType: 'lightbox' });
  Object.assign(b2.faces.left, { fabricGroupId: 'g', fabricType: 'lightbox' });
  const covered = resolveProjectBom([a2, b2], stand);
  assert.deepEqual(
    covered.lines.filter((line) => !/karolaj|fabric/.test(line.itemKey)).map((line) => `${line.itemKey}:${line.quantity}`).sort(),
    plain.lines.filter((line) => !/karolaj|fabric/.test(line.itemKey)).map((line) => `${line.itemKey}:${line.quantity}`).sort(),
  );
});
