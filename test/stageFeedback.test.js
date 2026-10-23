import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderStageResult,
  renderWallResult,
} from '../src/stageFeedback.js';

function createElement() {
  const classes = new Set();
  return {
    textContent: '',
    classList: {
      toggle(name, force) {
        if (force) classes.add(name);
        else classes.delete(name);
      },
      contains(name) {
        return classes.has(name);
      },
    },
  };
}

test('renderStageResult preserves text and error class behavior', () => {
  const element = createElement();
  renderStageResult(element, 'Hazır');
  assert.equal(element.textContent, 'Hazır');
  assert.equal(element.classList.contains('error'), false);

  renderStageResult(element, 'Hata', true);
  assert.equal(element.textContent, 'Hata');
  assert.equal(element.classList.contains('error'), true);
});

test('renderWallResult only warns for error messages', () => {
  const calls = [];
  renderWallResult('Bilgi', false, (message) => calls.push(message));
  renderWallResult('Sorun', true, (message) => calls.push(message));
  assert.deepEqual(calls, ['Sorun']);
});


test('hata mesajları sağ alt bildirime de gider; bilgi mesajları gitmez', () => {
  const notified = [];
  const notify = (message, options) => notified.push([message, options?.kind]);
  renderWallResult('Bilgi', false, () => {}, notify);
  renderWallResult('Sorun', true, () => {}, notify);
  const element = createElement();
  renderStageResult(element, 'Hazır', false, notify);
  renderStageResult(element, 'Stand hatası', true, notify);
  assert.deepEqual(notified, [['Sorun', 'error'], ['Stand hatası', 'error']]);
});
