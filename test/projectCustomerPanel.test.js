import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FAIR_STAND_MARKUP } from '../src/configuratorMarkup.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('the open project panel shows the customer name and hides the saved-project list', () => {
  for (const source of [html, FAIR_STAND_MARKUP]) {
    assert.match(source, /<strong>Müşteri adı<\/strong>/);
    assert.match(source, /id="project-customer-display"/);
    assert.match(source, /id="project-select" hidden/);
    assert.match(source, /for="project-select" hidden/);
    const customerAt = source.indexOf('id="project-customer-display"');
    const projectAt = source.indexOf('id="project-name-display"');
    assert.ok(customerAt > 0 && projectAt > customerAt);
  }
  assert.match(main, /loadCustomerDisplayName\(activeCustomerId\)/);
  assert.match(main, /NO_CUSTOMER_LABEL = 'Müşteri Yok'/);
  for (const source of [html, FAIR_STAND_MARKUP]) {
    assert.match(source, /id="project-customer-display"[^>]*>Müşteri Yok<\/strong>/);
    assert.doesNotMatch(source, /Geçici bağ/);
  }
  for (const source of [html, FAIR_STAND_MARKUP]) {
    assert.match(source, /id="save-project"[^>]*disabled/);
    assert.match(source, /id="save-as-project"[^>]*disabled/);
  }
  assert.match(main, /const sceneReady = Boolean\(currentStand\)/);
  assert.match(main, /setSaveProjectEnabled\(saveProjectButton, sceneReady\)/);
  assert.match(main, /setSaveProjectEnabled\(saveAsProjectButton, sceneReady\)/);
});
