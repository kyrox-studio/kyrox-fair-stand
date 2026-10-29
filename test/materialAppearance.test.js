import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GLASS_APPEARANCE,
  TABLE_GLASS_APPEARANCE,
  TABLE_GLASS_RENDER_TRANSMISSION,
  PANEL_GLASS_BACKING_APPEARANCE,
  getMaterialAppearance,
} from '../src/theme.js';
import { readFileSync } from 'node:fs';

const scene = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');

test('normal glass has one centralized default appearance', () => {
  assert.deepEqual(GLASS_APPEARANCE, {
    color: 0xd7e9ed,
    opacity: 0.48,
    roughness: 0.16,
    metalness: 0,
    transparent: true,
    depthWrite: false,
  });
  assert.equal(Object.isFrozen(GLASS_APPEARANCE), true);
});



test('material=cam resolves the shared normal glass appearance', () => {
  assert.equal(getMaterialAppearance('cam'), GLASS_APPEARANCE);
  assert.equal(getMaterialAppearance('sunta'), null);
});

test('table glass extends normal glass with explicit physical-render overrides', () => {
  assert.equal(TABLE_GLASS_APPEARANCE.color, GLASS_APPEARANCE.color);
  assert.equal(TABLE_GLASS_APPEARANCE.opacity, 0.42);
  assert.equal(TABLE_GLASS_APPEARANCE.roughness, 0.10);
  // Kırılma editörde kapalı, yalnız Render Al'da açılır (bkz. renderOnlyLights testi).
  assert.equal(TABLE_GLASS_APPEARANCE.transmission, undefined);
  assert.equal(TABLE_GLASS_RENDER_TRANSMISSION, 0.32);
  assert.equal(TABLE_GLASS_APPEARANCE.clearcoat, 0.65);
  assert.equal(Object.isFrozen(TABLE_GLASS_APPEARANCE), true);
  assert.match(scene, /createEamesTableChairSetModule[\s\S]*?\.\.\.TABLE_GLASS_APPEARANCE/);
  assert.match(scene, /function addClassicCoffeeTable[\s\S]*?\.\.\.TABLE_GLASS_APPEARANCE/);
});

test('panel backing remains a panel-only render effect', () => {
  assert.deepEqual(PANEL_GLASS_BACKING_APPEARANCE, {
    color: 0xc9dce1,
    opacity: 0.18,
    roughness: 0.22,
    metalness: 0,
    transparent: true,
    depthWrite: false,
  });
  assert.equal(Object.isFrozen(PANEL_GLASS_BACKING_APPEARANCE), true);
  assert.match(scene, /PANEL_GLASS_BACKING_APPEARANCE\.color/);
  assert.match(scene, /PANEL_GLASS_BACKING_APPEARANCE\.opacity/);
});

test('projector lens remains specialized and does not consume the normal glass standard', () => {
  const start = scene.indexOf('function createLedFloodlightModule(');
  const end = scene.indexOf('addFloodlightMesh(group, assets.mount', start);
  const projector = scene.slice(start, end);
  assert.match(projector, /emissive: 0xf2ffe8/);
  assert.match(projector, /emissiveIntensity: 1\.65/);
  // transmission açık malzeme sahneyi her karede ikinci kez çizdirir ve eklenince bütün
  // malzemeleri yeniden derletir (projektör bırakınca ~1,3 sn donma); lens yalnız parlar.
  assert.doesNotMatch(projector, /transmission:\s*[0-9]/);
  assert.doesNotMatch(projector, /GLASS_APPEARANCE/);
});

test('mesh fabric no longer borrows the glass opacity constant', () => {
  assert.match(scene, /const MESH_FABRIC_OPACITY = 0\.48/);
  assert.match(scene, /fabricType === 'mesh' \? MESH_FABRIC_OPACITY : 1/);
});
