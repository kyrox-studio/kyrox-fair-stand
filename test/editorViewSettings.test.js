import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEditorViewSettings } from '../src/editorViewSettings.js';

const mainSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('ölçüler açık başlar; mod değişimi kutunun tercihini değiştirmez', () => {
  const settings = createEditorViewSettings();
  assert.deepEqual(settings.getSnapshot(), { mode: 'simple', measurementsVisible: true });
  assert.equal(settings.setMode('advanced').measurementsVisible, true);
  settings.setMeasurementsVisible(false);
  assert.equal(settings.setMode('simple').measurementsVisible, false);
  assert.equal(settings.setMode('advanced').measurementsVisible, false);
  settings.setMeasurementsVisible(true);
  assert.equal(settings.setMode('simple').measurementsVisible, true);
});

test('tercihler snapshot veya başka editör üzerinden değiştirilemez; yeni oturum varsayılan başlar', () => {
  const first = createEditorViewSettings();
  first.setMode('advanced');
  first.setMeasurementsVisible(false);
  first.getSnapshot().measurementsVisible = true;
  assert.equal(first.getSnapshot().measurementsVisible, false);
  const second = createEditorViewSettings();
  assert.equal(second.setMode('advanced').measurementsVisible, true);
  assert.throws(() => second.setMode('unknown'), TypeError);
  assert.equal(second.getSnapshot().mode, 'advanced');
});

test('kutu sahneye ve sayfa açılışına uygulanır', () => {
  assert.match(mainSource, /showMeasurementsInput\?\.addEventListener\('change', \(\) => \{\s*editorViewSettings\.setMeasurementsVisible\(showMeasurementsInput\.checked\);\s*applyEditorView\(\);/);
  const apply = mainSource.slice(mainSource.indexOf('function applyEditorView'), mainSource.indexOf('function setEditorMode'));
  assert.match(apply, /showMeasurementsInput\.checked = visible/);
  assert.match(apply, /scene3d\.setMeasurementsVisible\(visible\)/);
  assert.match(mainSource, /\napplyEditorView\(\);\r?\n/);
});
