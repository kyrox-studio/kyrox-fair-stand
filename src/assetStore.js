import {
  ASSET_PROJECT_INDEX,
  ASSET_STORE_NAME,
  openConfiguratorDb,
} from './configuratorDb.js';
import { prepareUploadedImage } from './imageOptimize.js';

function createId() {
  return globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export async function saveImageAsset(projectId, file) {
  if (!projectId) throw new Error('Görsel kaydı için projectId gerekli.');
  const prepared = await prepareUploadedImage(file);
  const db = await openConfiguratorDb();
  const asset = {
    id: createId(),
    projectId,
    name: file.name,
    type: prepared.type,
    blob: prepared.blob,
    createdAt: Date.now(),
  };

  await new Promise((resolve, reject) => {
    const transaction = db.transaction(ASSET_STORE_NAME, 'readwrite');
    transaction.objectStore(ASSET_STORE_NAME).put(asset);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  db.close();
  return asset;
}

export async function loadImageAssets(projectId) {
  if (!projectId) return [];
  const db = await openConfiguratorDb();
  const assets = await new Promise((resolve, reject) => {
    const transaction = db.transaction(ASSET_STORE_NAME, 'readonly');
    const store = transaction.objectStore(ASSET_STORE_NAME);
    const request = store.index(ASSET_PROJECT_INDEX).getAll(projectId);
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error);
  });

  db.close();
  return assets.sort((a, b) => a.createdAt - b.createdAt);
}

export async function deleteImageAsset(projectId, assetId) {
  if (!projectId || !assetId) return false;
  const db = await openConfiguratorDb();
  const deleted = await new Promise((resolve, reject) => {
    const transaction = db.transaction(ASSET_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(ASSET_STORE_NAME);
    let removed = false;
    const request = store.get(assetId);

    request.onsuccess = () => {
      const asset = request.result;
      if (!asset || asset.projectId !== projectId) return;
      store.delete(assetId);
      removed = true;
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => resolve(removed);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

  db.close();
  return deleted;
}

export async function deleteProjectImageAssets(projectId) {
  if (!projectId) return;
  const db = await openConfiguratorDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(ASSET_STORE_NAME, 'readwrite');
    const index = transaction.objectStore(ASSET_STORE_NAME).index(ASSET_PROJECT_INDEX);
    const request = index.openCursor(IDBKeyRange.only(projectId));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function saveImportedImageAsset(projectId, asset) {
  if (!projectId) throw new Error('İçe aktarılan görsel için projectId gerekli.');
  if (!asset?.id || !asset?.blob) throw new Error('İçe aktarılan görsel geçersiz.');
  const db = await openConfiguratorDb();
  const stored = {
    id: asset.id,
    projectId,
    name: asset.name || 'asset',
    type: asset.type || asset.blob.type || 'application/octet-stream',
    blob: asset.blob,
    createdAt: Number(asset.createdAt) || Date.now(),
  };
  // Sunucudan inen kopya hangi depolama anahtarından geldiğini bilir; aynı anahtar tekrar
  // gelirse proje açılışı görseli yeniden indirmez.
  if (asset.serverStorageKey) stored.serverStorageKey = asset.serverStorageKey;
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(ASSET_STORE_NAME, 'readwrite');
    transaction.objectStore(ASSET_STORE_NAME).put(stored);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
  return stored;
}
