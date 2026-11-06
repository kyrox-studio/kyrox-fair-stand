import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inferStatusTone,
  syncSelectionFeedback,
  syncStatusTone,
} from '../src/uiFeedback.js';

function createClassList(initial = []) {
  const values = new Set(initial);
  return {
    contains: (value) => values.has(value),
    add: (...items) => items.forEach((item) => values.add(item)),
    remove: (...items) => items.forEach((item) => values.delete(item)),
    toggle: (item, force) => {
      if (force) values.add(item);
      else values.delete(item);
    },
    values,
  };
}

function createElement(textContent = '', classes = []) {
  return { textContent, classList: createClassList(classes) };
}

test('inferStatusTone preserves explicit error class priority', () => {
  assert.equal(inferStatusTone(createElement('Hazır', ['error'])), 'error');
});

test('inferStatusTone preserves Turkish status keyword mapping', () => {
  assert.equal(inferStatusTone(createElement('Proje kaydedildi.')), 'success');
  assert.equal(inferStatusTone(createElement('Görsel seçilmedi.')), 'warning');
  assert.equal(inferStatusTone(createElement('Dosya yüklenemedi.')), 'error');
  assert.equal(inferStatusTone(createElement('İşlem sürüyor.')), 'info');
});

test('syncStatusTone replaces previous status tone class', () => {
  const element = createElement('Proje hazır.', ['status-warning']);
  syncStatusTone(element);
  assert.equal(element.classList.values.has('status-warning'), false);
  assert.equal(element.classList.values.has('status-success'), true);
});

test('syncSelectionFeedback only marks non-default non-empty feedback', () => {
  const hint = 'Bir panel seç; Ctrl/Cmd + tık ile panelleri çoklu seç.';
  const element = createElement(hint);
  syncSelectionFeedback(element, hint);
  assert.equal(element.classList.values.has('has-selection'), false);

  element.textContent = 'Modül 1 seçildi.';
  syncSelectionFeedback(element, hint);
  assert.equal(element.classList.values.has('has-selection'), true);

  element.textContent = '   ';
  syncSelectionFeedback(element, hint);
  assert.equal(element.classList.values.has('has-selection'), false);
});

test('syncSelectionFeedback hides only messages the panel already shows', () => {
  const hint = 'Bir panel seç; Ctrl/Cmd + tık ile panelleri çoklu seç.';
  const element = createElement('Modül 1 · 200 cm · alttan 3. panel · Ctrl/Cmd + tık ile çoklu seç.');
  syncSelectionFeedback(element, hint);
  assert.equal(element.classList.values.has('is-redundant'), true);

  element.textContent = 'Banko 200 seçildi.';
  syncSelectionFeedback(element, hint);
  assert.equal(element.classList.values.has('is-redundant'), true);

  for (const message of ['Görsel seçili panele uygulandı · Doldur.', 'Görsel uygulamak için önce bir panel veya panel bloğu seç.', 'Modül 2 · 3 Gözlü Vitrin 100 cm · vitrin gövdesi · 4 sunta birlikte renklendirilir.']) {
    element.textContent = message;
    syncSelectionFeedback(element, hint);
    assert.equal(element.classList.values.has('is-redundant'), false, message);
  }
});
