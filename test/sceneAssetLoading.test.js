import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  beginSceneAsset,
  getPendingSceneAssetCount,
  trackSceneModel,
  trackSceneTextureLoader,
  waitForSceneAssets,
} from '../src/sceneAssetLoading.js';

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

test('nothing pending: the wait resolves at once', async () => {
  const result = await waitForSceneAssets({ timeoutMs: 1000 });
  assert.deepEqual(result, { timedOut: false, done: 0, total: 0 });
});

test('the wait ends only when every image and model has arrived, with progress', async () => {
  const progress = [];
  const loads = [];
  const loader = trackSceneTextureLoader({ load: (url, onLoad, _p, onError) => { loads.push({ onLoad, onError }); } });
  loader.load('a.jpg', () => {});
  loader.load('b.jpg', () => {}, undefined, () => {});
  let resolveModel;
  trackSceneModel(new Promise((resolve) => { resolveModel = resolve; }));
  assert.equal(getPendingSceneAssetCount(), 3);

  let settled = null;
  const waiting = waitForSceneAssets({ timeoutMs: 2000, onProgress: (p) => progress.push(`${p.done}/${p.total}`) })
    .then((result) => { settled = result; });
  loads[0].onLoad('t');
  loads[1].onError(new Error('dosya yok'));
  await tick();
  assert.equal(settled, null, 'model gelmeden bekleme bitmez');
  resolveModel('scene');
  await waiting;
  assert.deepEqual(settled, { timedOut: false, done: 3, total: 3 });
  assert.deepEqual(progress, ['0/3', '1/3', '2/3', '3/3']);
});

test('a failed model and a throwing image callback still count as arrived', async () => {
  const loader = trackSceneTextureLoader({ load: (url, onLoad) => { onLoad('t'); } });
  assert.throws(() => loader.load('x.jpg', () => { throw new Error('çizim'); }), /çizim/);
  trackSceneModel(Promise.reject(new Error('404'))).catch(() => {});
  const result = await waitForSceneAssets({ timeoutMs: 1000 });
  assert.equal(result.timedOut, false);
  assert.equal(getPendingSceneAssetCount(), 0);
});

test('a load that never ends does not lock the screen: the wait times out', async () => {
  const done = beginSceneAsset('model');
  const result = await waitForSceneAssets({ timeoutMs: 20 });
  assert.equal(result.timedOut, true);
  done();
  assert.equal(getPendingSceneAssetCount(), 0);
});

test('a load started by an arriving one keeps the wait open', async () => {
  const first = beginSceneAsset('model');
  let settled = null;
  const waiting = waitForSceneAssets({ timeoutMs: 1000 }).then((result) => { settled = result; });
  // Model gelince aynı anda bir görsel yüklemesi başlar (ör. yüzeye görsel uygulanır).
  const second = beginSceneAsset('image');
  first();
  await tick();
  assert.equal(settled, null);
  second();
  await waiting;
  assert.equal(settled.total, 2);
});

test('project opening keeps the loading screen until the scene has filled', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const open = main.slice(main.indexOf('async function openStoredProject'), main.indexOf('function restoreProjectSelectToActiveProject'));
  assert.ok(open.indexOf('await restoreProject(project)') < open.indexOf('await waitForSceneToFill()'));
  assert.ok(open.indexOf('await waitForSceneToFill()') < open.indexOf('projectLoading.hide()'));
  const revision = main.slice(main.indexOf('async function openHistoricalRevision'), main.indexOf('function resetToFirstOpenState'));
  assert.equal(revision.match(/await waitForSceneToFill\(\)/g)?.length, 2, 'geçmiş revizyon ve canlıya dönüş');
  const importStart = main.indexOf("projectLoading.show('Proje içe aktarılıyor…'");
  const importBody = main.slice(importStart, main.indexOf('projectLoading.hide()', importStart));
  assert.match(importBody, /await waitForSceneToFill\(\)/);
  assert.match(main, /const SCENE_FILL_TIMEOUT_MS = 30000;/);
  assert.match(main, /projectLoading\.setDetail\(`Görseller ve 3D modeller yükleniyor… \$\{done\} \/ \$\{total\}`\)/);

  const mount = readFileSync(new URL('../src/mountFairStand.js', import.meta.url), 'utf8');
  assert.match(mount, /if \(options\.initialProjectId\) showInitialProjectLoading\(container\);/);
  const ui = readFileSync(new URL('../src/projectUi.js', import.meta.url), 'utf8');
  assert.match(ui, /return Object\.freeze\(\{ show, hide, setDetail \}\);/);
});
