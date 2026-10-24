import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveWallMediaMetrics, getItem, listRegisteredItems, resolveSceneDimensions, resolveItemKey } from '../src/items.js';
import {
  getCatalogItem,
} from '../src/catalog.js';
import { createModuleStateFromDescriptor, duplicateModuleState, normalizeModuleItemState } from '../src/designState.js';
import { resolveModuleContract } from '../src/moduleContracts.js';
import { getModuleBehavior } from '../src/moduleBehavior.js';

for (const item of listRegisteredItems().filter((entry) => entry.type === 'tv')) {
  test(`${item.itemKey}: canonical wall-media identity, state and BOM policy`, () => {
    const metrics = resolveWallMediaMetrics(item.itemKey);
    const catalog = getCatalogItem(item.itemKey);
    const scene = resolveSceneDimensions(item);
    const isVideoWall = Boolean(item.videoWall);

    // 0086: TV ve Video Wall katalogda birer kart; diğer boy / düzenler Özellikler panelinde seçilir.
    if (item.catalogVisible) {
      assert.equal(catalog.itemKey, item.itemKey);
      assert.equal(catalog.label, isVideoWall ? 'Video Wall' : 'TV');
      assert.equal(catalog.previewId, item.previewId);
      assert.equal(Object.hasOwn(catalog, 'type'), false);
      assert.equal(Object.hasOwn(catalog, 'widthCm'), false);
      assert.equal(Object.hasOwn(catalog, 'depthCm'), false);
      assert.equal(Object.hasOwn(catalog, 'heightCm'), false);
      assert.equal(Object.hasOwn(catalog, 'videoWallRows'), false);
      assert.equal(Object.hasOwn(catalog, 'videoWallCols'), false);
      assert.equal(Object.hasOwn(catalog, 'sizeInch'), false);
      assert.equal(Object.hasOwn(catalog, 'screenWidthCm'), false);
      assert.equal(Object.hasOwn(catalog, 'panelScreenWidthCm'), false);
    } else {
      assert.equal(catalog, null);
    }

    const state = createModuleStateFromDescriptor(catalog ?? { itemKey: item.itemKey });
    assert.equal(state.itemKey, item.itemKey);
    assert.equal(state.type, 'tv');
    assert.equal(state.widthCm, scene.widthCm);
    assert.equal(state.depthCm, scene.depthCm);
    assert.equal(state.heightCm, scene.heightCm);
    assert.equal(state.videoWallRows, isVideoWall ? item.videoWall.rows : 1);
    assert.equal(state.videoWallCols, isVideoWall ? item.videoWall.cols : 1);
    assert.equal(Object.hasOwn(state, 'sizeInch'), false);
    assert.equal(Object.hasOwn(state, 'screenWidthCm'), false);
    assert.equal(Object.hasOwn(state, 'panelScreenWidthCm'), false);

    assert.equal(getModuleBehavior(state).placement, 'wall-overlay');

    assert.equal(Object.hasOwn(item, 'unit'), false);
    const contract = resolveModuleContract(item.itemKey);
    assert.equal(contract.bom.mode, 'decision-required');
    assert.equal(contract.bom.source, null);

    assert.equal(resolveItemKey(state), item.itemKey);
    const missingKey = JSON.parse(JSON.stringify(state));
    delete missingKey.itemKey;
    assert.equal(resolveItemKey(missingKey), null);
    assert.equal(normalizeModuleItemState(missingKey).itemKey, undefined);
    assert.equal(missingKey.widthCm, scene.widthCm);

    const duplicate = duplicateModuleState(state);
    assert.notEqual(duplicate.id, state.id);
    assert.equal(duplicate.itemKey, item.itemKey);

    assert.equal(metrics.widthCm, scene.widthCm);
    assert.equal(metrics.heightCm, scene.heightCm);
  });
}

test('video walls read panel size from video_wall_panel and keep rows/cols on the parent', () => {
  const panel = getItem('video_wall_panel');
  assert.equal(panel.catalogVisible, false);
  assert.equal(panel.name, 'Video Wall Panel');
  assert.deepEqual(panel.dimensions, { widthCm: 108.5, heightCm: 61 });
  assert.equal(Object.hasOwn(panel.dimensions, 'depthCm'), false);

  for (const key of ['video_wall_2x2', 'video_wall_3x3']) {
    const item = getItem(key);
    const metrics = resolveWallMediaMetrics(key);
    assert.ok(item.videoWall);
    assert.equal(item.videoWall.panelItemKey, 'video_wall_panel');
    assert.equal(Object.hasOwn(item.videoWall, 'panelScreenWidthCm'), false);
    assert.equal(metrics.widthCm, panel.dimensions.widthCm * item.videoWall.cols);
    assert.equal(metrics.heightCm, panel.dimensions.heightCm * item.videoWall.rows);
    const state = createModuleStateFromDescriptor(getCatalogItem(key) ?? { itemKey: key });
    assert.equal(state.videoWallRows, item.videoWall.rows);
    assert.equal(state.videoWallCols, item.videoWall.cols);
  }
});

test('ordinary TV Items use canonical dimensions as catalog and scene height', () => {
  const expectedHeight = { tv_42: 52.3, tv_55: 68.5, tv_65: 80.9 };
  for (const key of ['tv_42', 'tv_55', 'tv_65']) {
    const item = getItem(key);
    const scene = resolveSceneDimensions(item);
    assert.equal(item.dimensions.heightCm, expectedHeight[key]);
    // TV tek kart (tv_42); 55" ve 65" Özellikler panelinde seçilir.
    assert.equal(getCatalogItem(key)?.itemKey ?? null, key === 'tv_42' ? key : null);
    assert.equal(scene.heightCm, expectedHeight[key]);
    const state = createModuleStateFromDescriptor(getCatalogItem(key) ?? { itemKey: key });
    assert.equal(state.heightCm, item.dimensions.heightCm);
    assert.notEqual(state.heightCm, 350);
  }
});
