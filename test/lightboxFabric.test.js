import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('multi-panel lightbox fabric is exposed from panel context menu', () => {
  const menu = readFileSync(new URL('../src/moduleContextMenu.js', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(menu, /data-module-action="toggle-fabric"/);
  assert.match(menu, /Lightbox Kumaşa Çevir/);
  assert.match(menu, /Lightbox Kumaştan Çıkar/);
  assert.match(main, /function changeContextFabricMode/);
  assert.match(main, /scene3d\.applyFabricMode\(selectedPanels, enabled\)/);
});

test('mesh branda is a separate one-piece cover without lightbox lighting', () => {
  const menu = readFileSync(new URL('../src/moduleContextMenu.js', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const scene = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');

  assert.match(menu, /data-module-action="toggle-mesh"/);
  assert.match(menu, /Mesh \(Delikli\) Brandaya Çevir/);
  assert.match(menu, /Mesh Brandadan Çıkar/);
  assert.match(main, /function changeContextMeshMode/);
  assert.match(main, /scene3d\.applyMeshMode\(selectedPanels, enabled\)/);
  assert.match(scene, /function applyMeshMode\(meshOrMeshes, enabled\)/);
  assert.match(scene, /fabricType === 'mesh'/);
  assert.match(scene, /backing\.visible = fabricType !== 'mesh'/);
  assert.match(scene, /Mesh Branda aydınlatılamaz/);
});

test('lightbox lighting stays fully opaque while Mesh uses its own opacity constant', () => {
  const scene = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  assert.match(scene, /material\.opacity = fabricType === 'mesh' \? MESH_FABRIC_OPACITY : 1/);
  assert.match(scene, /material\.transparent = fabricType === 'mesh'/);
  assert.match(scene, /material\.depthWrite = fabricType !== 'mesh'/);
  assert.match(scene, /fabricType = fabricState\.fabricType === 'mesh'/);
});

test('fabric conversion allows a rectangular panel block and renders one overlay', () => {
  const scene = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  assert.match(scene, /function applyFabricMode\(meshOrMeshes, enabled\)/);
  assert.match(scene, /if \(!meshes\.length\)/);
  assert.match(scene, /if \(!surfaces\.length\) return;/);
  assert.match(scene, /createRectSelection\(/);
  assert.match(scene, /fabricGroupId/);
  assert.match(scene, /function rebuildFabricOverlays\(/);
  assert.match(scene, /overlay\.userData\.role = fabricType === 'mesh' \? 'mesh-branda' : 'lightbox-fabric'/);
  assert.match(scene, /new THREE\.PlaneGeometry\(width, height\)/);
  assert.match(scene, /overlay\.raycast = \(\) => \{\}/);
});