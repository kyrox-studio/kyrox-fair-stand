import { MODULE_STATE_TYPES } from './designState.js';
import { validateFloorArea } from './floorArea.js';
import { getFloorItem, resolveStandFloorItemKey } from './items.js';
import { validateModuleGroups } from './moduleGroups.js';
import { validateStandSetup } from './standSetup.js';

export const PROJECT_ARCHIVE_VERSION = 1;

export function isSafeArchivePath(path) {
  const normalized = String(path ?? '').replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || normalized.includes('://')) return false;
  const parts = normalized.split('/');
  if (parts.some((part) => part === '' || part === '.' || part === '..')) return false;
  return true;
}

export function isAllowedImportImageType(type) {
  return typeof type === 'string' && type.startsWith('image/');
}

export function isAllowedImportZipFile(file) {
  if (!file) return false;
  const name = String(file.name ?? '').toLowerCase();
  const type = String(file.type ?? '');
  if (name.endsWith('.zip')) return true;
  return type === 'application/zip' || type === 'application/x-zip-compressed';
}

export function validateImportedModuleState(moduleState) {
  if (!moduleState || typeof moduleState !== 'object' || Array.isArray(moduleState)) {
    return { ok: false, message: 'Proje modül kaydı geçersiz.' };
  }
  if (typeof moduleState.id !== 'string' || !moduleState.id.trim()) {
    return { ok: false, message: 'Proje modül kimliği geçersiz.' };
  }
  if (!MODULE_STATE_TYPES.includes(moduleState.type)) {
    return { ok: false, message: 'Proje modül tipi geçersiz.' };
  }
  if (Object.hasOwn(moduleState, 'locked') && typeof moduleState.locked !== 'boolean') {
    return { ok: false, message: 'Proje modül kilidi geçersiz.' };
  }
  return { ok: true };
}

export function validateImportedStandState(stand) {
  if (!stand || typeof stand !== 'object' || Array.isArray(stand)) {
    return { ok: false, message: 'Proje stand kaydı geçersiz.' };
  }
  const setup = validateStandSetup({
    standType: stand.standType,
    xCm: stand.xCm,
    yCm: stand.yCm,
  });
  if (!setup.ok) return setup;
  const floorKey = resolveStandFloorItemKey(stand);
  if (!getFloorItem(floorKey)) {
    return { ok: false, message: 'Proje zemin öğesi geçersiz.' };
  }
  if (stand.floorArea != null) {
    const area = validateFloorArea(stand.floorArea, { xCm: setup.xCm, yCm: setup.yCm });
    if (!area.ok) return area;
  }
  return { ok: true };
}

export function validateImportedProjectState(project) {
  if (!project || typeof project !== 'object' || Array.isArray(project)) {
    return { ok: false, message: 'Desteklenmeyen proje paketi.' };
  }
  if (typeof project.id !== 'string' || !project.id.trim()) {
    return { ok: false, message: 'Proje kimliği geçersiz.' };
  }
  if (project.version != null && Number(project.version) !== PROJECT_ARCHIVE_VERSION) {
    return { ok: false, message: 'Desteklenmeyen proje sürümü.' };
  }
  if (!Array.isArray(project.modules)) {
    return { ok: false, message: 'Proje modül listesi geçersiz.' };
  }
  for (const moduleState of project.modules) {
    const moduleCheck = validateImportedModuleState(moduleState);
    if (!moduleCheck.ok) return moduleCheck;
  }
  const groupCheck = validateModuleGroups(project.modules);
  if (!groupCheck.ok) return groupCheck;
  if (project.stand != null) {
    const standCheck = validateImportedStandState(project.stand);
    if (!standCheck.ok) return standCheck;
  }
  return { ok: true };
}

export function validateProjectArchiveManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { ok: false, message: 'Desteklenmeyen proje paketi.' };
  }
  if (manifest.archiveVersion !== PROJECT_ARCHIVE_VERSION) {
    return { ok: false, message: 'Desteklenmeyen proje paketi.' };
  }
  const projectCheck = validateImportedProjectState(manifest.project);
  if (!projectCheck.ok) return projectCheck;
  if (manifest.assets != null && !Array.isArray(manifest.assets)) {
    return { ok: false, message: 'Proje görsel listesi geçersiz.' };
  }
  return { ok: true };
}

export function validateImportedAssetRecord(asset) {
  if (!asset || typeof asset !== 'object' || Array.isArray(asset)) {
    return { ok: false, message: 'Proje görsel kaydı geçersiz.' };
  }
  if (typeof asset.id !== 'string' || !asset.id || typeof asset.path !== 'string' || !asset.path) {
    return { ok: false, message: 'Proje görsel kaydı geçersiz.' };
  }
  if (!isSafeArchivePath(asset.path) || !asset.path.replace(/\\/g, '/').startsWith('assets/')) {
    return { ok: false, message: `Güvensiz asset yolu: ${asset.path}` };
  }
  if (!isAllowedImportImageType(asset.type)) {
    return { ok: false, message: 'Proje görseli image/* tipinde olmalı.' };
  }
  return { ok: true };
}
