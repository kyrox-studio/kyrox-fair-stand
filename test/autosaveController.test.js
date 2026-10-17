import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_AUTOSAVE_DELAY_MS,
  DEFAULT_AUTOSAVE_MAX_WAIT_MS,
  DEFAULT_AUTOSAVE_WATCH_INTERVAL_MS,
  createAutosaveController,
  getActiveAutosaveController,
} from '../src/autosaveController.js';

function createFakeClock() {
  let nextId = 1;
  const timeouts = new Map();
  const intervals = new Map();
  const clearedTimeouts = [];
  const clearedIntervals = [];

  return {
    setTimeoutFn(callback, delay) {
      const id = nextId++;
      timeouts.set(id, { callback, delay });
      return id;
    },
    clearTimeoutFn(id) {
      clearedTimeouts.push(id);
      timeouts.delete(id);
    },
    setIntervalFn(callback, delay) {
      const id = nextId++;
      intervals.set(id, { callback, delay });
      return id;
    },
    clearIntervalFn(id) {
      clearedIntervals.push(id);
      intervals.delete(id);
    },
    timeouts,
    intervals,
    clearedTimeouts,
    clearedIntervals,
  };
}

test('autosave constants use the 3 minute default, 3 minute max wait, and 1s watch', () => {
  assert.equal(DEFAULT_AUTOSAVE_DELAY_MS, 180000);
  assert.equal(DEFAULT_AUTOSAVE_MAX_WAIT_MS, 180000);
  assert.equal(DEFAULT_AUTOSAVE_WATCH_INTERVAL_MS, 1000);
});

test('enable captures current signature and starts exactly one watcher', () => {
  const clock = createFakeClock();
  let signature = 'initial';
  const controller = createAutosaveController({
    getSignature: () => signature,
    persist: async () => {},
    ...clock,
  });

  controller.enableFromCurrentState();
  controller.enableFromCurrentState();

  assert.equal(controller.isEnabled(), true);
  assert.equal(clock.intervals.size, 1);
  assert.equal([...clock.intervals.values()][0].delay, 1000);
  signature = 'changed';
  assert.equal(controller.checkForChanges(), true);
  assert.equal(clock.timeouts.size, 1);
});

test('unchanged state does not schedule autosave', () => {
  const clock = createFakeClock();
  const controller = createAutosaveController({
    getSignature: () => 'same',
    persist: async () => {},
    ...clock,
  });

  controller.enableFromCurrentState();

  assert.equal(controller.checkForChanges(), false);
  assert.equal(clock.timeouts.size, 0);
});

test('changed state schedules one debounce and a later change replaces it', () => {
  const clock = createFakeClock();
  const statuses = [];
  let signature = 'a';
  const controller = createAutosaveController({
    getSignature: () => signature,
    persist: async () => {},
    setStatus: (value) => statuses.push(value),
    ...clock,
  });

  controller.enableFromCurrentState();
  signature = 'b';
  controller.checkForChanges();
  const firstTimerId = [...clock.timeouts.keys()][0];

  signature = 'c';
  controller.checkForChanges();
  const secondTimerId = [...clock.timeouts.keys()][0];

  assert.notEqual(firstTimerId, secondTimerId);
  assert.deepEqual(clock.clearedTimeouts, [firstTimerId]);
  assert.equal(clock.timeouts.size, 1);
  assert.equal([...clock.timeouts.values()][0].delay, 180000);
  assert.equal(statuses.at(-1), 'Değişiklik var · 3 dk içinde otomatik kaydedilecek…');
});

test('scheduled persist uses quiet mode and marks the persisted signature as observed', async () => {
  const clock = createFakeClock();
  const statuses = [];
  const persistCalls = [];
  let signature = 'a';
  const controller = createAutosaveController({
    getSignature: () => signature,
    persist: async (options) => { persistCalls.push(options); },
    setStatus: (value) => statuses.push(value),
    ...clock,
  });

  controller.enableFromCurrentState();
  signature = 'b';
  controller.checkForChanges();

  const timeout = [...clock.timeouts.values()][0];
  await timeout.callback();

  assert.deepEqual(persistCalls, [{ quiet: true }]);
  assert.deepEqual(statuses.slice(-2), ['Kaydediliyor…', 'Kaydedildi · Otomatik']);
  assert.equal(controller.checkForChanges(), false);
});

test('persist failure reports error and preserves enabled state', async () => {
  const clock = createFakeClock();
  const errors = [];
  const statuses = [];
  let signature = 'a';
  const failure = new Error('storage failed');
  const controller = createAutosaveController({
    getSignature: () => signature,
    persist: async () => { throw failure; },
    setStatus: (value) => statuses.push(value),
    onError: (error) => errors.push(error),
    ...clock,
  });

  controller.enableFromCurrentState();
  signature = 'b';
  controller.checkForChanges();
  const timeout = [...clock.timeouts.values()][0];
  await timeout.callback();

  assert.equal(controller.isEnabled(), true);
  assert.deepEqual(errors, [failure]);
  assert.equal(statuses.at(-1), 'Otomatik kayıt başarısız.');
});

