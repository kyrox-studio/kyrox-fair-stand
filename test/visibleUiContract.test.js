import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MODULE_WIDTHS_CM, STAND_DIMENSIONS } from '../src/standDimensions.js';
import { SCENE_SURROUND_M } from '../src/sceneDimensions.js';
import { MAX_STAND_DIMENSION_CM } from '../src/standSetup.js';
import { DEFAULT_SELECTION_HINT } from '../src/selectionFeedback.js';
import { getHelpStandardsTableHtml, getStandStandardsFacts, getStandStandardsListItems } from '../src/standStandardsCopy.js';

test('standart metin STAND_DIMENSIONS ve standSetup sabitlerinden üretilir', () => {
  const facts = getStandStandardsFacts();
  assert.equal(facts.heightCm, Math.round(STAND_DIMENSIONS.heightCm));
  assert.equal(facts.depthCm, Math.round(STAND_DIMENSIONS.depthCm));
  assert.equal(facts.stripHeightCm, 50);
  assert.equal(facts.stripCount, Math.floor(STAND_DIMENSIONS.heightCm / 50));
  assert.equal(facts.surroundCm, Math.round(SCENE_SURROUND_M * 100));
  assert.equal(facts.maxStandCm, MAX_STAND_DIMENSION_CM);
  assert.equal(facts.widths, MODULE_WIDTHS_CM.join(' / '));
  assert.match(getStandStandardsListItems()[0], new RegExp(`Yükseklik: ${facts.heightCm} cm`));
  assert.match(getHelpStandardsTableHtml(), new RegExp(`Sistem yüksekliği</th><td>${facts.heightCm} cm`));
});

test('index.html seçim hint kanonik DEFAULT_SELECTION_HINT ile aynıdır', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, new RegExp(`id="selection-info"[^>]*>${DEFAULT_SELECTION_HINT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
});

test('ışıklı strafor ölçü penceresi dialog semantiği ve Escape taşır', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /aria-labelledby', 'foam-size-title'/);
  assert.match(main, /setAttribute\('role', 'dialog'\)/);
  assert.match(main, /event\.key !== 'Escape'/);
});

test('üretim listesi toolbar butonu ile açılır; sahne oluşturunca otomatik açılmaz', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const markup = readFileSync(new URL('../src/configuratorMarkup.js', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /rawBomDebug\.js/);
  assert.doesNotMatch(main, /rawBomDebug/);
  assert.match(main, /createProductionBomPanel/);
  assert.match(markup, /toggle-production-bom/);
  assert.match(main, /toggleProductionBomButton/);
});

test('sahnede stand özeti etiketi: index.html ile CRM işaretlemesi aynı, main özetini yazar', async () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const { FAIR_STAND_MARKUP } = await import('../src/configuratorMarkup.js');
  const chip = '<div id="stand-summary-chip" class="stand-summary-chip" hidden aria-live="polite"></div>';
  assert.ok(html.includes(`<div id="viewport"></div>${chip}`));
  assert.ok(FAIR_STAND_MARKUP.includes(`<div id="viewport"></div>${chip}`));
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /standSummaryChip\.textContent = `\$\{label\} · \$\{formatMeters\(setup\.xCm\)\} × \$\{formatMeters\(setup\.yCm\)\} m · duvar \$\{formatMeters\(activeWallHeightCm\(\)\)\} m`;/);
  assert.match(main, /renderStandSummaryChip\(null\);/);
});
