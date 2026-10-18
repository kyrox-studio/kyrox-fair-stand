// Modül grubu: öğeden bağımsız, isimli bir proje örneği kümesi.
// Grup bir Item değildir; BOM'a, üretime ve maliyete girmez. Bilgi her üye öğenin
// üstünde `group: { id, name, locked, fromWallId? }` olarak durur; böylece proje
// kaydına, revizyonlara, içe/dışa aktarmaya ve geri al geçmişine kendiliğinden girer.
//
// Kurallar (kyrox-platform projects/fair-stand/GROUP_LOCK_ROADMAP.md Faz 3):
// - Her türlü öğe gruplanır. Gruplanınca stand kenarına bağlı (back/left/right) üye
//   serbest öğeye çevrilir; konumu ve açısı aynı kalır, `fromWallId` hatırlanır.
// - Grup bütün olarak her yöne taşınır ve çoğaltılır. Tek kısıt: hiçbir üye aktif stand
//   alanının dışına taşmaz. Başka öğelerle çakışma ve tür kuralları aranmaz.
// - Bir öğe aynı anda tek grupta olur. Grupta 1 parça kalırsa grup çözülür.
// - Grup kilidi bütün üyeleri kilitli sayar (bkz. moduleLock.isModuleLocked).

import { validateModulePlacement } from './modulePlacement.js';
import { usesWallBackboneCollisionDepth } from './moduleBehavior.js';

export const GROUP_MOVE_STEP_CM = 10;
export const GROUP_NAME_MAX_LENGTH = 80;
export const GROUP_ID_MAX_LENGTH = 64;
export const GROUP_EDGE_WALL_IDS = Object.freeze(['back', 'left', 'right']);
export const GROUP_OUTSIDE_STAND_MESSAGE = 'Grup stand alanının dışına taşınamaz.';
export const GROUP_LOCKED_MESSAGE = 'Bu grup kilitli. Değiştirmek için önce grubun kilidini açın.';
export const GROUP_ROTATE_MESSAGE = 'Gruptaki öğe tek başına döndürülemez. Önce gruptan çıkarın.';

const EPSILON_CM = 0.001;
const COPY_SUFFIX = ' (kopya)';

function createGroupId() {
  const suffix = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `group-${suffix}`;
}

export function getModuleGroup(moduleState) {
  const group = moduleState?.group;
  if (!group || typeof group !== 'object' || typeof group.id !== 'string' || !group.id) return null;
  return group;
}

export function getModuleGroupId(moduleState) {
  return getModuleGroup(moduleState)?.id ?? null;
}

export function isGroupLocked(moduleState) {
  return getModuleGroup(moduleState)?.locked === true;
}

export function normalizeGroupName(name, fallback = 'Grup') {
  const text = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, GROUP_NAME_MAX_LENGTH);
  return text || fallback;
}

/** Projedeki gruplar, ilk üyenin sırasıyla: `[{ id, name, locked, moduleIds }]`. */
export function listGroups(modules = []) {
  const byId = new Map();
  modules.forEach((moduleState) => {
    const group = getModuleGroup(moduleState);
    if (!group) return;
    if (!byId.has(group.id)) {
      byId.set(group.id, { id: group.id, name: group.name, locked: group.locked === true, moduleIds: [] });
    }
    byId.get(group.id).moduleIds.push(moduleState.id);
  });
  return [...byId.values()];
}

export function getGroupMembers(modules = [], groupId) {
  if (!groupId) return [];
  return modules.filter((moduleState) => getModuleGroupId(moduleState) === groupId);
}

export function nextGroupName(modules = []) {
  const used = new Set(listGroups(modules).map((group) => group.name));
  for (let index = 1; index <= used.size + 1; index += 1) {
    const candidate = `Grup ${index}`;
    if (!used.has(candidate)) return candidate;
  }
  return `Grup ${used.size + 1}`;
}

/** Seçimdeki öğelerden başka gruplarda olanlar: `[{ moduleId, groupId, groupName }]`. */
export function findGroupConflicts(modules = [], moduleIds = [], targetGroupId = null) {
  const ids = new Set(moduleIds);
  return modules
    .filter((moduleState) => ids.has(moduleState?.id))
    .map((moduleState) => ({ moduleState, group: getModuleGroup(moduleState) }))
    .filter(({ group }) => group && group.id !== targetGroupId)
    .map(({ moduleState, group }) => ({ moduleId: moduleState.id, groupId: group.id, groupName: group.name }));
}

function detachFromEdge(moduleState) {
  const wallId = moduleState?.placement?.wallId;
  if (!GROUP_EDGE_WALL_IDS.includes(wallId)) return null;
  moduleState.placement = { ...moduleState.placement, wallId: 'free' };
  return wallId;
}

