import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const mainSource = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');

test('main.js delegates autosave lifecycle to autosaveController', () => {
  assert.match(mainSource, /import \{ createAutosaveController \} from '\.\/autosaveController\.js';/);
  assert.equal((mainSource.match(/createAutosaveController\(\{/g) || []).length, 1);
  assert.match(mainSource, /getSignature: getProjectStateSignature/);
  assert.match(mainSource, /persist: persistActiveProject/);
  assert.match(mainSource, /autosaveController\.enableFromCurrentState\(\)/);
  assert.match(mainSource, /autosaveController\.disable\(\)/);
  assert.match(mainSource, /autosaveController\.clearPending\(\)/);
  assert.match(mainSource, /autosaveController\.markSavedState\(\)/);
});

test('legacy autosave globals and duplicate timer loop are absent from main.js', () => {
  for (const token of [
    'autosaveEnabled',
    'autosaveTimer',
    'autosaveObservedSignature',
    'AUTOSAVE_DELAY_MS',
    'AUTOSAVE_WATCH_INTERVAL_MS',
    'clearAutosaveTimer',
    'scheduleAutosave',
    'enableAutosaveFromCurrentState',
    'disableAutosave',
  ]) {
    assert.equal(mainSource.includes(token), false, `${token} should not remain in main.js`);
  }
  assert.equal(mainSource.includes('setInterval(() => {\n  if (!autosave'), false);
});

test('main.js wires the autosave interval select to browser settings', () => {
  assert.match(mainSource, /import \{ readAutosaveMinutes, writeAutosaveMinutes \} from '\.\/autosaveSettings\.js';/);
  assert.match(mainSource, /document\.querySelector\('#autosave-interval'\)/);
  assert.match(mainSource, /applyAutosaveInterval\(readAutosaveMinutes\(\)\)/);
  assert.match(mainSource, /writeAutosaveMinutes\(autosaveIntervalSelect\.value\)/);
  assert.match(mainSource, /autosaveController\.setDelayMinutes\(minutes\)/);
});

test('main.js warns before unload only for unsaved changes and saves on hide and unmount', () => {
  assert.match(mainSource, /window\.addEventListener\('beforeunload', onBeforeUnloadWarnUnsaved\)/);
  assert.match(mainSource, /if \(!autosaveController\.hasUnsavedChanges\(\)\) return;/);
  assert.match(mainSource, /window\.addEventListener\('pagehide', onPageHide\)/);
  assert.match(mainSource, /document\.addEventListener\('visibilitychange', onVisibilityChangeSave\)/);
  assert.match(mainSource, /void autosaveController\.saveNowIfDirty\(\)/);
  const stop = mainSource.slice(mainSource.indexOf('return function stopFairStandConfigurator'));
  assert.ok(stop.indexOf('saveNowIfDirty') < stop.indexOf('autosaveController?.disable?.()'));
  assert.match(stop, /removeEventListener\('beforeunload', onBeforeUnloadWarnUnsaved\)/);
  assert.match(stop, /removeEventListener\('visibilitychange', onVisibilityChangeSave\)/);
});

test('autosave interval select exists with the same options in both markups', async () => {
  const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const { FAIR_STAND_MARKUP } = await import('../src/configuratorMarkup.js');
  for (const markup of [indexHtml, FAIR_STAND_MARKUP]) {
    const select = markup.match(/<select id="autosave-interval">([\s\S]*?)<\/select>/);
    assert.ok(select, 'autosave-interval select missing');
    const values = [...select[1].matchAll(/<option value="(\d+)"/g)].map((m) => Number(m[1]));
    assert.deepEqual(values, [0, 3, 5, 7, 10]);
    assert.match(select[1], /<option value="0">Kapalı \(Otomatik Kayıt Kapalı\)<\/option>/);
    assert.match(select[1], /<option value="3" selected>3 dk<\/option>/);
  }
});
