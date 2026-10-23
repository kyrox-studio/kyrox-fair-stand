import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorViewSettings } from '../src/editorViewSettings.js';

test('modlar kendi varsayılanlarını kullanır ve kullanıcının kapalı tercihini korur', () => {
  const settings = createEditorViewSettings();
  assert.deepEqual(settings.getSnapshot(), { mode: 'simple', measurementsVisible: false });
  assert.equal(settings.setMode('advanced').measurementsVisible, true);
  settings.setMeasurementsVisible(false);
  settings.setMode('simple');
  settings.setMeasurementsVisible(true);
  assert.equal(settings.setMode('advanced').measurementsVisible, false);
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
