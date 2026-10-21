import test from 'node:test';
import assert from 'node:assert/strict';
import { createModuleStateFromDescriptor } from '../src/designState.js';
import { resolveWallItemKeyForHeight } from '../src/items.js';
import { listFlatPanelModuleSeamHeightsCm } from '../src/wallPanelBand.js';
import { listVirtualShelfRailHeightsCm } from '../src/itemSnap.js';
import { getStandDimensions, initializeStandDimensions } from '../src/standDimensions.js';
import { snapPanelSeamOverlayPlacement, stepPanelSeamOverlayPlacement, WALL_OVERLAY_DEFAULT_CENTER_CM } from '../src/modulePlacement.js';

test('kapı üstü raf yalnız gerçek panel birleşimlerine oturur: 250–500 cm', () => {
  const previous = { ...getStandDimensions() };
  try {
  for (const height of [250, 300, 350, 400, 450, 500]) {
    initializeStandDimensions({ ...previous, heightCm: height });
    const host = createModuleStateFromDescriptor({ itemKey: resolveWallItemKeyForHeight('wall_door_100_350', height) });
    host.placement = { wallId: 'back', xCm: 0, yCm: 0, zCm: 0, rotationZDeg: 0 };
    const expected = Array.from({ length: height / 50 - 5 }, (_, index) => 250 + index * 50);
    assert.deepEqual(listFlatPanelModuleSeamHeightsCm(host), expected);
    assert.deepEqual(listVirtualShelfRailHeightsCm(host), expected);
    for (const card of ['shelf_row_1', 'shelf_row_2']) {
      const shelf = createModuleStateFromDescriptor({ itemKey: card });
      const snap = (z) => snapPanelSeamOverlayPlacement({ moduleState: shelf, modules: [host],
        wallPoint: { wallId: 'back', pointerXCm: 50, pointerYCm: 0, absoluteHeightCm: z, rotationZDeg: 0 } });
      for (const edge of [0, 50, 100, 150, 200, height]) assert.equal(snap(edge).ok, false, `${height}/${card}/${edge}`);
      for (const seam of expected) {
        const result = snap(seam);
        const fits = seam + shelf.heightCm <= height;
        assert.equal(result.ok, fits, `${height}/${card}/${seam}`);
        if (!fits) continue;
        assert.equal(result.seamHeightCm, seam);
        assert.equal(result.placement.xCm, 0);
        assert.ok(Math.abs(result.placement.zCm + WALL_OVERLAY_DEFAULT_CENTER_CM - shelf.heightCm / 2 - seam) < 1e-8);
        const state = { ...result.resolvedModuleState, placement: result.placement };
        assert.equal(stepPanelSeamOverlayPlacement({ moduleState: state, modules: [host], seamDelta: -1 }) === null, seam === expected[0]);
      }
    }
  }
  } finally { initializeStandDimensions(previous); }
});

test('aynı panel birleşimi doluyken tekli veya sıralı raf tekrar konmaz; kendi taşıması engellenmez', () => {
  const host = createModuleStateFromDescriptor({ itemKey: 'wall_door_100_350' });
  host.placement = { wallId: 'back', xCm: 0, yCm: 0, zCm: 0, rotationZDeg: 0 };
  const snap = (shelf, z, modules) => snapPanelSeamOverlayPlacement({ moduleState: shelf, modules,
    wallPoint: { wallId: 'back', pointerXCm: 50, pointerYCm: 0, absoluteHeightCm: z, rotationZDeg: 0 } });
  const single = createModuleStateFromDescriptor({ itemKey: 'shelf_row_1' });
  const first = snap(single, 250, [host]);
  const placed = { ...first.resolvedModuleState, placement: first.placement };
  for (const card of ['shelf_row_1', 'shelf_row_2']) {
    const result = snap(createModuleStateFromDescriptor({ itemKey: card }), 250, [host, placed]);
    assert.equal(result.ok, false);
    assert.match(result.message, /zaten raf/);
  }
  assert.equal(snap(placed, 250, [host, placed]).ok, true);
  const second = snap(createModuleStateFromDescriptor({ itemKey: 'shelf_row_1' }), 300, [host, placed]);
  assert.equal(second.ok, true);
  const secondState = { ...second.resolvedModuleState, placement: second.placement };
  assert.equal(stepPanelSeamOverlayPlacement({ moduleState: secondState, modules: [host, placed, secondState], seamDelta: -1 }), null);
  const double = snap(createModuleStateFromDescriptor({ itemKey: 'shelf_row_2' }), 250, [host]);
  const doubleState = { ...double.resolvedModuleState, placement: double.placement };
  assert.equal(snap(createModuleStateFromDescriptor({ itemKey: 'shelf_row_1' }), 300, [host, doubleState]).ok, false);
});
