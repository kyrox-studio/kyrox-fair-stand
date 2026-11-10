import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { computePropertyPanelTop } from '../src/propertyPanelPlacement.js';

const rect = (left, top, right, bottom) => ({ left, top, right, bottom, width: right - left, height: bottom - top });
const wrap = rect(290, 0, 768, 1024);

test('panel üst kenarı iki sıraya kırılan üst çubuğun ve sağ üstteki küpün altına oturur', () => {
  const toolbar = rect(340, 12, 632, 154);
  const cube = rect(648, 12, 756, 209);
  assert.equal(computePropertyPanelTop(wrap, [toolbar, cube]), 221);
});

test('sol alttaki küp ve panel şeridine değmeyen öğe sayılmaz', () => {
  const toolbar = rect(800, 12, 1500, 80);
  const desktop = rect(280, 0, 1512, 900);
  const cubeBottomLeft = rect(292, 700, 400, 840);
  const leftChip = rect(300, 12, 500, 300);
  assert.equal(computePropertyPanelTop(desktop, [toolbar, cubeBottomLeft, leftChip]), 92);
});

test('gizli (boyutsuz) üst çubukta panel üstten 12px başlar', () => {
  assert.equal(computePropertyPanelTop(wrap, [rect(0, 0, 0, 0)]), 12);
});

test('CSS panel konumunu her ekranda değişkenden alır, alt şerit kuralı yok', () => {
  const css = fs.readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(css, /top: var\(--property-panel-top, 104px\);/);
  assert.match(css, /max-height: calc\(100% - var\(--property-panel-top, 104px\) - 12px\);/);
  assert.doesNotMatch(css, /max-height: 48%;/);
});