function normalizeRotation(value) {
  const deg = Number(value) || 0;
  return ((deg % 360) + 360) % 360;
}

function isOnEdge(placement, wallId, stand) {
  if (!placement) return false;
  const rotation = normalizeRotation(placement.rotationZDeg);
  const horizontal = rotation === 0 || rotation === 180;
  const vertical = rotation === 90 || rotation === 270;
  const near = (a, b) => Math.abs((Number(a) || 0) - (Number(b) || 0)) <= EPSILON_CM;
  if (wallId === 'back') return horizontal && near(placement.yCm, 0);
  if (wallId === 'left') return vertical && near(placement.xCm, 0);
  if (wallId === 'right') return vertical && near(placement.xCm, stand?.standXCm);
  return false;
}

function leaveGroup(moduleState, stand) {
  const group = getModuleGroup(moduleState);
  if (!group) return;
  const fromWallId = group.fromWallId;
  delete moduleState.group;
  // Kenardan ayrılmış üye hâlâ aynı kenar çizgisinde ve aynı açıdaysa kenara geri bağlanır.
  if (fromWallId && moduleState.placement?.wallId === 'free' && isOnEdge(moduleState.placement, fromWallId, stand)) {
    moduleState.placement = { ...moduleState.placement, wallId: fromWallId };
  }
}

// `carriedFromWallId`: başka gruptan taşınan üyenin önceki kenarı korunur.
function joinGroup(moduleState, group, carriedFromWallId = null) {
  const fromWallId = detachFromEdge(moduleState) ?? carriedFromWallId;
  moduleState.group = { id: group.id, name: group.name, locked: group.locked === true };
  if (fromWallId) moduleState.group.fromWallId = fromWallId;
}

/** 2'den az üyesi kalan grupları çözer; çözülen grup kimliklerini döndürür. */
export function pruneGroups(modules = [], stand = null) {
  const dissolved = [];
  listGroups(modules).forEach((group) => {
    if (group.moduleIds.length >= 2) return;
    getGroupMembers(modules, group.id).forEach((moduleState) => leaveGroup(moduleState, stand));
    dissolved.push(group.id);
  });
  return dissolved;
}

/**
 * Seçili öğelerden grup kurar. Başka gruplardaki öğeler varsa `moveFromOtherGroups`
 * olmadan işlem yapılmaz ve `{ ok: false, reason: 'conflict', conflicts }` döner.
 */
export function createGroup(modules = [], moduleIds = [], { name, stand = null, moveFromOtherGroups = false, id = null } = {}) {
  const ids = [...new Set(moduleIds)];
  const members = modules.filter((moduleState) => ids.includes(moduleState?.id));
  if (members.length < 2) return { ok: false, reason: 'too-few', message: 'Grup için en az 2 öğe seçin.' };
  const conflicts = findGroupConflicts(modules, ids);
  if (conflicts.length && !moveFromOtherGroups) return { ok: false, reason: 'conflict', conflicts };
  if (conflicts.some((conflict) => isGroupLocked(modules.find((m) => m.id === conflict.moduleId)))) {
    return { ok: false, reason: 'locked', message: GROUP_LOCKED_MESSAGE };
  }
  const group = { id: id || createGroupId(), name: normalizeGroupName(name, nextGroupName(modules)), locked: false };
  members.forEach((moduleState) => {
    joinGroup(moduleState, group, getModuleGroup(moduleState)?.fromWallId ?? null);
  });
  pruneGroups(modules, stand);
  return { ok: true, group: { ...group, moduleIds: members.map((moduleState) => moduleState.id) } };
}

export function addToGroup(modules = [], groupId, moduleIds = [], { stand = null, moveFromOtherGroups = false } = {}) {
  const target = listGroups(modules).find((group) => group.id === groupId);
  if (!target) return { ok: false, reason: 'missing', message: 'Grup bulunamadı.' };
  if (target.locked) return { ok: false, reason: 'locked', message: GROUP_LOCKED_MESSAGE };
  const ids = [...new Set(moduleIds)].filter((moduleId) => !target.moduleIds.includes(moduleId));
  const conflicts = findGroupConflicts(modules, ids, groupId);
  if (conflicts.length && !moveFromOtherGroups) return { ok: false, reason: 'conflict', conflicts };
  if (conflicts.some((conflict) => isGroupLocked(modules.find((m) => m.id === conflict.moduleId)))) {
    return { ok: false, reason: 'locked', message: GROUP_LOCKED_MESSAGE };
  }
  const added = modules.filter((moduleState) => ids.includes(moduleState?.id));
  added.forEach((moduleState) => {
    joinGroup(moduleState, target, getModuleGroup(moduleState)?.fromWallId ?? null);
  });
  pruneGroups(modules, stand);
  return { ok: true, added: added.length };
}

