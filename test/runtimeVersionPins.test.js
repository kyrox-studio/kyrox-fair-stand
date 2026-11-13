import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Sürüm kilidi (kullanıcı kararı 2026-11-13): yerel, CI ve sunucu aynı sürümle çalışır; esas canlı
// sunucudur (kyrox-platform standards/development/ORTAM_SURUMLERI.md). Kilit dosyaları birbiriyle
// ve CI ile tutarlı kalmalı.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('Node pin is one version: .nvmrc = engines.node = volta.node', () => {
  const nvmrc = read('.nvmrc').trim();
  const pkg = JSON.parse(read('package.json'));
  assert.match(nvmrc, /^\d+\.\d+\.\d+$/);
  assert.equal(pkg.engines?.node, nvmrc);
  assert.equal(pkg.volta?.node, nvmrc);
  assert.match(pkg.volta?.npm ?? '', /^\d+\.\d+\.\d+$/);
});

test('Python pin is an exact version', () => {
  assert.match(read('.python-version').trim(), /^3\.\d+\.\d+$/);
});

test('CI reads versions from the pin files and installs Python packages from the lock', () => {
  const ci = read('.github/workflows/ci.yml');
  assert.match(ci, /runs-on: ubuntu-\d+\.\d+/);
  assert.doesNotMatch(ci, /ubuntu-latest/);
  assert.match(ci, /node-version-file: \.nvmrc/);
  assert.match(ci, /python-version-file: \.python-version/);
  assert.doesNotMatch(ci, /node-version: /);
  assert.doesNotMatch(ci, /python-version: /);
  assert.match(ci, /pip install -r requirements\.lock\.txt/);
});

test('Python lock pins every package exactly and covers requirements.txt', () => {
  const lines = read('backend/requirements.lock.txt').split('\n').map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  assert.ok(lines.length > 0);
  const pinned = new Map();
  for (const line of lines) {
    const match = line.match(/^([A-Za-z0-9_.-]+)==([0-9][^ ;]*)(\s*;.+)?$/);
    assert.ok(match, `not an exact pin: ${line}`);
    pinned.set(match[1].toLowerCase().replace(/_/g, '-'), match[2]);
  }
  const required = read('backend/requirements.txt').split('\n').map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split(/[[<>=~!; ]/)[0].toLowerCase().replace(/_/g, '-'));
  for (const name of required) assert.ok(pinned.has(name), `requirements.txt package missing from lock: ${name}`);
});
