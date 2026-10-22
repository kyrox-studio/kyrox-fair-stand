import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scene = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');

test('projector and shelf spots are render-only; stand-top spot has its own stage layer', () => {
  assert.match(scene, /const RENDER_ONLY_LIGHT_LAYER = 1;/);
  assert.match(scene, /const STAGE_LIGHT_LAYER = 2;/);
  assert.equal((scene.match(/ spot\.layers\.set\(RENDER_ONLY_LIGHT_LAYER\);/g) ?? []).length, 2);
  assert.equal((scene.match(/standTopSpot\.layers\.set\(STAGE_LIGHT_LAYER\);/g) ?? []).length, 1);
  // Başka gerçek spot ışık yok: her SpotLight editör kamerasının varsayılan katmanı dışındadır.
  assert.equal((scene.match(/new THREE\.SpotLight\(/g) ?? []).length, 3);
  // Sahne Işığı önizlemesi yalnız tepe spotu katmanını açar; projektör/raf altı katmanı editörde kapalı.
  const apply = scene.slice(scene.indexOf('function applyStageLighting('), scene.indexOf('function setStageLightPreview('));
  assert.match(apply, /viewCamera\.layers\.enable\(STAGE_LIGHT_LAYER\)/);
  assert.doesNotMatch(apply, /RENDER_ONLY_LIGHT_LAYER/);
});

test('Sahne Işığı preview is a session-only toggle that dims ambient light and restores editor values', () => {
  const apply = scene.slice(scene.indexOf('function applyStageLighting('), scene.indexOf('function setStageLightPreview('));
  assert.match(apply, /\[perspectiveCamera, orthographicCamera\]\.forEach/);
  assert.match(apply, /hemisphereLight\.intensity = editorLightIntensity\.hemisphere \* \(enabled \? RENDER_AMBIENT_DIM\.hemisphere : 1\);/);
  assert.match(apply, /keyLight\.intensity = editorLightIntensity\.key \* \(enabled \? RENDER_AMBIENT_DIM\.key : 1\);/);
  assert.match(scene, /const editorLightIntensity = Object\.freeze\(\{ hemisphere: hemisphereLight\.intensity, key: keyLight\.intensity \}\);/);
  // Varsayılan açık ve sahne kurulurken uygulanır.
  assert.match(scene, /let stageLightPreview = true;/);
  assert.match(scene, /^  applyStageLighting\(stageLightPreview\);\r?$/m);
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /scene3d\.setStageLightPreview\(/);
  assert.match(main, /toggleStageLightButton\.setAttribute\('aria-pressed', String\(enabled\)\);/);
  // Oturumluk: proje durumuna veya depolamaya yazılmaz.
  assert.doesNotMatch(main, /stageLightPreview|stageLight:/);
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<button id="toggle-stage-light" type="button" class="viewport-render-button is-active" aria-pressed="true"/);
});

test('stand-top spot drops a soft pool over the stand without casting shadows', () => {
  assert.match(scene, /const standTopSpot = new THREE\.SpotLight\(/);
  assert.match(scene, /standTopSpot\.castShadow = false;/);
  const aim = scene.slice(scene.indexOf('function aimKeyLightAtStand('), scene.indexOf('shadowCamera.updateProjectionMatrix();'));
  assert.match(aim, /Math\.hypot\(widthM, depthM\) \/ 2 \+ STAND_TOP_SPOT\.poolMarginM/);
  assert.match(aim, /standTopSpot\.position\.set\(centerX, STAND_TOP_SPOT\.heightM, centerZ\);/);
  assert.match(aim, /standTopSpot\.target\.position\.set\(centerX, 0, centerZ\);/);
  assert.match(aim, /standTopSpot\.angle = Math\.atan\(poolRadiusM \/ STAND_TOP_SPOT\.heightM\);/);
});

test('Render Al turns stage lighting on while drawing and returns to the preview state', () => {
  const capture = scene.slice(scene.indexOf('async function captureCurrentViewPng'), scene.indexOf('async function captureCurrentViewPng') + 5000);
  const on = capture.indexOf('applyStageLighting(true);');
  const draw = capture.indexOf('renderer.render(scene, camera);');
  assert.ok(on > 0 && on < draw);
  const restore = capture.slice(capture.indexOf('} finally {'));
  assert.match(restore, /applyStageLighting\(stageLightPreview\);/);
  // Kısma oranları ışığı söndürmez, yalnız azaltır.
  const dim = scene.match(/const RENDER_AMBIENT_DIM = Object\.freeze\(\{ hemisphere: ([\d.]+), key: ([\d.]+) \}\);/);
  assert.ok(dim);
  [dim[1], dim[2]].map(Number).forEach((ratio) => assert.ok(ratio > 0 && ratio < 1));
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

test('stage fill lights are horizontal, shadowless and live on the stage layer', () => {
  assert.match(scene, /const STAGE_FILL_LIGHT = Object\.freeze\(\{/);
  assert.match(scene, /fillLight\.castShadow = false;/);
  assert.match(scene, /fillLight\.layers\.set\(STAGE_LIGHT_LAYER\);/);
  // Projektör/raf altı katmanında başka DirectionalLight yok.
  assert.doesNotMatch(scene, /fillLight\.layers\.set\(RENDER_ONLY_LIGHT_LAYER\)/);
  const aim = scene.slice(scene.indexOf('function aimKeyLightAtStand('), scene.indexOf('shadowCamera.updateProjectionMatrix();'));
  // Kaynak ve hedef aynı yükseklikte: ışık tam yatay, zemine düşmez.
  assert.match(aim, /fillLight\.position\.set\(centerX \+ direction\.x \* 10, STAGE_FILL_LIGHT\.heightM, centerZ \+ direction\.z \* 10\);/);
  assert.match(aim, /fillLight\.target\.position\.set\(centerX, STAGE_FILL_LIGHT\.heightM, centerZ\);/);
});

test('auto fascia panels get a light backing body; other panels keep the dark body', () => {
  assert.match(scene, /const FASCIA_BACK_COLOR = 0x[0-9a-f]{6};/);
  const helper = scene.slice(scene.indexOf('function opaquePanelBackColor('), scene.indexOf('function opaquePanelBackColor(') + 200);
  assert.match(helper, /moduleState\?\.autoFascia === true \? FASCIA_BACK_COLOR : PANEL_BACK_COLOR/);
  const flat = scene.slice(scene.indexOf('function createFlatPanelModule('), scene.indexOf('function createDoorModule('));
  assert.match(flat, /const opaqueBackColor = opaquePanelBackColor\(moduleState\);/);
  assert.match(flat, /color: isGlass \? PANEL_GLASS_BACKING_APPEARANCE\.color : opaqueBackColor,/);
  assert.match(flat, /backing\.userData\.opaqueBackColor = opaqueBackColor;/);
  // Renk/cam uygulanınca açık gövde korunur.
  assert.match(scene, /backing\.material\.color\.set\(glass \? PANEL_GLASS_BACKING_APPEARANCE\.color : \(backing\.userData\.opaqueBackColor \?\? PANEL_BACK_COLOR\)\);/);
});
