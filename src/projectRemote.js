import { getFairStandHostWindow } from './hostDocument.js';
import {
  deleteProject as deleteLocalProject,
  deleteProjectWithAssets as deleteLocalProjectWithAssets,
  loadProject as loadLocalProject,
  listProjects as listLocalProjects,
  saveProject as saveLocalProject,
  clearAllLocalProjectsAndAssets,
} from './projectStore.js';
import {
  loadImageAssets,
  saveImportedImageAsset,
} from './assetStore.js';

const ASSET_SYNC_STORAGE_KEY = 'fair-stand.asset-sync.v1';

/** Fallback when localStorage is missing/blocked (Node tests, private mode). */
const memorySyncState = Object.create(null);

function projectsApiBase() {
  return import.meta.env.VITE_FAIR_STAND_PROJECTS_URL || '/api/v1/fair-stand/projects';
}

function apiHeaders() {
  const hostWindow = getFairStandHostWindow();
  const headers = hostWindow?.__FAIR_STAND_CATALOG_HEADERS__ || globalThis.__FAIR_STAND_CATALOG_HEADERS__;
  return headers && typeof headers === 'object' ? { ...headers } : {};
}

function remoteEnabled() {
  return Boolean(apiHeaders().Authorization || apiHeaders()['Authorization']);
}

export async function loadCustomerDisplayName(customerId) {
  if (!customerId || !remoteEnabled()) return '';
  const response = await fetch(`/api/v1/customers/${encodeURIComponent(customerId)}`, {
    headers: apiHeaders(),
  });
  if (!response.ok) return '';
  const body = await response.json();
  return String(body?.display_name || '').trim();
}

function cloneSyncState(value) {
  return value && typeof value === 'object' ? structuredClone(value) : {};
}

