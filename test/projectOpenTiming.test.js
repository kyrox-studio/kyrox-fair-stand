import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  beginProjectOpenStep,
  collectModelLoads,
  finishProjectOpenTiming,
  getLastProjectOpenTiming,
  isProjectOpenTimingActive,
  noteProjectOpenAssets,
  startProjectOpenTiming,
  summarizeModelLoads,
  summarizeProjectOpen,
  timeProjectOpenStep,
} from '../src/projectOpenTiming.js';

test('steps outside an open measurement run normally and record nothing', async () => {
  assert.equal(isProjectOpenTimingActive(), false);
  assert.equal(await timeProjectOpenStep('project-fetch', async () => 42), 42);
  beginProjectOpenStep('scene-build')();
  noteProjectOpenAssets({ count: 3 });
  assert.equal(finishProjectOpenTiming({ log: () => {} }), null);
});

test('an open measurement records each step, assets and module count in one log line', async () => {
  const lines = [];
  startProjectOpenTiming('p-1');
  await timeProjectOpenStep('project-fetch', async () => {});
  await timeProjectOpenStep('assets-download', async () => {});
  noteProjectOpenAssets({ count: 5, bytes: 3 * 1024 * 1024, missing: 1 });
  const endScene = beginProjectOpenStep('scene-build');
  endScene();
  endScene();
  const result = finishProjectOpenTiming({ moduleCount: 12, log: (line) => lines.push(line) });

  assert.equal(isProjectOpenTimingActive(), false);
  assert.deepEqual(Object.keys(result.steps), ['project-fetch', 'assets-download', 'scene-build']);
  for (const ms of Object.values(result.steps)) assert.ok(ms >= 0);
  assert.ok(result.totalMs >= 0);
  assert.equal(result.moduleCount, 12);
  assert.equal(getLastProjectOpenTiming(), result);
  assert.match(lines[0], /^\[Fair Stand ölçüm\] proje açıldı: toplam \d+ ms/);
  assert.match(lines[0], /proje verisi \d+ ms/);
  assert.match(lines[0], /görsel indirme \d+ ms/);
  assert.match(lines[0], /sahne kurulumu \d+ ms/);
  assert.match(lines[0], /5 görsel \(3\.0 MB, 1 eksik\)/);
  assert.match(lines[0], /12 modül/);
});

test('a step that throws is still timed and the error reaches the caller', async () => {
  startProjectOpenTiming('p-2');
  await assert.rejects(timeProjectOpenStep('project-fetch', async () => {
    throw new Error('ağ yok');
  }), /ağ yok/);
  const result = finishProjectOpenTiming({ log: () => {} });
  assert.ok('project-fetch' in result.steps);
});

test('a failed open logs nothing and keeps the previous result', () => {
  startProjectOpenTiming('ok');
  const previous = finishProjectOpenTiming({ log: () => {} });
  const lines = [];
  startProjectOpenTiming('broken');
  assert.equal(finishProjectOpenTiming({ ok: false, log: (line) => lines.push(line) }), null);
  assert.deepEqual(lines, []);
  assert.equal(getLastProjectOpenTiming(), previous);
});

test('model loads count only /models/ requests that started with this open', () => {
  const startedAt = 1000;
  const models = collectModelLoads([
    { name: 'https://x/models/old.glb', startTime: 500, responseEnd: 900, transferSize: 999 },
    { name: 'https://x/models/a.glb', startTime: 1100, responseEnd: 2600, transferSize: 2 * 1024 * 1024, decodedBodySize: 2 * 1024 * 1024 },
    { name: 'https://x/models/b.glb', startTime: 1200, responseEnd: 1500, transferSize: 0, decodedBodySize: 4096 },
    { name: 'https://x/assets/index.js', startTime: 1100, responseEnd: 1300, transferSize: 5000 },
  ], startedAt);
  assert.deepEqual(models, { count: 2, transferBytes: 2 * 1024 * 1024, cachedCount: 1, lastEndMs: 1600 });
  assert.equal(
    summarizeModelLoads(models),
    '[Fair Stand ölçüm] 3D model: 2 dosya, 2.0 MB indirildi, 1 önbellekten; son model açılıştan 1600 ms sonra hazır',
  );
  assert.match(summarizeModelLoads(collectModelLoads([], startedAt)), /indirme yok/);
});

test('summary keeps step order and labels unknown steps by name', () => {
  const line = summarizeProjectOpen({
    totalMs: 1234.4,
    steps: { 'project-read-local': 10, custom: 5 },
    assets: null,
    moduleCount: null,
  });
  assert.equal(line, '[Fair Stand ölçüm] proje açıldı: toplam 1234 ms · proje (yerel) 10 ms · custom 5 ms');
});

test('project open path is wired to the measurement', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const open = main.slice(main.indexOf('async function openStoredProject'), main.indexOf('function restoreProjectSelectToActiveProject'));
  assert.match(open, /startProjectOpenTiming\(projectId\)/);
  assert.match(open, /finally \{\s*finishProjectOpenTiming\(\{ ok: opened/);
  const restore = main.slice(main.indexOf('async function restoreProject'), main.indexOf('async function restoreProject') + 4000);
  assert.match(restore, /timeProjectOpenStep\('assets-register'/);
  assert.ok(restore.indexOf("beginProjectOpenStep('scene-build')") < restore.indexOf('scene3d.createStage('));
  assert.ok(restore.indexOf('endSceneBuild()') > restore.indexOf('rebuildWall({ resetView: true })'));

  const remote = readFileSync(new URL('../src/projectRemote.js', import.meta.url), 'utf8');
  assert.match(remote, /timeProjectOpenStep\('project-fetch'/);
  assert.match(remote, /beginProjectOpenStep\('assets-download'\)/);
  assert.match(remote, /endAssetsDownload\(\);/);
  assert.match(remote, /timeProjectOpenStep\('project-read-local'/);
  assert.match(remote, /noteProjectOpenAssets\(/);
});
