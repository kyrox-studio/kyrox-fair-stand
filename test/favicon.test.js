import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Stand simgeleri gerçek SVG ve ICO dosyalarına bağlanır; CRM simgesini ezmez', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<link rel="icon" href="\/stand-favicon\.svg" type="image\/svg\+xml"\s*\/>/);
  assert.match(html, /<link rel="icon" href="\/stand-favicon\.ico" sizes="any"\s*\/>/);
  const svg = readFileSync(new URL('../public/stand-favicon.svg', import.meta.url), 'utf8');
  assert.match(svg, /<svg\b/);
  assert.match(svg, /<title>Kyrox Studio<\/title>/);
  const ico = readFileSync(new URL('../public/stand-favicon.ico', import.meta.url));
  assert.deepEqual([...ico.subarray(0, 4)], [0, 0, 1, 0]);
  assert.ok(ico.readUInt16LE(4) > 0);
  assert.doesNotMatch(html, /href="\/favicon\.(?:svg|ico)"/);
});
