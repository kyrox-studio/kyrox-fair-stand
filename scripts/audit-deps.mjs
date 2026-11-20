// npm audit kapısı (high ve üstü). Geçici istisna yalnız aşağıda adı geçen uyarı içindir;
// her istisna gerekçe ve kaldırma koşuluyla yazılır, yama çıkınca silinir.
import { spawnSync } from 'node:child_process';

// 2026-11-20: picomatch ReDoS (GHSA-fc5q-39xc-vjpf) istisnası kaldırıldı; npm audit artık bildirmiyor.
const TEMPORARY_EXCEPTIONS = Object.freeze({});

const BLOCKING = new Set(['high', 'critical']);

const result = spawnSync('npm', ['audit', '--json'], { encoding: 'utf8', shell: process.platform === 'win32' });
let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  console.error('npm audit çıktısı okunamadı.');
  console.error(result.stdout || result.stderr);
  process.exit(1);
}

const advisoryId = (url) => String(url ?? '').split('/').pop();
const vulnerabilities = Object.values(report.vulnerabilities ?? {});
// Doğrudan uyarılar (via içinde nesne); paketler arası "Depends on" zinciri bu uyarılardan türer.
const advisories = new Map();
for (const vulnerability of vulnerabilities) {
  for (const via of vulnerability.via ?? []) {
    if (typeof via !== 'object' || !BLOCKING.has(via.severity)) continue;
    advisories.set(advisoryId(via.url), { name: via.name, title: via.title, severity: via.severity, url: via.url });
  }
}

const accepted = [...advisories].filter(([id]) => TEMPORARY_EXCEPTIONS[id]);
const blocking = [...advisories].filter(([id]) => !TEMPORARY_EXCEPTIONS[id]);

for (const [id, advisory] of accepted) {
  console.log(`Geçici istisna: ${id} ${advisory.name} (${advisory.severity}) — ${TEMPORARY_EXCEPTIONS[id]}`);
}
for (const id of Object.keys(TEMPORARY_EXCEPTIONS)) {
  if (!advisories.has(id)) console.log(`İstisna artık gerekmiyor, silinebilir: ${id}`);
}
if (blocking.length) {
  console.error(`${blocking.length} high/critical uyarı:`);
  for (const [id, advisory] of blocking) console.error(`- ${id} ${advisory.name} (${advisory.severity}): ${advisory.title} ${advisory.url}`);
  process.exit(1);
}
console.log('npm audit: engelleyen high/critical uyarı yok.');
