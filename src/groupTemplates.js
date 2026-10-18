// Kurumsal grup şablonu (sahne editörü Faz 5): grup ↔ şablon dönüşümü.
// Şablon Item değildir; parçaların itemKey, tip, ölçü, göreli konum, renk, cam panel
// ve metal separatör atamalarını tutar. Lightbox / mesh kumaş, görseller, kimlikler,
// kilit ve grup bilgisi saklanmaz. Yerleştirilince parçalar yeni kimliklerle normal
// öğe olur ve şablon adıyla yeni, kilitsiz bir grup kurulur; BOM parçalardan çıkar.

import {
  GROUP_MOVE_STEP_CM,
  getGroupBounds,
  getGroupMembers,
  normalizeGroupName,
  planPlacementsTranslate,
} from './moduleGroups.js';
import { clearFabricFields } from './surfaceStateBinding.js';

export const GROUP_TEMPLATE_VERSION = 1;
export const GROUP_TEMPLATE_MIN_MEMBERS = 2;
export const GROUP_TEMPLATE_MAX_MEMBERS = 200;
export const GROUP_TEMPLATE_NO_ROOM_MESSAGE = 'Şablon için standda yeterli boş alan yok.';

const IMAGE_REFERENCE_KEYS = new Set(['imageAssetId', 'fabricImageAssetId']);
const TEMPLATE_DROPPED_KEYS = ['id', 'group', 'locked'];
const PLACEMENT_SEARCH_STEP_CM = 50;

function normalizeRotation(value) {
  const deg = Number(value) || 0;
  return ((deg % 360) + 360) % 360;
}

function roundCm(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/**
 * Derin kopya: renk / isGlass / isMetalSeparator / metalSeparatorGroupId korunur;
 * görsel ve lightbox/mesh kumaş alanları temizlenir.
 */
export function sanitizeTemplateMember(value) {
  if (Array.isArray(value)) return value.map(sanitizeTemplateMember);
  if (!value || typeof value !== 'object') return value;
  const output = {};
  Object.entries(value).forEach(([key, item]) => {
    output[key] = IMAGE_REFERENCE_KEYS.has(key) ? null : sanitizeTemplateMember(item);
  });
  clearFabricFields(output);
  return output;
}

/** Grubu şablon payload'una çevirir: `{ ok, payload }` ya da `{ ok: false, message }`. */
export function buildGroupTemplatePayload(modules = [], groupId) {
  const members = getGroupMembers(modules, groupId).filter((moduleState) => moduleState?.placement && moduleState.itemKey);
  if (members.length < GROUP_TEMPLATE_MIN_MEMBERS) {
    return { ok: false, message: 'Şablon için grupta en az 2 parça olmalı.' };
  }
  if (members.length > GROUP_TEMPLATE_MAX_MEMBERS) {
    return { ok: false, message: `Şablonda en fazla ${GROUP_TEMPLATE_MAX_MEMBERS} parça olabilir.` };
  }
  const bounds = getGroupBounds(members);
  const originX = bounds?.minX ?? 0;
  const originY = bounds?.minY ?? 0;
  const templateMembers = members.map((moduleState) => {
    const copy = sanitizeTemplateMember(moduleState);
    TEMPLATE_DROPPED_KEYS.forEach((key) => { delete copy[key]; });
    copy.placement = {
      xCm: roundCm(Number(moduleState.placement.xCm) - originX),
      yCm: roundCm(Number(moduleState.placement.yCm) - originY),
      zCm: roundCm(moduleState.placement.zCm ?? 0),
      rotationZDeg: normalizeRotation(moduleState.placement.rotationZDeg),
    };
    return copy;
  });
  return { ok: true, payload: { version: GROUP_TEMPLATE_VERSION, members: templateMembers } };
}

function createTemplateGroupId() {
  const suffix = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `group-${suffix}`;
}

function snapStep(value) {
  return Math.round(value / GROUP_MOVE_STEP_CM) * GROUP_MOVE_STEP_CM;
}

/** Şablon parçaları için standda yer: önce orta, sonra 50 cm ızgarada ilk sığan yer. */
export function findTemplateOffset(members = [], stand) {
  const bounds = getGroupBounds(members);
  const xLimit = Number(stand?.standXCm);
  const yLimit = Number(stand?.standYCm);
  if (!bounds || !Number.isFinite(xLimit) || !Number.isFinite(yLimit)) return null;
  if (bounds.widthCm > xLimit + 0.001 || bounds.depthCm > yLimit + 0.001) return null;
  const fits = (dxCm, dyCm) => planPlacementsTranslate(members, dxCm, dyCm, stand).ok;
  const centerDx = snapStep((xLimit - bounds.widthCm) / 2 - bounds.minX);
  const centerDy = snapStep((yLimit - bounds.depthCm) / 2 - bounds.minY);
  if (fits(centerDx, centerDy)) return { dxCm: centerDx, dyCm: centerDy };
  for (let y = 0; y <= yLimit; y += PLACEMENT_SEARCH_STEP_CM) {
    for (let x = 0; x <= xLimit; x += PLACEMENT_SEARCH_STEP_CM) {
      const dxCm = snapStep(x - bounds.minX);
      const dyCm = snapStep(y - bounds.minY);
      if (fits(dxCm, dyCm)) return { dxCm, dyCm };
    }
  }
  return null;
}

/**
 * Şablonu standa açar. `duplicateModule` tek öğeyi yeni kimlikle kopyalar
 * (designState.duplicateModuleState); `hasItem(itemKey)` katalogda olup olmadığını söyler.
 * Katalogda olmayan parçalar atlanır ve `skipped` içinde döner.
 */
export function instantiateGroupTemplate(payload, { name, stand, duplicateModule, hasItem = () => true } = {}) {
  if (typeof duplicateModule !== 'function') throw new TypeError('duplicateModule is required.');
  if (payload?.version !== GROUP_TEMPLATE_VERSION || !Array.isArray(payload?.members)) {
    return { ok: false, message: 'Desteklenmeyen şablon.' };
  }
  const usable = payload.members.filter((member) => member?.itemKey && hasItem(member.itemKey));
  const skipped = payload.members.filter((member) => !usable.includes(member)).map((member) => member?.itemKey ?? '?');
  if (usable.length < GROUP_TEMPLATE_MIN_MEMBERS) {
    return { ok: false, message: 'Şablondaki parçaların çoğu katalogda artık yok; yerleştirilemedi.', skipped };
  }
  const group = { id: createTemplateGroupId(), name: normalizeGroupName(name, 'Şablon'), locked: false };
  const clones = usable.map((member) => {
    // Eski kayıtlarda kalmış kumaş/görsel alanlarını da temizle; cam/metal/renk kalsın.
    const clone = duplicateModule({ ...sanitizeTemplateMember(member), id: 'template-member' });
    clone.placement = { ...member.placement, wallId: 'free' };
    clone.group = { ...group };
    return clone;
  });
  const offset = findTemplateOffset(clones, stand);
  if (!offset) return { ok: false, message: GROUP_TEMPLATE_NO_ROOM_MESSAGE, skipped };
  const plan = planPlacementsTranslate(clones, offset.dxCm, offset.dyCm, stand);
  clones.forEach((clone) => { clone.placement = plan.placements.get(clone.id) ?? clone.placement; });
  return { ok: true, group, clones, skipped, offset };
}
