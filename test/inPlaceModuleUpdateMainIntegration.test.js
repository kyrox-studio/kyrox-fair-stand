import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const scene = fs.readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} bulunamadı`);
  const open = source.indexOf('{', source.indexOf(')', start));
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(open, index + 1);
  }
  throw new Error(`${name} kapanmadı`);
}

test('ölçü, ölçü seçimi, varyant ve arka yüz paneli sahneyi baştan kurmaz; yalnız değişen modül eşitlenir', () => {
  for (const name of ['applyDimensionInput', 'changeModuleVariant', 'changeContextBackPanels']) {
    const body = functionBody(main, name);
    assert.doesNotMatch(body, /rebuildWall\(/, `${name} rebuildWall çağırmamalı`);
    assert.match(body, /captureModuleContent\(\)/, `${name} içerik kaydı almalı`);
    assert.match(body, /syncSceneAfterModuleChange\(capturedContent\)/, `${name} sahneyi eşitlemeli`);
  }
});

test('kumaş kaplamalı modül silinince tam kurulumdan önce sahne eşitlenir', () => {
  const body = functionBody(main, 'commitModuleRemoval');
  assert.match(body, /!scene3d\.removeModule\(removed\?\.id, currentModules\) && !scene3d\.syncModules\(currentModules\)/);
});

test('syncModules yeniden yaratılan modülün görsel dokusunu devralır ve seçimi korur', () => {
  const body = functionBody(scene, 'syncModules');
  assert.match(body, /retainGroupTextures\(group, retainedTextures\)/);
  assert.match(body, /rebuildTextureTransfer = retainedTextures\.size \? retainedTextures : null;/);
  assert.match(body, /disposeUnusedRebuildTextures\(\);/);
  assert.match(body, /restoreSelectionAfterSync\(selectedSurfaceIds, previousAnchorSurfaceId\)/);
  // Paylaşılan katalog malzemesine dokunulmaz: yalnız görsel atanmış yüzeyin dokusu alınır.
  assert.match(functionBody(scene, 'retainGroupTextures'), /surfaceState\?\.imageAssetId/);
});
