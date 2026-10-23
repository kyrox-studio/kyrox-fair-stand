import test from 'node:test';
import assert from 'node:assert/strict';
import { metersInputToCm, formatMeters, validateStandSetupMeters } from '../src/standSizeInput.js';

test('sihirbaz virgüllü ve noktalı metreyi canonical santimetreye çevirir', () => {
  for (const value of ['4,5', '4.5', ' 4,5 ']) assert.equal(metersInputToCm(value), 450);
  assert.equal(metersInputToCm('6,5'), 650);
  assert.equal(metersInputToCm('0,5'), 50);
  assert.equal(metersInputToCm(''), null);
  assert.equal(metersInputToCm('0'), 0);
  assert.ok(Number.isNaN(metersInputToCm('yanlış')));
});

test('sihirbaz özeti santimetreyi Türkçe metre gösterimine çevirir', () => {
  assert.equal(formatMeters(450), '4,5');
  assert.equal(formatMeters(650), '6,5');
  assert.equal(formatMeters(300), '3');
});

test('metre girişinin doğrulanması canonical santimetre kaydını korur', () => {
  const result = validateStandSetupMeters({ standType: 'island', width: '6,5', depth: '4,5' });
  assert.equal(result.ok, true);
  assert.equal(result.xCm, 650);
  assert.equal(result.yCm, 450);
  assert.equal(formatMeters(result.xCm), '6,5');
  for (const width of ['', '0', '4,6', '51', 'yanlış']) {
    const invalid = validateStandSetupMeters({ standType: 'island', width, depth: '4,5' });
    assert.equal(invalid.ok, false);
    assert.match(invalid.message, /0,5 m/);
  }
});
