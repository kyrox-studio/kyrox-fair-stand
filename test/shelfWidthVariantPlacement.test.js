import test from 'node:test';
import assert from 'node:assert/strict';
import { createModuleStateFromDescriptor } from '../src/designState.js';
import { snapPanelSeamOverlayPlacement } from '../src/modulePlacement.js';
import { resolveItemBom } from '../src/itemBom.js';

function snap(state, width, rotationZDeg = 0) {
  const host = createModuleStateFromDescriptor({ itemKey: `wall_${width}_350`, type: 'flat-panel' });
  host.placement = { xCm: 0, yCm: 0, zCm: 0, rotationZDeg, wallId: rotationZDeg ? 'left' : 'back' };
  return snapPanelSeamOverlayPlacement({
    moduleState: state,
    modules: [host],
    wallPoint: {
      wallId: host.placement.wallId, rotationZDeg,
      pointerXCm: rotationZDeg ? 0 : width / 2,
      pointerYCm: rotationZDeg ? width / 2 : 0,
      absoluteHeightCm: 100,
    },
  });
}

test('raf kartları duvar genişliğini, ürün kimliğini ve BOM reçetesini birlikte seçer', () => {
  for (const rows of [1, 2, 3]) {
    const original = createModuleStateFromDescriptor({ itemKey: `shelf_row_${rows}`, type: 'shelf' });
    original.shelfLightingOn = true;
    for (const rotation of [0, 90]) {
      for (const width of [200, 100, 150]) {
        const result = snap(original, width, rotation);
        assert.equal(result.ok, true);
        const resolved = result.resolvedModuleState;
        assert.equal(resolved.itemKey, rows === 1 ? `shelf_${width}` : `shelf_row_${rows}_${width}`);
        assert.equal(resolved.widthCm, width);
        assert.equal(resolved.id, original.id);
        assert.equal(resolved.shelfLightingOn, true);
        assert.equal(result.placement.xCm, 0);
        assert.equal(result.placement.yCm, 0);
        const bom = resolveItemBom(resolved.itemKey);
        assert.equal(bom.find((line) => line.itemKey === `shelf_${width}_self`).quantity, rows);
      }
    }
    assert.equal(original.widthCm, 100, 'önizleme kaynak state’i değiştirmez');
    assert.equal(snap(original, 50).ok, false);
    const wide = snap(original, 200).resolvedModuleState;
    assert.equal(snap(wide, 100).resolvedModuleState.widthCm, 100, 'taşırken dar duvara yeniden çözülür');
  }
});

function snapAtHeight(itemKey, absoluteHeightCm) {
  const host = createModuleStateFromDescriptor({ itemKey: 'wall_150_350', type: 'flat-panel' });
  host.placement = { xCm: 0, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' };
  return snapPanelSeamOverlayPlacement({
    moduleState: createModuleStateFromDescriptor({ itemKey, type: 'shelf' }),
    modules: [host],
    wallPoint: { wallId: 'back', rotationZDeg: 0, pointerXCm: 75, pointerYCm: 0, absoluteHeightCm },
  });
}

test('çok sıralı rafın üst tahtası duvarın üstünden taşmaz; alt tahta birleşime oturur', () => {
  // 350 cm duvarda iç birleşimler 50 … 300 cm. Üçlü raf 101,8 cm: en üst geçerli alt birleşim 200.
  assert.equal(snapAtHeight('shelf_row_1', 300).ok, true);
  assert.equal(snapAtHeight('shelf_row_2', 300).ok, false);
  assert.equal(snapAtHeight('shelf_row_2', 250).ok, true);
  assert.equal(snapAtHeight('shelf_row_3', 250).ok, false);
  const three = snapAtHeight('shelf_row_3', 200);
  assert.equal(three.ok, true);
  assert.equal(three.seamHeightCm, 200);
  assert.equal(three.resolvedModuleState.itemKey, 'shelf_row_3_150');
});
