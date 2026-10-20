import test from 'node:test';
import assert from 'node:assert/strict';

import { bindProjectActionSaveGuard } from '../src/projectActionSaveGuard.js';

function createHarness({
  flush = async () => true,
  enabled = true,
  stageVisible = true,
  autoSaveOff = false,
  unsaved = false,
  confirm = () => true,
} = {}) {
  const listeners = new Map();
  const status = { textContent: '' };
  const projectSelect = {
    id: 'project-select',
    value: 'project-b',
    options: [{ value: 'project-a' }, { value: 'project-b' }],
    dispatchedChanges: 0,
    dispatchEvent() {
      this.dispatchedChanges += 1;
      return true;
    },
  };
  const viewportEmpty = { hidden: stageVisible };
  const documentRef = {
    defaultView: { confirm },
    addEventListener(type, handler) { listeners.set(type, handler); },
    removeEventListener(type) { listeners.delete(type); },
    querySelector(selector) {
      if (selector === '#project-status') return status;
      if (selector === '#project-select') return projectSelect;
      if (selector === '#viewport-empty') return viewportEmpty;
      return null;
    },
  };
  const controller = {
    isEnabled: () => enabled,
    isAutoSaveOff: () => autoSaveOff,
    hasUnsavedChanges: () => unsaved,
    flush,
  };
  const cleanup = bindProjectActionSaveGuard({
    documentRef,
    getController: () => controller,
  });
  return { listeners, status, projectSelect, cleanup };
}

function createButton(id, onClick = () => {}) {
  return {
    id,
    closest: () => null,
    click: onClick,
  };
}

function createGuardEvent(target) {
  target.closest = () => target;
  return {
    target,
    prevented: false,
    stopped: false,
    preventDefault() { this.prevented = true; },
    stopImmediatePropagation() { this.stopped = true; },
  };
}

test('open/export/create actions flush the active project before resuming the requested click', async () => {
  for (const buttonId of ['open-project', 'export-project', 'create-stage']) {
    const order = [];
    const harness = createHarness({
      flush: async () => { order.push('save'); },
    });
    const button = createButton(buttonId, () => order.push('action'));
    const event = createGuardEvent(button);

    await harness.listeners.get('click')(event);

    assert.deepEqual(order, ['save', 'action'], buttonId);
    assert.equal(event.prevented, true, buttonId);
    assert.equal(event.stopped, true, buttonId);
    harness.cleanup();
  }
});

test('failed preflight save aborts the guarded project action', async () => {
  const harness = createHarness({
    flush: async () => { throw new Error('storage failed'); },
  });
  let actionCount = 0;
  const button = createButton('open-project', () => { actionCount += 1; });

  await harness.listeners.get('click')(createGuardEvent(button));

  assert.equal(actionCount, 0);
  assert.equal(harness.status.textContent, 'Mevcut proje kaydedilemedi. Proje açma iptal edildi.');
  harness.cleanup();
});

test('project dropdown preserves the requested project across the save refresh and switches only after save', async () => {
  const order = [];
  let harness;
  harness = createHarness({
    flush: async () => {
      order.push('save');
      harness.projectSelect.value = 'project-a';
    },
  });
  harness.projectSelect.dispatchEvent = () => {
    order.push(`switch:${harness.projectSelect.value}`);
    harness.projectSelect.dispatchedChanges += 1;
    return true;
  };
  const event = createGuardEvent(harness.projectSelect);

  await harness.listeners.get('change')(event);

  assert.deepEqual(order, ['save', 'switch:project-b']);
  assert.equal(harness.projectSelect.value, 'project-b');
  assert.equal(harness.projectSelect.dispatchedChanges, 1);
  harness.cleanup();
});

test('import keeps the native picker click synchronous but blocks archive processing until save completes', async () => {
  let releaseSave;
  const savePromise = new Promise((resolve) => { releaseSave = resolve; });
  const order = [];
  const harness = createHarness({
    flush: async () => {
      order.push('save-start');
      await savePromise;
      order.push('save-done');
    },
  });
  const importButton = createButton('import-project');
  const clickEvent = createGuardEvent(importButton);

  await harness.listeners.get('click')(clickEvent);
  assert.equal(clickEvent.prevented, false);
  assert.deepEqual(order, ['save-start']);

  const fileInput = {
    id: 'import-project-file',
    files: [{ name: 'project.zip' }],
    value: 'project.zip',
    dispatchedChanges: 0,
    dispatchEvent() {
      this.dispatchedChanges += 1;
      order.push('import');
      return true;
    },
  };
  const changeEvent = createGuardEvent(fileInput);
  const changePromise = harness.listeners.get('change')(changeEvent);
  await Promise.resolve();
  assert.equal(fileInput.dispatchedChanges, 0);

  releaseSave();
  await changePromise;

  assert.deepEqual(order, ['save-start', 'save-done', 'import']);
  assert.equal(fileInput.dispatchedChanges, 1);
  harness.cleanup();
});

// Otomatik kayıt kapalıyken yalnız Kaydet kaydeder: proje işlemi kaydetmez, kaydedilmemiş değişiklik varsa sorar.
test('with autosave off, guarded actions never save and ask before dropping unsaved changes', async () => {
  for (const buttonId of ['open-project', 'export-project', 'create-stage']) {
    const order = [];
    const messages = [];
    let answer = false;
    const harness = createHarness({
      autoSaveOff: true,
      unsaved: true,
      flush: async () => { order.push('save'); },
      confirm: (message) => { messages.push(message); return answer; },
    });
    const button = createButton(buttonId, () => order.push('action'));
    await harness.listeners.get('click')(createGuardEvent(button));
    assert.deepEqual(order, [], buttonId);
    answer = true;
    await harness.listeners.get('click')(createGuardEvent(button));
    assert.deepEqual(order, ['action'], buttonId);
    assert.equal(messages.length, 2, buttonId);
    const expected = buttonId === 'export-project' ? /son kaydı aktarılır/ : /Kaydedilmemiş değişiklikler kaybolacak/;
    assert.match(messages[0], expected, buttonId);
    harness.cleanup();
  }
});

test('with autosave off and nothing unsaved, guarded actions run without asking or saving', async () => {
  const order = [];
  const harness = createHarness({
    autoSaveOff: true,
    unsaved: false,
    flush: async () => { order.push('save'); },
    confirm: () => { order.push('confirm'); return false; },
  });
  await harness.listeners.get('click')(createGuardEvent(createButton('open-project', () => order.push('action'))));
  assert.deepEqual(order, ['action']);
  harness.cleanup();
});
