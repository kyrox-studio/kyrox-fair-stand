import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('CI npm audit ve src sözdizimi kapısını çalıştırır', () => {
  assert.equal(pkg.scripts['audit:deps'], 'node scripts/audit-deps.mjs');
  assert.equal(pkg.scripts['syntax:check'], 'node scripts/check-src-syntax.mjs');
  assert.match(workflow, /npm run audit:deps/);
  assert.match(workflow, /npm run syntax:check/);
});

test('npm audit kapısı high/critical uyarıda durur; istisna yalnız gerekçeli, adı geçen uyarıdır', () => {
  const script = readFileSync(new URL('../scripts/audit-deps.mjs', import.meta.url), 'utf8');
  assert.match(script, /const BLOCKING = new Set\(\['high', 'critical'\]\);/);
  assert.match(script, /process\.exit\(1\);/);
  // 2026-11-20: picomatch ReDoS istisnası kaldırıldı (npm audit bildirmiyor); geçici istisna yok.
  const ids = [...script.matchAll(/'(GHSA-[a-z0-9-]+)':/g)].map((match) => match[1]);
  assert.deepEqual(ids, []);
});
