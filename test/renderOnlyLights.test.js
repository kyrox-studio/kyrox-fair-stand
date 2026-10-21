import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scene = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');

test('projector and shelf spot lights live on the render-only layer', () => {
  assert.match(scene, /const RENDER_ONLY_LIGHT_LAYER = 1;/);
  assert.equal((scene.match(/spot\.layers\.set\(RENDER_ONLY_LIGHT_LAYER\);/g) ?? []).length, 2);
  // Editörde başka gerçek spot ışık yok: her SpotLight bu katmana alınır.
  assert.equal((scene.match(/new THREE\.SpotLight\(/g) ?? []).length, 2);
});

test('editor draws without shadows and render-only lights; Render Al turns both on and back off', () => {
  assert.match(scene, /renderer\.shadowMap\.enabled = false;/);
  const capture = scene.slice(scene.indexOf('async function captureCurrentViewPng'), scene.indexOf('async function captureCurrentViewPng') + 4000);
  const on = capture.indexOf('camera.layers.enable(RENDER_ONLY_LIGHT_LAYER);');
  const shadowOn = capture.indexOf('renderer.shadowMap.enabled = true;');
  const draw = capture.indexOf('renderer.render(scene, camera);');
  assert.ok(shadowOn > 0 && on > 0 && shadowOn < draw && on < draw);
  const restore = capture.slice(capture.indexOf('} finally {'));
  assert.match(restore, /renderer\.shadowMap\.enabled = false;/);
  assert.match(restore, /camera\.layers\.disable\(RENDER_ONLY_LIGHT_LAYER\);/);
});

test('table glass refraction is on only while Render Al draws', () => {
  assert.equal((scene.match(/userData: \{ renderTransmission: TABLE_GLASS_RENDER_TRANSMISSION \}/g) ?? []).length, 3);
  const capture = scene.slice(scene.indexOf('async function captureCurrentViewPng'), scene.indexOf('async function captureCurrentViewPng') + 4000);
  const on = capture.indexOf('material.transmission = material.userData.renderTransmission;');
  assert.ok(on > 0 && on < capture.indexOf('renderer.render(scene, camera);'));
  assert.match(capture.slice(capture.indexOf('} finally {')), /material\.transmission = 0;/);
});

test('Render Al shows the loading screen before the heavy draw and hides it after', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const handler = main.slice(main.indexOf("renderCurrentViewButton?.addEventListener('click'"), main.indexOf("renderCurrentViewButton?.addEventListener('click'") + 2500);
  const show = handler.indexOf("projectLoading.show('Render hazırlanıyor…'");
  const wait = handler.indexOf('requestAnimationFrame(() => requestAnimationFrame(resolve))');
  const capture = handler.indexOf('scene3d.captureCurrentViewPng(');
  assert.ok(show > 0 && show < wait && wait < capture);
  assert.match(handler.slice(handler.indexOf('} finally {')), /projectLoading\.hide\(\);/);
});
