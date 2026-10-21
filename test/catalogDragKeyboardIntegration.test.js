import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/moduleDragSidebar.js', import.meta.url), 'utf8');

test('catalog drag uses only Shift+R and advances clockwise without validity gating', () => {
  assert.match(source, /String\(event\.key\)\.toLowerCase\(\) === 'r'[\s\S]*event\.shiftKey/);
  assert.match(source, /resolveModuleRotationDeltaDeg\(activeModuleState, -90\)/);
  assert.match(source, /activeRotationZDeg = \(\(activeRotationZDeg \+ deltaDeg\)/);
  assert.match(source, /onPreview\?\.\([\s\S]*activeRotationZDeg,[\s\S]*rotationLocked/);
  assert.doesNotMatch(source, /event\.shiftKey \? -rotationStepDeg : rotationStepDeg/);
  assert.doesNotMatch(source, /R\/Shift\+R: modül standardına göre döndür/);
});

test('catalog drag help text documents Shift+R clockwise rotation', () => {
  assert.match(source, /Shift\+R: saat yönünde döndür/);
});

test('placement Shift+R rotates only the ghost, never the selected scene module', () => {
  // Kopya/katalog yerleştirmede seçili kalan asıl öğe dönmemeli (sahne dinleyicisine ulaşmaz).
  assert.match(source, /event\.preventDefault\(\);\s*\/\/.*\s*event\.stopImmediatePropagation\(\);\s*const deltaDeg = resolveModuleRotationDeltaDeg/);
  assert.match(source, /rotationLocked,\s*\);\s*\}\s*\}, \{ capture: true \}\);\s*function armPlacement/);
});
