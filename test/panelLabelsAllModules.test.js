import test from 'node:test';
import assert from 'node:assert/strict';

import { createModuleStateFromCatalogKey } from '../src/designState.js';
import { getItem, listRegisteredItems } from '../src/items.js';
import { resolveProjectBom } from '../src/projectBom.js';

const stand = { standType: 'island', xCm: 1000, yCm: 1000, itemKey: 'karolaj' };

function placed(itemKey) {
  const module = createModuleStateFromCatalogKey(itemKey);
  if (!module) return null;
  module.id = 'm1';
  module.placement = { xCm: 300, yCm: 300, zCm: 0, rotationZDeg: 0, wallId: 'free' };
  return module;
}

// Panel dökümü (Panel Ölçüleri) listenin panel kalemleriyle aynı sayıdadır: her panelli katalog modülü (2026-11-20).
test('her panelli modülde döküm toplamı = Üretim Listesi panel adedi', () => {
  let checked = 0;
  for (const item of listRegisteredItems()) {
    let module;
    try { module = placed(item.itemKey); } catch { continue; }
    if (!module) continue;
    const bom = resolveProjectBom([module], stand);
    const panels = bom.lines.filter((line) => getItem(line.itemKey)?.type === 'panel')
      .reduce((sum, line) => sum + line.quantity, 0);
    const listed = bom.panelAssignments.groups.reduce((sum, group) => sum + group.total, 0);
    assert.equal(listed, panels, item.itemKey);
    if (panels) checked += 1;
  }
  assert.ok(checked >= 20, `${checked} panelli modül`);
});

test('vitrinde göz açıklığı panel değildir; üst panele atanan renk dökümde sayılır', () => {
  for (const [itemKey, panels] of [['wall_showcase_100_3_350', 4], ['wall_showcase_100_2_350', 5]]) {
    const module = placed(itemKey);
    module.strips[6].color = '#c0392b';
    const groups = Object.fromEntries(resolveProjectBom([module], stand).panelAssignments.groups
      .map((group) => [group.id, group.total]));
    assert.equal(groups.color, 1, itemKey);
    assert.equal(groups.default, panels - 1, itemKey);
  }
});

test('vitrin panel kimliği sahnenin çizdiği bantlardadır; eski kayıtta açıklık bandındaki kimlik kalkar', async () => {
  const { normalizeModuleItemState } = await import('../src/designState.js');
  const module = placed('wall_showcase_100_3_350');
  const keyed = module.strips.map((strip) => Boolean(strip.itemKey));
  assert.deepEqual(keyed, [true, false, false, false, true, true, true]);
  const old = structuredClone(module);
  old.strips.forEach((strip, index) => {
    if (index < 4) strip.itemKey = 'panel_98';
    else delete strip.itemKey;
  });
  const repaired = normalizeModuleItemState(old);
  assert.deepEqual(repaired.strips.map((strip) => Boolean(strip.itemKey)), [true, false, false, false, true, true, true]);
});
