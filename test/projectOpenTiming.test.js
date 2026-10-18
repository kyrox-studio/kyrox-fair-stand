import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  EDITOR_ROUTE_MARK,
  beginEditorBootStep,
  beginProjectOpenStep,
  discardEditorBootTiming,
  startEditorBootTiming,
  summarizeEditorBoot,
  collectModelLoads,
  finishProjectOpenTiming,
  getLastProjectOpenTiming,
  isProjectOpenTimingActive,
  noteProjectOpenAssets,
  startProjectOpenTiming,
  getPendingSceneAssetCount,
  summarizeSceneReady,
  trackSceneModel,
  trackSceneTextureLoader,
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
    summarizeSceneReady({ sinceOpenMs: 4200, sinceRouteMs: 9100, imageCount: 12, modelCount: 3, models, timedOut: false }),
    "[Fair Stand ölçüm] sahne tamamen hazır: açılıştan +4200 ms (Düzenle'den 9100 ms) · 12 görsel yüzeyi · 3 model (2 dosya 2.0 MB indirildi, 1 önbellekten)",
  );
  assert.match(
    summarizeSceneReady({ sinceOpenMs: 60000, sinceRouteMs: null, imageCount: 0, modelCount: 0, models: collectModelLoads([], startedAt), timedOut: true }),
    /^\[Fair Stand ölçüm\] sahne hâlâ yükleniyor: açılıştan \+60000 ms · 0 görsel yüzeyi · 0 model/,
  );
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

test('editor boot (Düzenle) is reported once with the first project open', () => {
  performance.clearMarks(EDITOR_ROUTE_MARK);
  performance.mark(EDITOR_ROUTE_MARK);
  const boot = startEditorBootTiming();
  assert.ok(boot.routeAt != null && boot.routeAt <= boot.mountedAt);
  beginEditorBootStep('catalog')();
  const endStart = beginEditorBootStep('editor-start');
  startProjectOpenTiming('p-boot');
  endStart();
  discardEditorBootTiming();
  const lines = [];
  const result = finishProjectOpenTiming({ moduleCount: 3, log: (line) => lines.push(line) });
  assert.match(lines[0], /^\[Fair Stand ölçüm\] editör: Düzenle'den itibaren toplam \d+ ms · editör kodu yükleme \d+ ms · katalog \d+ ms · editör başlatma \d+ ms$/);
  assert.match(lines[1], /^\[Fair Stand ölçüm\] proje açıldı: /);
  assert.deepEqual(Object.keys(result.boot.steps), ['catalog', 'editor-start']);

  // İkinci açılış editör satırı yazmaz.
  const second = [];
  startProjectOpenTiming('p-boot');
  finishProjectOpenTiming({ log: (line) => second.push(line) });
  assert.equal(second.length, 1);
  assert.match(second[0], /proje açıldı/);
  performance.clearMarks(EDITOR_ROUTE_MARK);
});

test('editor opened without a project drops its boot record', () => {
  performance.clearMarks(EDITOR_ROUTE_MARK);
  startEditorBootTiming();
  discardEditorBootTiming();
  const lines = [];
  startProjectOpenTiming('later');
  finishProjectOpenTiming({ log: (line) => lines.push(line) });
  assert.equal(lines.length, 1);
  assert.match(lines[0], /proje açıldı/);
});

test('without the CRM mark the editor line counts from mount', () => {
  performance.clearMarks(EDITOR_ROUTE_MARK);
  const line = summarizeEditorBoot({ routeAt: null, mountedAt: 100, steps: { catalog: 50 } }, 400);
  assert.equal(line, "[Fair Stand ölçüm] editör: editör açılışından itibaren toplam 300 ms · katalog 50 ms");
});

test('editor boot wiring: mount starts it, configurator times catalog and start', () => {
  const mount = readFileSync(new URL('../src/mountFairStand.js', import.meta.url), 'utf8');
  assert.match(mount, /startEditorBootTiming\(\);/);
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const start = main.slice(main.indexOf('export function startFairStandConfigurator'), main.indexOf('function startFairStandConfiguratorRuntime'));
  assert.ok(start.indexOf("beginEditorBootStep('catalog')") < start.indexOf('bootstrapFairStandCatalog()'));
  assert.ok(start.indexOf('discardEditorBootTiming()') > start.indexOf('startFairStandConfiguratorRuntime(options)'));
});

test('scene ready waits until every tracked image and model has arrived', async () => {
  const loads = [];
  const fakeLoader = { load: (url, onLoad, _progress, onError) => { loads.push({ url, onLoad, onError }); return 'tex'; } };
  const loader = trackSceneTextureLoader(fakeLoader);
  const lines = [];
  startProjectOpenTiming('p-scene');
  assert.equal(loader.load('a.jpg', () => {}), 'tex');
  loader.load('b.jpg', () => { throw new Error('çizim hatası'); }, undefined, () => {});
  let resolveModel;
  trackSceneModel(new Promise((resolve) => { resolveModel = resolve; }));
  assert.equal(getPendingSceneAssetCount(), 3);
  finishProjectOpenTiming({ moduleCount: 1, log: (line) => lines.push(line) });
  assert.equal(lines.length, 1);

  loads[0].onLoad('t1');
  assert.throws(() => loads[1].onLoad('t2'), /çizim hatası/);
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(lines.length, 1, 'model gelmeden sahne hazır sayılmaz');
  resolveModel('scene');
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(getPendingSceneAssetCount(), 0);
  assert.match(lines[1], /^\[Fair Stand ölçüm\] sahne tamamen hazır: açılıştan \+\d+ ms · 2 görsel yüzeyi · 1 model/);
  assert.equal(getLastProjectOpenTiming().scene.imageCount, 2);
});

test('scene ready is reported at once when nothing is pending', async () => {
  const lines = [];
  startProjectOpenTiming('p-empty');
  finishProjectOpenTiming({ log: (line) => lines.push(line) });
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.match(lines[1], /sahne tamamen hazır: açılıştan \+\d+ ms · 0 görsel yüzeyi · 0 model/);
});

test('scene3d counts surface images and item models', () => {
  const scene = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  assert.match(scene, /const textureLoader = trackSceneTextureLoader\(new THREE\.TextureLoader\(\)\);/);
  assert.match(scene, /return trackSceneModel\(loadGltfScene\(/);
});