export function removeFromGroup(modules = [], moduleIds = [], { stand = null } = {}) {
  const ids = new Set(moduleIds);
  const members = modules.filter((moduleState) => ids.has(moduleState?.id) && getModuleGroup(moduleState));
  if (members.some(isGroupLocked)) return { ok: false, reason: 'locked', message: GROUP_LOCKED_MESSAGE };
  members.forEach((moduleState) => leaveGroup(moduleState, stand));
  const dissolved = pruneGroups(modules, stand);
  return { ok: true, removed: members.length, dissolved };
}

export function dissolveGroup(modules = [], groupId, { stand = null } = {}) {
  const members = getGroupMembers(modules, groupId);
  if (!members.length) return { ok: false, reason: 'missing', message: 'Grup bulunamadı.' };
  if (members.some(isGroupLocked)) return { ok: false, reason: 'locked', message: GROUP_LOCKED_MESSAGE };
  members.forEach((moduleState) => leaveGroup(moduleState, stand));
  return { ok: true, count: members.length };
}

export function renameGroup(modules = [], groupId, name) {
  const members = getGroupMembers(modules, groupId);
  if (!members.length) return { ok: false, reason: 'missing', message: 'Grup bulunamadı.' };
  const nextName = normalizeGroupName(name, members[0].group.name);
  members.forEach((moduleState) => { moduleState.group = { ...moduleState.group, name: nextName }; });
  return { ok: true, name: nextName };
}

export function setGroupLocked(modules = [], groupId, locked) {
  const members = getGroupMembers(modules, groupId);
  if (!members.length) return { ok: false, reason: 'missing', message: 'Grup bulunamadı.' };
  members.forEach((moduleState) => { moduleState.group = { ...moduleState.group, locked: locked === true }; });
  return { ok: true, count: members.length, locked: locked === true };
}

function boundaryDepthCm(moduleState) {
  if (usesWallBackboneCollisionDepth(moduleState)) return null;
  const depth = Number(moduleState?.depthCm);
  return Number.isFinite(depth) && depth > 0 ? depth : null;
}

function memberInsideStand(moduleState, placement, stand) {
  return validateModulePlacement({
    placement: { ...placement, wallId: 'free' },
    widthCm: moduleState.widthCm,
    depthCm: boundaryDepthCm(moduleState),
    standType: stand?.standType,
    standXCm: stand?.standXCm,
    standYCm: stand?.standYCm,
  }).ok;
}

function translatePlacement(placement, dxCm, dyCm) {
  return {
    ...placement,
    xCm: (Number(placement.xCm) || 0) + dxCm,
    yCm: (Number(placement.yCm) || 0) + dyCm,
    wallId: 'free',
  };
}

/** Üyelerin aynı kaydırmayla yeni konumları; biri stand dışına taşarsa ret. */
export function planPlacementsTranslate(members = [], dxCm, dyCm, stand) {
  const dx = Number(dxCm) || 0;
  const dy = Number(dyCm) || 0;
  const placements = new Map();
  for (const moduleState of members) {
    if (!moduleState?.placement) continue;
    const next = translatePlacement(moduleState.placement, dx, dy);
    if (!memberInsideStand(moduleState, next, stand)) {
      return { ok: false, message: GROUP_OUTSIDE_STAND_MESSAGE, placements: new Map() };
    }
    placements.set(moduleState.id, next);
  }
  return { ok: true, placements };
}

export function planGroupTranslate(modules = [], groupId, dxCm, dyCm, stand) {
  const members = getGroupMembers(modules, groupId);
  if (!members.length) return { ok: false, message: 'Grup bulunamadı.', placements: new Map() };
  if (members.some(isGroupLocked)) return { ok: false, message: GROUP_LOCKED_MESSAGE, placements: new Map() };
  return planPlacementsTranslate(members, dxCm, dyCm, stand);
}

/** Grubun zemindeki kapsayıcı dikdörtgeni (cm). */
export function getGroupBounds(members = []) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  members.forEach((moduleState) => {
    const placement = moduleState?.placement;
    if (!placement) return;
    const width = Number(moduleState.widthCm) || 0;
    const depth = boundaryDepthCm(moduleState) ?? 0;
    const radians = normalizeRotation(placement.rotationZDeg) * Math.PI / 180;
    const cos = Math.abs(Math.cos(radians));
    const sin = Math.abs(Math.sin(radians));
    const vertical = Math.abs(Math.sin(radians)) > 0.5;
    const centerX = (Number(placement.xCm) || 0) + (vertical ? 0 : width / 2);
    const centerY = (Number(placement.yCm) || 0) + (vertical ? width / 2 : 0);
    const halfX = (cos * width + sin * depth) / 2;
    const halfY = (sin * width + cos * depth) / 2;
    minX = Math.min(minX, centerX - halfX);
    maxX = Math.max(maxX, centerX + halfX);
    minY = Math.min(minY, centerY - halfY);
    maxY = Math.max(maxY, centerY + halfY);
  });
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY, widthCm: maxX - minX, depthCm: maxY - minY };
}

