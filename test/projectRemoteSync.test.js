import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  ASSET_DOWNLOAD_CONCURRENCY,
  clearProjectAssetSyncState,
  isLocalAssetCurrent,
  settleWithConcurrency,
  isAssetSynced,
  markAssetDirty,
  markAssetSynced,
  markProjectAssetsSynced,
} from '../src/projectRemote.js';

const remoteSource = readFileSync(new URL('../src/projectRemote.js', import.meta.url), 'utf8');

function blobAsset(id, { size = 12, name = 'logo.png', type = 'image/png' } = {}) {
  return {
    id,
    name,
    type,
    blob: { size },
  };
}

test('listCachedProjects reads only the local project cache', () => {
  const start = remoteSource.indexOf('export async function listCachedProjects');
  const end = remoteSource.indexOf('export async function listProjects', start);
  assert.ok(start >= 0 && end > start);
  const cachedList = remoteSource.slice(start, end);
  assert.match(cachedList, /return listLocalProjects\(\)/);
  assert.doesNotMatch(cachedList, /apiFetch/);
});

test('opening one project downloads its assets together and tolerates a missing one', () => {
  const start = remoteSource.indexOf('async function cacheProjectAndAssets');
  const end = remoteSource.indexOf('export async function listProjects', start);
  assert.ok(start >= 0 && end > start);
  const cacheSource = remoteSource.slice(start, end);
  // Paralel ama sınırlı: en fazla ASSET_DOWNLOAD_CONCURRENCY (6) indirme aynı anda.
  assert.match(cacheSource, /const results = await settleWithConcurrency\(assets, ASSET_DOWNLOAD_CONCURRENCY, async \(asset\) => \{/);
  assert.match(remoteSource, /export const ASSET_DOWNLOAD_CONCURRENCY = 6;/);
  // Tarayıcıdaki güncel kopya yeniden indirilmez.
  assert.match(cacheSource, /if \(isLocalAssetCurrent\(localAsset, asset\)\)/);
  assert.match(cacheSource, /return await saveImportedImageAsset\(detail\.id,/);
  assert.match(cacheSource, /serverStorageKey: asset\.storageKey/);
  assert.match(cacheSource, /if \(result\.status === 'fulfilled'\)/);
  assert.match(cacheSource, /missingAssetIds\.push\(assets\[index\]\.id\)/);
  assert.match(cacheSource, /markProjectAssetsSynced\(detail\.id, cached\)/);
  assert.match(cacheSource, /return missingAssetIds\.length \? \{ \.\.\.local, missingAssetIds \} : local;/);
  assert.doesNotMatch(cacheSource, /for \(const asset of assets\)/);
});

test('projectRemote defaults saveProject asset sync to dirty-only', () => {
  assert.match(remoteSource, /syncAssets = 'dirty'/);
  assert.match(remoteSource, /mode === 'all' \|\| !isAssetSynced/);
  assert.match(remoteSource, /fair-stand\.asset-sync\.v1/);
});

test('asset sync fingerprint skips unchanged uploads and dirty forces re-upload', () => {
  const projectId = 'project-sync-a';
  const asset = blobAsset('asset-1', { size: 100, name: 'a.webp', type: 'image/webp' });

  clearProjectAssetSyncState(projectId);
  assert.equal(isAssetSynced(projectId, asset), false);

  markAssetSynced(projectId, asset);
  assert.equal(isAssetSynced(projectId, asset), true);

  // Same id, changed bytes → needs upload again
  const changed = blobAsset('asset-1', { size: 200, name: 'a.webp', type: 'image/webp' });
  assert.equal(isAssetSynced(projectId, changed), false);

  markAssetSynced(projectId, changed);
  assert.equal(isAssetSynced(projectId, changed), true);

  markAssetDirty(projectId, 'asset-1');
  assert.equal(isAssetSynced(projectId, changed), false);

  clearProjectAssetSyncState(projectId);
});

test('markProjectAssetsSynced bulk-marks server-hydrated assets', () => {
  const projectId = 'project-sync-b';
  const assets = [
    blobAsset('a1', { size: 10 }),
    blobAsset('a2', { size: 20, name: 'b.png' }),
  ];

  clearProjectAssetSyncState(projectId);
  markProjectAssetsSynced(projectId, assets);

  assert.equal(isAssetSynced(projectId, assets[0]), true);
  assert.equal(isAssetSynced(projectId, assets[1]), true);
  assert.equal(isAssetSynced(projectId, blobAsset('a3')), false);

  clearProjectAssetSyncState(projectId);
  assert.equal(isAssetSynced(projectId, assets[0]), false);
});

test('asset downloads run at most six at a time and one failure does not stop the rest', async () => {
  let running = 0;
  let peak = 0;
  const items = Array.from({ length: 13 }, (_, index) => index);
  const results = await settleWithConcurrency(items, ASSET_DOWNLOAD_CONCURRENCY, async (item) => {
    running += 1;
    peak = Math.max(peak, running);
    await new Promise((resolve) => setTimeout(resolve, 2));
    running -= 1;
    if (item === 4) throw new Error('dosya yok');
    return item * 10;
  });
  assert.equal(ASSET_DOWNLOAD_CONCURRENCY, 6);
  assert.equal(peak, 6);
  assert.equal(results.length, 13);
  assert.deepEqual(results[4].status, 'rejected');
  assert.deepEqual(results.filter((result) => result.status === 'fulfilled').map((result) => result.value),
    items.filter((item) => item !== 4).map((item) => item * 10));
});

test('a local image is reused only when id, storage key and size match the server', () => {
  const server = { id: 'a1', storageKey: 'org/p/a1.webp', byteSize: 3 };
  const blob = { size: 3 };
  assert.equal(isLocalAssetCurrent({ id: 'a1', serverStorageKey: 'org/p/a1.webp', blob }, server), true);
  assert.equal(isLocalAssetCurrent({ id: 'a1', serverStorageKey: 'org/p/a1.jpg', blob }, server), false, 'uzantı değişti');
  assert.equal(isLocalAssetCurrent({ id: 'a1', serverStorageKey: 'org/p/a1.webp', blob: { size: 4 } }, server), false, 'boyut farklı');
  assert.equal(isLocalAssetCurrent({ id: 'a1', blob }, server), false, 'eski kayıtta anahtar yok: bir kez indir');
  assert.equal(isLocalAssetCurrent(undefined, server), false);
  assert.equal(isLocalAssetCurrent({ id: 'a1', serverStorageKey: 'org/p/a1.webp' }, server), false, 'blob yok');
});
