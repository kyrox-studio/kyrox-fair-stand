import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scene3dSource = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const mainSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const CREATE_STAND_SCENE_PUBLIC_METHODS = Object.freeze([
  'captureCurrentViewPng',
  'requestRender',
  'appendModule',
  'removeModule',
  'setShelfLightingVisible',
  'setCameraMode',
  'getCameraMode',
  'createStage',
  'setFloorType',
  'setFloorColor',
  'setFloorArea',
  'setFloorAreaColor',
  'setFloorAreaDrawArmed',
  'isFloorAreaSelected',
  'getSelectedModuleIds',
  'selectModulesById',
  'showPlacementFeedback',
  'buildWall',
  'clearWall',
  'clearSelection',
  'resetStageView',
  'resetDefaultView',
  'applyColor',
  'applyGlassMode',
  'applyMetalSeparatorMode',
  'applyFabricMode',
  'applyMeshMode',
  'setFabricLighting',
  'applyImageAsset',
  'applySizeImageAsset',
  'resolveImageBlock',
  'describeImageSizeTarget',
  'applyHorizontalImageAsset',
  'applyRectImageAsset',
  'clearImage',
  'clearImageAssetById',
  'previewCatalogModuleDrag',
  'dropCatalogModuleDrag',
  'clearCatalogModuleDrag',
  'getStageLayout',
  'getSelectedSurface',
  'getSelectedSurfaces',
  'isFloorSelected',
  'getSelectedFloorType',
  'setIlluminatedFoamHaloColor',
  'dispose',
]);

function extractCreateStandSceneReturnKeys(source) {
  const marker = '\n  return {\n    captureCurrentViewPng,';
  const start = source.indexOf(marker);
  assert.ok(start >= 0, 'createStandScene public return marker missing');
  const close = source.indexOf('\n  };\n}', start);
  assert.ok(close > start, 'createStandScene public return close missing');
  const body = source.slice(start + '\n  return {\n'.length, close);
  const keys = [];
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('if') || trimmed.startsWith('const ') || trimmed.startsWith('let ') || trimmed.startsWith('return ')) {
      continue;
    }
    const keyMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*[:(,]/);
    if (keyMatch) keys.push(keyMatch[1]);
  }
  return keys;
}

test('createStandScene public façade keeps the production methods main.js calls', () => {
  const keys = extractCreateStandSceneReturnKeys(scene3dSource);
  assert.deepEqual(keys, [...CREATE_STAND_SCENE_PUBLIC_METHODS]);

  const used = [...mainSource.matchAll(/\bscene3d\.([A-Za-z_][A-Za-z0-9_]*)\s*\??\s*\(/g)].map((match) => match[1]);
  for (const name of new Set(used)) {
    assert.ok(
      CREATE_STAND_SCENE_PUBLIC_METHODS.includes(name),
      `main.js scene3d.${name} createStandScene dönüşünde yok`,
    );
  }
});

test('placement drag pointer move/up bind to the host window so capture loss cannot drop the gesture', () => {
  assert.match(scene3dSource, /const hostWindow = getFairStandHostWindow\(\);/);
  assert.match(
    scene3dSource,
    /hostWindow\.addEventListener\('pointermove'/,
  );
  assert.match(
    scene3dSource,
    /hostWindow\.addEventListener\('pointerup'/,
  );
  assert.doesNotMatch(
    scene3dSource,
    /renderer\.domElement\.addEventListener\('pointermove'/,
  );
});
