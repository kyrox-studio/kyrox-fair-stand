import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('F-028 feature reset removes illuminated foam and resets remaining modules', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const start = main.indexOf("resetModuleFeaturesButton.addEventListener('click'");
  const end = main.indexOf('function applyActiveColorToSelection', start);
  assert.ok(start >= 0 && end > start, 'feature reset handler must exist');

  const handler = main.slice(start, end);
  assert.match(handler, /module\?\.type === 'illuminated-foam'/);
  assert.match(handler, /module\?\.type !== 'illuminated-foam'/);
  assert.match(handler, /resetCandidates\.map\(\(module\) => createCatalogModuleState/);
  assert.match(handler, /\{ preservePlacement: true \}/);
  assert.match(handler, /selectedFoamModuleId = null/);
  assert.match(handler, /foamLightControls\) foamLightControls\.hidden = true/);
  assert.match(handler, /Işıklı Strafor sahneden silinecek/);
  assert.match(handler, /Işıklı Strafor sahneden silindi/);
});

test('F-028 feature reset keeps locks and never deletes a locked illuminated foam', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const start = main.indexOf("resetModuleFeaturesButton.addEventListener('click'");
  const end = main.indexOf('function applyActiveColorToSelection', start);
  const handler = main.slice(start, end);
  assert.match(handler, /module\?\.type === 'illuminated-foam' && !isModuleLocked\(module\)/);
  // Own lock stays an own lock; group membership (and group lock) is carried over unchanged.
  assert.match(handler, /if \(module\.locked === true\) resetModules\[index\]\.locked = true;/);
  assert.match(handler, /if \(module\.group\) resetModules\[index\]\.group = \{ \.\.\.module\.group \};/);
  assert.match(handler, /\(isModuleLocked\(module\) \? module : null\)/);
});
