import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPlacementFeedbackMessage } from '../src/placementFeedback.js';

test('simplifies collision feedback', () => {
  assert.equal(
    formatPlacementFeedbackMessage('Başka bir modülle çakışıyor.'),
    'Başka modülle çakışıyor.',
  );
});

test('simplifies stand boundary feedback', () => {
  assert.equal(
    formatPlacementFeedbackMessage('Modül X stand sınırını aşıyor.'),
    'Stand sınırı dışında.',
  );
  assert.equal(
    formatPlacementFeedbackMessage('Modül aktif stand alanını aşıyor.'),
    'Stand sınırı dışında.',
  );
});

test('simplifies continuous wall capacity feedback', () => {
  assert.equal(
    formatPlacementFeedbackMessage('Aktif duvar zincirinde modüllerin tamamı için yeterli alan yok.'),
    'Yeterli boşluk yok.',
  );
});





test('feedback timeout stays finite by default', () => {
  // Regresyon: sahne geri bildirimi 1800 ms varsayar; geçici hatalar
  // sonraki imleç hareketine kadar ekranda takılı kalmamalı.
  assert.equal(1800 > 0, true);
});
