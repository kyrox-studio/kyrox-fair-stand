import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3 } from 'three';
import { createShelfModule } from '../src/scene3d.js';
import { createModuleStateFromDescriptor } from '../src/designState.js';
import { initializeItemRegistry, listRegisteredItems } from '../src/items.js';

test('raf çizimi alan bazında sceneDimensions önceliğini ve dimensions yedeğini kullanır', () => {
  const snapshot = listRegisteredItems().map((item) => structuredClone(item));
  try {
    const modified = structuredClone(snapshot);
    const row = modified.find((item) => item.itemKey === 'shelf_150_self');
    const stack = modified.find((item) => item.itemKey === 'shelf_row_2_150');
    row.sceneDimensions = { heightCm: 3, depthCm: null };
    stack.sceneDimensions = { heightCm: 63 };
    initializeItemRegistry(modified);
    const { group, surfaces } = createShelfModule({ id: 'raf', itemKey: stack.itemKey, widthCm: 150 }, 0);
    assert.equal(surfaces.length, 2);
    assert.equal(surfaces[0].geometry.parameters.height, 0.03);
    assert.equal(surfaces[0].geometry.parameters.depth, 0.38);
    assert.ok(Math.abs(surfaces[1].position.y - surfaces[0].position.y - 0.6) < 1e-9);
    assert.equal(group.userData.selectionBounds.heightM, 0.63);
    assert.equal(group.userData.depthCm, 38);
    assert.equal(group.userData.heightCm, 63);
    group.traverse((object) => { object.geometry?.dispose(); object.material?.dispose(); });
    // Tekli raf da parent'ın 1,8 cm ölçüsüne değil gerçek tahtanın sahne ölçüsüne gider.
    const single = createShelfModule({ id: 'tekli', itemKey: 'shelf_150', widthCm: 150 }, 0);
    assert.equal(single.surfaces.length, 1);
    assert.equal(single.surfaces[0].geometry.parameters.height, 0.03);
    assert.equal(single.group.userData.selectionBounds.heightM, 0.03);
    single.group.traverse((object) => { object.geometry?.dispose(); object.material?.dispose(); });
  } finally {
    initializeItemRegistry(snapshot);
  }
});

test('tekli, ikili ve üçlü raf ayrı 1,8 cm tahtalar ve her sırada aydınlatma üretir', () => {
  for (const rows of [1, 2, 3]) {
    for (const width of [100, 150, 200]) {
      for (const lighting of [false, true]) {
        const itemKey = rows === 1 ? `shelf_${width}` : `shelf_row_${rows}_${width}`;
        const state = createModuleStateFromDescriptor({ itemKey, type: 'shelf', shelfLightingOn: lighting });
        const { group, surfaces } = createShelfModule(state, 4);
        assert.equal(surfaces.length, rows);
        const strips = group.children.filter((child) => child.userData.role === 'shelf-under-led-strip');
        const spots = group.children.filter((child) => child.userData.role === 'shelf-under-light');
        assert.equal(strips.length, rows);
        assert.equal(spots.length, rows * 2);
        for (const light of [...strips, ...spots]) assert.equal(light.visible, lighting);
        const bounds = new Box3();
        for (const [index, shelf] of surfaces.entries()) {
          assert.ok(Math.abs(shelf.geometry.parameters.height - 0.018) < 1e-9);
          assert.equal(shelf.geometry.parameters.width, width / 100);
          assert.equal(shelf.geometry.parameters.depth, 0.38);
          assert.equal(shelf.userData.moduleId, state.id);
          assert.equal(shelf.userData.moduleIndex, 4);
          bounds.union(new Box3().setFromObject(shelf));
          if (index) assert.ok(Math.abs(shelf.position.y - surfaces[index - 1].position.y - 0.5) < 1e-9);
        }
        assert.ok(Math.abs(bounds.max.y - bounds.min.y - state.heightCm / 100) < 1e-7);
        assert.equal(group.userData.selectionBounds.heightM, state.heightCm / 100);
        group.traverse((object) => { object.geometry?.dispose(); object.material?.dispose(); });
      }
    }
  }
});