/**
 * Grup kopyası için kaydırma: önce yanlar (sağ, sol), sonra ön ve arka; ilk boşlukta
 * bütün üyeler stand içinde kalmalı. Bulunamazsa null.
 */
export function findGroupDuplicateOffset(members = [], stand) {
  const bounds = getGroupBounds(members);
  if (!bounds) return null;
  const stepX = Math.ceil(bounds.widthCm / GROUP_MOVE_STEP_CM) * GROUP_MOVE_STEP_CM || GROUP_MOVE_STEP_CM;
  const stepY = Math.ceil(bounds.depthCm / GROUP_MOVE_STEP_CM) * GROUP_MOVE_STEP_CM || GROUP_MOVE_STEP_CM;
  const candidates = [
    { dxCm: stepX, dyCm: 0 },
    { dxCm: -stepX, dyCm: 0 },
    { dxCm: 0, dyCm: stepY },
    { dxCm: 0, dyCm: -stepY },
  ];
  return candidates.find(({ dxCm, dyCm }) => planPlacementsTranslate(members, dxCm, dyCm, stand).ok) ?? null;
}

/**
 * Grubu çoğaltır. `duplicateModule` tek öğeyi yeni kimlikle kopyalar (designState.duplicateModuleState).
 * Kopyalar yeni, kilitsiz bir gruba alınır ve stand içinde bir boşluğa kaydırılır.
 */
export function planGroupDuplicate(modules = [], groupId, stand, { duplicateModule } = {}) {
  const members = getGroupMembers(modules, groupId);
  if (members.length < 2) return { ok: false, message: 'Grup bulunamadı.' };
  if (typeof duplicateModule !== 'function') throw new TypeError('duplicateModule is required.');
  const offset = findGroupDuplicateOffset(members, stand);
  if (!offset) return { ok: false, message: 'Grubun kopyası için standda yeterli boş alan yok.' };
  const source = members[0].group;
  const group = {
    id: createGroupId(),
    name: normalizeGroupName(`${source.name}${COPY_SUFFIX}`),
    locked: false,
  };
  const clones = members.map((moduleState) => {
    const clone = duplicateModule(moduleState);
    clone.placement = translatePlacement(moduleState.placement, offset.dxCm, offset.dyCm);
    clone.group = { id: group.id, name: group.name, locked: false };
    if (moduleState.group?.fromWallId) clone.group.fromWallId = moduleState.group.fromWallId;
    return clone;
  });
  return { ok: true, group, clones, offset };
}

/** İçe aktarma doğrulaması: `group` alanının biçimi ve gruplar arası tutarlılık. */
export function validateModuleGroups(modules = []) {
  const seen = new Map();
  for (let index = 0; index < modules.length; index += 1) {
    const moduleState = modules[index];
    if (!moduleState || !Object.hasOwn(moduleState, 'group')) continue;
    const group = moduleState.group;
    const label = `Modül ${index + 1}`;
    if (!group || typeof group !== 'object' || Array.isArray(group)) return { ok: false, message: `${label} grup bilgisi geçersiz.` };
    if (typeof group.id !== 'string' || !group.id || group.id.length > GROUP_ID_MAX_LENGTH) {
      return { ok: false, message: `${label} grup kimliği geçersiz.` };
    }
    if (typeof group.name !== 'string' || !group.name.trim() || group.name.length > GROUP_NAME_MAX_LENGTH) {
      return { ok: false, message: `${label} grup adı geçersiz.` };
    }
    if (typeof group.locked !== 'boolean') return { ok: false, message: `${label} grup kilidi geçersiz.` };
    if (Object.hasOwn(group, 'fromWallId') && !GROUP_EDGE_WALL_IDS.includes(group.fromWallId)) {
      return { ok: false, message: `${label} grup kenar bilgisi geçersiz.` };
    }
    const previous = seen.get(group.id);
    if (previous && (previous.name !== group.name || previous.locked !== group.locked)) {
      return { ok: false, message: `${label} grup bilgisi aynı gruptaki diğer öğelerle uyuşmuyor.` };
    }
    seen.set(group.id, { name: group.name, locked: group.locked });
  }
  return { ok: true };
}
