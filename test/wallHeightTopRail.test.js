import test from 'node:test';
import assert from 'node:assert/strict';
import { createModuleStateFromCatalogKey } from '../src/designState.js';
import { resolveAutomaticWallFlatPanelItemKey, setActiveWallLineHeightCm } from '../src/items.js';
import { snapPlacementToItemAnchor } from '../src/itemSnap.js';

test('projektör her duvar yüksekliğinde duvar tepesine oturur', () => {
  try {
    for (const heightCm of [250, 300, 350, 400, 450, 500]) {
      setActiveWallLineHeightCm(heightCm);
      const wall = {
        id: 'wall-a',
        type: 'flat-panel',
        itemKey: resolveAutomaticWallFlatPanelItemKey(200, heightCm),
        widthCm: 200,
        placement: { xCm: 0, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' },
      };
      const light = createModuleStateFromCatalogKey('led_floodlight');
      const placement = { xCm: 50, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' };
      assert.equal(snapPlacementToItemAnchor(light, placement, [wall]).zCm, heightCm);
    }
  } finally {
    setActiveWallLineHeightCm(350);
  }
});
