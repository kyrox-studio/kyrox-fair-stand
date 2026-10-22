import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scene = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');

function functionBlock(startName, endName) {
  const start = scene.indexOf(startName);
  const end = scene.indexOf(endName, start + startName.length);
  assert.ok(start >= 0 && end > start, `${startName} … ${endName}`);
  return scene.slice(start, end);
}

test('perspektif near bakılan noktaya uzaklıkla büyür; yakında 0.05 m kalır (uzak panel z-fighting yok)', () => {
  const constant = scene.match(/const PERSPECTIVE_NEAR = Object\.freeze\(\{ ratio: ([\d.]+), minM: ([\d.]+), maxM: ([\d.]+) \}\);/);
  assert.ok(constant);
  const [ratio, minM, maxM] = constant.slice(1).map(Number);
  // Yakın çekimde eski 0.05 m korunur; panel yüzü–gövde arası 3 mm boşluk 100 m'de bile ayrışır.
  assert.equal(minM, 0.05);
  assert.ok(ratio > 0 && ratio <= 0.02);
  assert.ok(maxM >= 0.5 && maxM <= 2);
  const depthStepAt100M = (100 * 100) / (Math.min(100 * ratio, maxM) * 2 ** 24);
  assert.ok(depthStepAt100M < 0.003, `100 m derinlik adımı ${depthStepAt100M}`);

  const sync = functionBlock('function syncPerspectiveNear(', 'function updateCameraProjection(');
  assert.match(sync, /if \(camera !== perspectiveCamera\) return;/);
  assert.match(sync, /perspectiveCamera\.position\.distanceTo\(controls\.target\)/);
  assert.match(sync, /THREE\.MathUtils\.clamp\(distanceM \* PERSPECTIVE_NEAR\.ratio, PERSPECTIVE_NEAR\.minM, PERSPECTIVE_NEAR\.maxM\)/);
  assert.match(sync, /perspectiveCamera\.updateProjectionMatrix\(\);/);

  // Kamera her değiştiğinde, çizimden önce güncellenir.
  const loop = scene.slice(scene.indexOf('renderer.setAnimationLoop((now) => {'), scene.indexOf('renderer.setAnimationLoop((now) => {') + 2500);
  const syncAt = loop.indexOf('syncPerspectiveNear();');
  assert.ok(syncAt > 0 && syncAt < loop.indexOf('renderer.render(scene, camera);'));
});
