import test from 'node:test';
import assert from 'node:assert/strict';

import { createModuleStateFromDescriptor, normalizeModuleItemState } from '../src/designState.js';
import { getItem } from '../src/items.js';
import { createModulePlacement } from '../src/modulePlacement.js';
import { collectPrintAreas } from '../src/printAreaBom.js';
import { resolveProjectBom } from '../src/projectBom.js';

// Hata (2026-11-16): stand ölçüsü değişince 200'lük duvar 100'e çevrildi, bantlar görseliyle
// kopyalandı ama panel kimliği panel_197 kaldı. Sahne 100 çizdi; atama dökümü ve baskı 197 / 200 okudu.
function staleNarrowedWall({ image = true } = {}) {
  const wide = createModuleStateFromDescriptor({ itemKey: 'wall_200_350', type: getItem('wall_200_350').type });
  const narrow = createModuleStateFromDescriptor({ itemKey: 'wall_100_350', type: getItem('wall_100_350').type });
  narrow.id = 'narrowed';
  narrow.placement = createModulePlacement({ xCm: 0, yCm: 0, rotationZDeg: 0 });
  narrow.strips = structuredClone(wide.strips);
  if (image) narrow.strips[0].imageAssetId = 'img';
  narrow.strips[1].color = '#123456';
  return narrow;
}

test('açılışta eskimiş panel kimliği reçeteye göre onarılır; görsel ve renk kalır', () => {
  const module = staleNarrowedWall();
  assert.equal(module.strips[0].itemKey, 'panel_197');
  normalizeModuleItemState(module);
  assert.deepEqual([...new Set(module.strips.map((strip) => strip.itemKey))], ['panel_98']);
  assert.equal(module.strips[0].widthCm, getItem('panel_98').sceneDimensions?.widthCm ?? 98); // sahne ölçüsü
  assert.equal(module.strips[0].imageAssetId, 'img');
  assert.equal(module.strips[1].color, '#123456');
});

test('üretim listesi eskimiş kimliği okusa da panel ölçüsünü reçeteden alır', () => {
  const bom = resolveProjectBom([staleNarrowedWall({ image: false })]);
  const sizes = bom.panelAssignments.panels.map((panel) => panel.widthCm);
  assert.deepEqual([...new Set(sizes)], [98]);
  assert.equal(bom.lines.find((line) => line.itemKey === 'panel_98')?.quantity, 7);
  assert.equal(bom.lines.find((line) => line.itemKey === 'panel_197'), undefined);
});

test('onarılan duvarın tek panel baskısı 100 cm’lik panelin ölçüsüdür, 200’lük değil', () => {
  const module = staleNarrowedWall();
  normalizeModuleItemState(module);
  const image = collectPrintAreas([module], null).find((section) => section.id === 'image');
  assert.deepEqual(image.lines.map((line) => line.widthCm), [getItem('panel_98').sceneDimensions?.widthCm ?? 98]);
});
