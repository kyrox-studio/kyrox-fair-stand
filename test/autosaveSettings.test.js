import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AUTOSAVE_MINUTE_OPTIONS,
  AUTOSAVE_MINUTES_STORAGE_KEY,
  DEFAULT_AUTOSAVE_MINUTES,
  normalizeAutosaveMinutes,
  readAutosaveMinutes,
  writeAutosaveMinutes,
} from '../src/autosaveSettings.js';

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    values,
  };
}

test('autosave options are off, 3, 5, 7, 10 minutes with 3 as default', () => {
  assert.deepEqual([...AUTOSAVE_MINUTE_OPTIONS], [0, 3, 5, 7, 10]);
  assert.equal(DEFAULT_AUTOSAVE_MINUTES, 3);
  assert.equal(AUTOSAVE_MINUTES_STORAGE_KEY, 'fairStand.autosaveMinutes');
});

test('normalize accepts only listed options and falls back to the default', () => {
  assert.equal(normalizeAutosaveMinutes('0'), 0);
  assert.equal(normalizeAutosaveMinutes(7), 7);
  for (const bad of [null, undefined, '', '1', '30', 'abc', -3]) {
    assert.equal(normalizeAutosaveMinutes(bad), 3, String(bad));
  }
});

test('read returns the default when nothing is stored', () => {
  assert.equal(readAutosaveMinutes(createStorage()), 3);
});

test('write stores the choice and read returns it, including off', () => {
  const storage = createStorage();
  assert.equal(writeAutosaveMinutes('0', storage), 0);
  assert.equal(storage.values.get(AUTOSAVE_MINUTES_STORAGE_KEY), '0');
  assert.equal(readAutosaveMinutes(storage), 0);
  writeAutosaveMinutes(10, storage);
  assert.equal(readAutosaveMinutes(storage), 10);
});

test('invalid stored value reads as the default', () => {
  assert.equal(readAutosaveMinutes(createStorage({ [AUTOSAVE_MINUTES_STORAGE_KEY]: '42' })), 3);
});

test('blocked storage does not throw', () => {
  const blocked = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
  };
  assert.equal(readAutosaveMinutes(blocked), 3);
  assert.equal(writeAutosaveMinutes(5, blocked), 5);
  assert.equal(readAutosaveMinutes(null), 3);
});