test('disable cancels pending debounce and watcher without persisting', async () => {
  const clock = createFakeClock();
  let signature = 'a';
  let persistCount = 0;
  const controller = createAutosaveController({
    getSignature: () => signature,
    persist: async () => { persistCount += 1; },
    ...clock,
  });

  controller.enableFromCurrentState();
  const watcherId = [...clock.intervals.keys()][0];
  signature = 'b';
  controller.checkForChanges();
  const timeoutId = [...clock.timeouts.keys()][0];
  const pendingCallback = clock.timeouts.get(timeoutId).callback;

  controller.disable();
  await pendingCallback();

  assert.equal(controller.isEnabled(), false);
  assert.equal(persistCount, 0);
  assert.deepEqual(clock.clearedTimeouts, [timeoutId]);
  assert.deepEqual(clock.clearedIntervals, [watcherId]);
  assert.equal(clock.timeouts.size, 0);
  assert.equal(clock.intervals.size, 0);
});

test('markSavedState cancels pending debounce and re-baselines the current signature', () => {
  const clock = createFakeClock();
  let signature = 'a';
  const controller = createAutosaveController({
    getSignature: () => signature,
    persist: async () => {},
    ...clock,
  });

  controller.enableFromCurrentState();
  signature = 'b';
  controller.checkForChanges();
  const timeoutId = [...clock.timeouts.keys()][0];

  controller.markSavedState();

  assert.deepEqual(clock.clearedTimeouts, [timeoutId]);
  assert.equal(clock.timeouts.size, 0);
  assert.equal(controller.checkForChanges(), false);
});

test('flush cancels pending debounce, persists immediately, and re-baselines current state', async () => {
  const clock = createFakeClock();
  const persistCalls = [];
  let signature = 'a';
  const controller = createAutosaveController({
    getSignature: () => signature,
    persist: async (options) => { persistCalls.push(options); },
    ...clock,
  });

  controller.enableFromCurrentState();
  signature = 'b';
  controller.checkForChanges();
  const timeoutId = [...clock.timeouts.keys()][0];

  await controller.flush({ quiet: true });

  assert.deepEqual(persistCalls, [{ quiet: true }]);
  assert.deepEqual(clock.clearedTimeouts, [timeoutId]);
  assert.equal(clock.timeouts.size, 0);
  assert.equal(controller.isEnabled(), true);
  assert.equal(controller.checkForChanges(), false);
});

test('active controller registry exposes the controller used by project action guards', () => {
  const clock = createFakeClock();
  const controller = createAutosaveController({
    getSignature: () => 'current',
    persist: async () => {},
    ...clock,
  });

  assert.equal(getActiveAutosaveController(), controller);
});

function scheduledDelay(clock) {
  assert.equal(clock.timeouts.size, 1);
  return [...clock.timeouts.values()][0].delay;
}

test('edits at 0s, 10s, and 20s autosave 30s after the last edit', () => {
  let nowMs = 0;
  let signature = 'saved';
  const clock = createFakeClock();
  const controller = createAutosaveController({
    getSignature: () => signature,
    persist: async () => {},
    now: () => nowMs,
    delayMs: 30000,
    maxWaitMs: 60000,
    ...clock,
  });
  controller.enableFromCurrentState();

  signature = 'move-0';
  controller.checkForChanges();
  assert.equal(scheduledDelay(clock), 30000);

  nowMs = 10000;
  signature = 'move-10';
  controller.checkForChanges();
  assert.equal(scheduledDelay(clock), 30000);

  nowMs = 20000;
  signature = 'move-20';
  controller.checkForChanges();
  assert.equal(scheduledDelay(clock), 30000);
});

test('continuous edits autosave when the 60s max wait arrives, then open a new window', async () => {
  let nowMs = 0;
  let signature = 'saved';
  let persistCount = 0;
  const clock = createFakeClock();
  const controller = createAutosaveController({
    getSignature: () => signature,
    persist: async () => { persistCount += 1; },
    now: () => nowMs,
    delayMs: 30000,
    maxWaitMs: 60000,
    ...clock,
  });
  controller.enableFromCurrentState();

  for (const at of [0, 10000, 20000, 30000, 40000, 50000]) {
    nowMs = at;
    signature = `edit-${at}`;
    controller.checkForChanges();
  }

  assert.equal(scheduledDelay(clock), 10000);
  assert.equal(persistCount, 0);
  const [timerId, timer] = [...clock.timeouts.entries()][0];
  clock.timeouts.delete(timerId);
  await timer.callback();
  assert.equal(persistCount, 1);
  assert.equal(clock.timeouts.size, 0);

  nowMs = 60000;
  signature = 'edit-after-save';
  controller.checkForChanges();
  assert.equal(scheduledDelay(clock), 30000);
});