function readSyncState() {
  try {
    const raw = globalThis.localStorage?.getItem(ASSET_SYNC_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // fall through to memory
  }
  return cloneSyncState(memorySyncState);
}

function writeSyncState(state) {
  const next = state && typeof state === 'object' ? state : {};
  Object.keys(memorySyncState).forEach((key) => {
    delete memorySyncState[key];
  });
  Object.assign(memorySyncState, next);
  try {
    globalThis.localStorage?.setItem(ASSET_SYNC_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // memory fallback already updated
  }
}

function assetFingerprint(asset) {
  return {
    byteSize: Number(asset?.blob?.size) || Number(asset?.byteSize) || 0,
    name: String(asset?.name || ''),
    type: String(asset?.type || asset?.mime_type || ''),
  };
}

export function isAssetSynced(projectId, asset) {
  const entry = readSyncState()?.[projectId]?.[asset.id];
  if (!entry) return false;
  const fp = assetFingerprint(asset);
  return entry.byteSize === fp.byteSize
    && entry.name === fp.name
    && entry.type === fp.type;
}

export function markAssetDirty(projectId, assetId) {
  if (!projectId || !assetId) return;
  const state = readSyncState();
  if (!state[projectId]) return;
  delete state[projectId][assetId];
  if (!Object.keys(state[projectId]).length) delete state[projectId];
  writeSyncState(state);
}

export function markAssetSynced(projectId, asset) {
  if (!projectId || !asset?.id) return;
  const state = readSyncState();
  if (!state[projectId]) state[projectId] = {};
  state[projectId][asset.id] = assetFingerprint(asset);
  writeSyncState(state);
}

export function markProjectAssetsSynced(projectId, assets) {
  if (!projectId) return;
  const state = readSyncState();
  if (!state[projectId]) state[projectId] = {};
  for (const asset of assets || []) {
    if (!asset?.id) continue;
    state[projectId][asset.id] = assetFingerprint(asset);
  }
  writeSyncState(state);
}

export function clearProjectAssetSyncState(projectId) {
  if (!projectId) return;
  const state = readSyncState();
  delete state[projectId];
  writeSyncState(state);
}

function clearAllAssetSyncState() {
  Object.keys(memorySyncState).forEach((key) => {
    delete memorySyncState[key];
  });
  try {
    globalThis.localStorage?.removeItem(ASSET_SYNC_STORAGE_KEY);
  } catch {
    // ignore
  }
}

async function apiFetch(path, options = {}) {
  const headers = {
    ...apiHeaders(),
    ...(options.headers || {}),
  };
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
    delete headers['content-type'];
  }
  const response = await fetch(`${projectsApiBase()}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const error = new Error(`Fair Stand projects API ${response.status}${detail ? `: ${detail}` : ''}`);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response;
}

function toLocalProject(detail) {
  const payload = detail.payload || {};
  return {
    id: detail.id,
    name: detail.name,
    version: detail.version || 1,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    customerId: detail.customerId || null,
    stand: payload.stand ?? detail.stand ?? null,
    modules: Array.isArray(payload.modules) ? payload.modules : (detail.modules || []),
    revisions: Array.isArray(detail.revisions)
      ? detail.revisions.map((revision) => ({
        revisionNumber: revision.revisionNumber,
        createdAt: revision.createdAt,
        updatedAt: revision.updatedAt,
      }))
      : [],
  };
}

async function uploadOneAsset(projectId, asset) {
  const form = new FormData();
  form.append('asset_id', asset.id);
  form.append('name', asset.name || 'image');
  form.append('file', asset.blob, asset.name || 'image');
  await apiFetch(`/${projectId}/assets`, {
    method: 'POST',
    body: form,
  });
  markAssetSynced(projectId, asset);
}

async function syncProjectAssets(projectId, mode = 'dirty') {
  if (!remoteEnabled() || mode === 'none') return;
  const assets = await loadImageAssets(projectId);
  for (const asset of assets) {
    if (mode === 'all' || !isAssetSynced(projectId, asset)) {
      await uploadOneAsset(projectId, asset);
    }
  }
}

async function cacheProjectAndAssets(detail) {
  const local = toLocalProject(detail);
  await saveLocalProject(local);
  const assets = Array.isArray(detail.assets) ? detail.assets : [];
  // Görseller birlikte indirilir. İnemeyen görsel (ör. sunucuda dosya eksik) projeyi açmayı
  // engellemez; atlanır ve missingAssetIds ile bildirilir. Proje içindeki bağlantı silinmez.
  const results = await Promise.allSettled(assets.map(async (asset) => {
    const response = await apiFetch(`/${detail.id}/assets/${asset.id}`);
    const blob = await response.blob();
    return saveImportedImageAsset(detail.id, {
      id: asset.id,
      name: asset.name || 'image',
      type: asset.type || blob.type || 'application/octet-stream',
      blob,
      createdAt: asset.createdAt || Date.now(),
    });
  }));
  const cached = [];
  const missingAssetIds = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      cached.push(result.value);
      return;
    }
    missingAssetIds.push(assets[index].id);
    console.warn('Proje görseli indirilemedi:', assets[index].id, result.reason);
  });
  // Server copy is authoritative — skip re-upload on autosave.
  clearProjectAssetSyncState(detail.id);
  markProjectAssetsSynced(detail.id, cached);
  return missingAssetIds.length ? { ...local, missingAssetIds } : local;
}

export async function listCachedProjects() {
  return listLocalProjects();
}

export async function listProjects() {
  if (!remoteEnabled()) {
    return listLocalProjects();
  }
  const orgId = apiHeaders()['X-Organization-Id'] || apiHeaders()['x-organization-id'];
  const prevOrg = globalThis.__FAIR_STAND_PROJECT_CACHE_ORG__;
  if (prevOrg && orgId && prevOrg !== orgId) {
    clearAllAssetSyncState();
    await clearAllLocalProjectsAndAssets();
  }
  if (orgId) {
    globalThis.__FAIR_STAND_PROJECT_CACHE_ORG__ = orgId;
  }
  const data = await apiFetch('');
  const summaries = Array.isArray(data?.projects) ? data.projects : [];
  for (const summary of summaries) {
    const existing = await loadLocalProject(summary.id);
    await saveLocalProject({
      id: summary.id,
      name: summary.name,
      version: summary.version || 1,
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt,
      customerId: summary.customerId || existing?.customerId || null,
      stand: existing?.stand ?? null,
      modules: existing?.modules ?? [],
      revisions: existing?.revisions || [],
    });
  }
  return summaries
    .map((item) => ({
      id: item.id,
      name: item.name,
      version: item.version || 1,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      customerId: item.customerId || null,
    }))
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
}

export async function loadProject(projectId) {
  if (!remoteEnabled()) {
    return loadLocalProject(projectId);
  }
  const detail = await apiFetch(`/${projectId}`);
  return cacheProjectAndAssets(detail);
}

export async function loadProjectRevision(projectId, revisionNumber) {
  if (!remoteEnabled()) {
    throw new Error('Sunucu oturumu olmadan revizyon açılamaz.');
  }
  return apiFetch(`/${projectId}/revisions/${revisionNumber}`);
}

/**
 * @param {object} project
 * @param {{ syncAssets?: 'dirty' | 'all' | 'none', revisionMode?: 'none' | 'create' | 'update', revisionNumber?: number | null }} [options]
 *   dirty (default): upload only assets missing/changed vs last successful sync fingerprint
 *   all: force re-upload every local asset
 *   none: project payload only
 *   revisionMode create starts this edit session's revision; update rewrites that same revision.
 */
export async function saveProject(project, {
  syncAssets = 'dirty',
  revisionMode = 'none',
  revisionNumber = null,
} = {}) {
  const local = await saveLocalProject(project);
  if (!remoteEnabled()) {
    return local;
  }

  const payload = {
    stand: project.stand ?? null,
    modules: Array.isArray(project.modules) ? project.modules : [],
  };
  const body = {
    name: project.name || 'Adsız Proje',
    version: Number(project.version) || 1,
    payload,
    revisionMode,
  };
  if (revisionMode === 'update' && revisionNumber != null) body.revisionNumber = revisionNumber;
  if (project.customerId) body.customerId = project.customerId;

  const detail = await apiFetch(`/${project.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  await syncProjectAssets(project.id, syncAssets);

  return toLocalProject(detail);
}

export async function deleteProjectAsset(projectId, assetId) {
  if (!projectId || !assetId) return false;
  markAssetDirty(projectId, assetId);
  if (!remoteEnabled()) return false;
  try {
    await apiFetch(`/${projectId}/assets/${assetId}`, { method: 'DELETE' });
    return true;
  } catch (error) {
    if (error.status === 404 || String(error.message || '').includes('404')) {
      return false;
    }
    throw error;
  }
}

export async function deleteProject(projectId) {
  if (remoteEnabled()) {
    await apiFetch(`/${projectId}`, { method: 'DELETE' });
  }
  clearProjectAssetSyncState(projectId);
  await deleteLocalProject(projectId);
}

export async function deleteProjectWithAssets(projectId) {
  if (remoteEnabled()) {
    await apiFetch(`/${projectId}`, { method: 'DELETE' });
  }
  clearProjectAssetSyncState(projectId);
  return deleteLocalProjectWithAssets(projectId);
}

export async function exportProjectZip(projectId) {
  if (!remoteEnabled()) {
    throw new Error('Sunucu oturumu olmadan proje export edilemez.');
  }
  const response = await apiFetch(`/${projectId}/export`);
  return response.blob();
}

export { createProjectId } from './projectStore.js';
export { remoteEnabled as isProjectRemoteEnabled };