test('a manual save clears the max-wait window', () => {
  let nowMs = 0;
  let signature = 'saved';
  const clock = createFakeClock();
  const controller = createAutosaveController({
    getSignature: () => signature,
    persist: async () => {},
    now: () => nowMs,
    delayMs: 30000,
    maxWaitMs: 60000,
    ...clock,
  });
  controller.enableFromCurrentState();
  signature = 'dirty';
  controller.checkForChanges();

  nowMs = 55000;
  controller.markSavedState();
  signature = 'again';
  controller.checkForChanges();

  assert.equal(scheduledDelay(clock), 30000);
});

test('setDelayMinutes(0) keeps watching but never schedules a timer', () => {
  const clock = createFakeClock();
  const statuses = [];
  let signature = 'saved';
  const controller = createAutosaveController({
    getSignature: () => signature,
    persist: async () => {},
    setStatus: (value) => statuses.push(value),
    ...clock,
  });
  controller.enableFromCurrentState();
  controller.setDelayMinutes(0);

  signature = 'dirty';
  assert.equal(controller.checkForChanges(), true);

  assert.equal(controller.isEnabled(), true);
  assert.equal(clock.intervals.size, 1);
  assert.equal(clock.timeouts.size, 0);
  assert.equal(controller.getDelayMinutes(), 0);
  assert.equal(controller.hasUnsavedChanges(), true);
  assert.equal(statuses.at(-1), 'Kaydedilmemiş değişiklik var · otomatik kayıt kapalı');
});

test('setDelayMinutes changes debounce and max wait, and reschedules pending changes', () => {
  const clock = createFakeClock();
  const statuses = [];
  let signature = 'saved';
  const controller = createAutosaveController({
    getSignature: () => signature,
    persist: async () => {},
    setStatus: (value) => statuses.push(value),
    ...clock,
  });
  controller.enableFromCurrentState();
  controller.setDelayMinutes(0);
  signature = 'dirty';
  controller.checkForChanges();
  assert.equal(clock.timeouts.size, 0);

  controller.setDelayMinutes(7);

  assert.equal(scheduledDelay(clock), 420000);
  assert.equal(statuses.at(-1), 'Değişiklik var · 7 dk içinde otomatik kaydedilecek…');
});

test('setDelayMinutes rejects negative and non-numeric values', () => {
  const controller = createAutosaveController({
    getSignature: () => 'x',
    persist: async () => {},
    ...createFakeClock(),
  });
  assert.throws(() => controller.setDelayMinutes(-1), RangeError);
  assert.throws(() => controller.setDelayMinutes('abc'), RangeError);
});

test('hasUnsavedChanges is false before first save and after scheduled autosave', async () => {
  const clock = createFakeClock();
  let signature = 'a';
  const controller = createAutosaveController({
    getSignature: () => signature,
    persist: async () => {},
    ...clock,
  });
  signature = 'b';
  assert.equal(controller.hasUnsavedChanges(), false);

  controller.enableFromCurrentState();
  signature = 'c';
  controller.checkForChanges();
  assert.equal(controller.hasUnsavedChanges(), true);

  await [...clock.timeouts.values()][0].callback();
  assert.equal(controller.hasUnsavedChanges(), false);
});

test('saveNowIfDirty persists unsaved changes even when autosave is off', async () => {
  const clock = createFakeClock();
  const persistCalls = [];
  let signature = 'saved';
  const controller = createAutosaveController({
    getSignature: () => signature,
    persist: async (options) => { persistCalls.push(options); },
    ...clock,
  });
  controller.enableFromCurrentState();
  controller.setDelayMinutes(0);

  assert.equal(await controller.saveNowIfDirty(), false);
  assert.deepEqual(persistCalls, []);

  signature = 'dirty';
  controller.checkForChanges();
  assert.equal(await controller.saveNowIfDirty(), true);

  assert.deepEqual(persistCalls, [{ quiet: true }]);
  assert.equal(controller.hasUnsavedChanges(), false);
  assert.equal(controller.isEnabled(), true);
});

test('saveNowIfDirty does nothing for a project that was never saved', async () => {
  let persistCount = 0;
  const controller = createAutosaveController({
    getSignature: () => 'unsaved-project',
    persist: async () => { persistCount += 1; },
    ...createFakeClock(),
  });
  assert.equal(await controller.saveNowIfDirty(), false);
  assert.equal(persistCount, 0);
});

test('saveNowIfDirty reports failures and keeps changes unsaved', async () => {
  const errors = [];
  const statuses = [];
  let signature = 'saved';
  const failure = new Error('offline');
  const controller = createAutosaveController({
    getSignature: () => signature,
    persist: async () => { throw failure; },
    setStatus: (value) => statuses.push(value),
    onError: (error) => errors.push(error),
    ...createFakeClock(),
  });
  controller.enableFromCurrentState();
  signature = 'dirty';

  assert.equal(await controller.saveNowIfDirty(), false);
  assert.deepEqual(errors, [failure]);
  assert.equal(statuses.at(-1), 'Otomatik kayıt başarısız.');
  assert.equal(controller.hasUnsavedChanges(), true);
});
