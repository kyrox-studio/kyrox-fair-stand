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

import { remapCopiedSurfaceGroups } from './surfaceStateBinding.js';
import { isVerticalModuleRotation } from './modulePlacement.js';
import { STAND_DIMENSIONS } from './standDimensions.js';
import { usesWallBackboneCollisionDepth } from './moduleBehavior.js';

export const GROUP_MOVE_STEP_CM = 10;
// Shift+R gruptaki öğede bütün grubu bu kadar döndürür (kullanıcı kararı, Faz 4).
export const GROUP_ROTATE_STEP_DEG = 45;
export const GROUP_ROTATE_OUTSIDE_STAND_MESSAGE = 'Grup bu açıda stand alanına sığmıyor.';
export const GROUP_NAME_MAX_LENGTH = 80;
export const GROUP_ID_MAX_LENGTH = 64;
export const GROUP_EDGE_WALL_IDS = Object.freeze(['back', 'left', 'right']);
export const GROUP_OUTSIDE_STAND_MESSAGE = 'Grup stand alanının dışına taşınamaz.';
export const GROUP_LOCKED_MESSAGE = 'Bu grup kilitli. Değiştirmek için önce grubun kilidini açın.';

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

/** Grubun tamamı seçiliyse toplu kilit açma grup kilidini de kaldırır. */
export function unlockFullySelectedGroups(modules = [], moduleIds = []) {
  const selected = new Set(moduleIds);
  const groups = listGroups(modules).filter((group) => group.locked && group.moduleIds.every((id) => selected.has(id)));
  groups.forEach((group) => setGroupLocked(modules, group.id, false));
  return groups.map((group) => group.id);
}

/** Yalnız tamamı seçilen grupları çözer; kilitli grup varsa hiçbirini değiştirmez. */
export function dissolveSelectedGroups(modules = [], moduleIds = [], { stand = null } = {}) {
  const selected = new Set(moduleIds);
  const groups = listGroups(modules).filter((group) => group.moduleIds.every((id) => selected.has(id)));
  if (groups.some((group) => group.locked)) return { ok: false, reason: 'locked', message: GROUP_LOCKED_MESSAGE };
  if (!groups.length) return { ok: false, reason: 'missing', message: 'Tamamı seçili bir grup yok.' };
  groups.forEach((group) => dissolveGroup(modules, group.id, { stand }));
  return { ok: true, count: groups.length };
}

// Duvar kalınlığı kadar ince öğeler (panel, kapı) kenar çizgisine ortalanır; motor da
// (modulePlacement.hasStrictDepthBounds) bu öğelerde derinliği sınıra katmaz.
function standWallDepthCm() {
  return Math.max(0, Number(STAND_DIMENSIONS.depth) * 100 || 0);
}

function boundaryDepthCm(moduleState) {
  if (usesWallBackboneCollisionDepth(moduleState)) return null;
  const depth = Number(moduleState?.depthCm);
  if (!Number.isFinite(depth) || depth <= standWallDepthCm() + EPSILON_CM) return null;
  return depth;
}

// Tek kısıt: öğenin dönmüş kaplama alanı aktif stand alanında kalmalı. Taşıma,
// döndürme ve çoğaltma aynı kuralı kullanır (45° panel kenardan taşamaz).
function memberInsideStand(moduleState, placement, stand) {
  const xLimit = Number(stand?.standXCm);
  const yLimit = Number(stand?.standYCm);
  if (!Number.isFinite(xLimit) || !Number.isFinite(yLimit)) return false;
  const center = memberCenterCm(moduleState, placement);
  const { halfX, halfY } = memberHalfExtentsCm(moduleState, placement?.rotationZDeg);
  return center.xCm - halfX >= -EPSILON_CM
    && center.xCm + halfX <= xLimit + EPSILON_CM
    && center.yCm - halfY >= -EPSILON_CM
    && center.yCm + halfY <= yLimit + EPSILON_CM;
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

// Öğenin plan merkezi: motorla aynı kural (yalnız 90/270 "dikey" çapadır; 45° yatay sayılır).
function memberCenterCm(moduleState, placement = moduleState?.placement) {
  const width = Number(moduleState?.widthCm) || 0;
  const vertical = isVerticalModuleRotation(placement?.rotationZDeg);
  return {
    xCm: (Number(placement?.xCm) || 0) + (vertical ? 0 : width / 2),
    yCm: (Number(placement?.yCm) || 0) + (vertical ? width / 2 : 0),
  };
}

function placementFromMemberCenter(moduleState, template, centerXCm, centerYCm, rotationZDeg) {
  const width = Number(moduleState?.widthCm) || 0;
  const vertical = isVerticalModuleRotation(rotationZDeg);
  return {
    ...template,
    xCm: vertical ? centerXCm : centerXCm - width / 2,
    yCm: vertical ? centerYCm - width / 2 : centerYCm,
    rotationZDeg,
    wallId: 'free',
  };
}

// Dönmüş kaplama alanının yarı ölçüleri (en × derinlik).
function memberHalfExtentsCm(moduleState, rotationZDeg) {
  const width = Number(moduleState?.widthCm) || 0;
  const depth = boundaryDepthCm(moduleState) ?? 0;
  const radians = normalizeRotation(rotationZDeg) * Math.PI / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  return { halfX: (cos * width + sin * depth) / 2, halfY: (sin * width + cos * depth) / 2 };
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
    const center = memberCenterCm(moduleState, placement);
    const { halfX, halfY } = memberHalfExtentsCm(moduleState, placement.rotationZDeg);
    minX = Math.min(minX, center.xCm - halfX);
    maxX = Math.max(maxX, center.xCm + halfX);
    minY = Math.min(minY, center.yCm - halfY);
    maxY = Math.max(maxY, center.yCm + halfY);
  });
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY, widthCm: maxX - minX, depthCm: maxY - minY };
}

// Dik açıda (0/90/180/270) 0,01 cm; ara açıda (45°) 1e-6 cm. Ara açıdaki ince değer, ikinci
// 45° ile dik açıya dönünce birikmiş yuvarlama bırakmaz (iki 45° sonrası 649,99 değil 650).
const ROTATION_ROUND_CARDINAL = 100;
const ROTATION_ROUND_INTERMEDIATE = 1e6;
// Dik açıda grup bu ızgaraya oturtulur (en çok yarım adım ortak kaydırma).
export const GROUP_ROTATE_GRID_CM = 5;
const GRID_MATCH_TOLERANCE_CM = 0.05;
const ROTATION_SUBSTEP_DEG = 45;

function roundCmTo(value, scale) {
  return Math.round(value * scale) / scale;
}

function snapGridCm(value) {
  return Math.round(value / GROUP_ROTATE_GRID_CM) * GROUP_ROTATE_GRID_CM;
}

function isCardinalRotation(rotationZDeg) {
  return rotationZDeg % 90 === 0;
}

// Ortalama etrafında tam hassasiyetle bir adım döndürür (yuvarlama yok).
function rotateStateAroundMean(state, deltaDeg) {
  const meanX = state.reduce((sum, entry) => sum + entry.xCm, 0) / state.length;
  const meanY = state.reduce((sum, entry) => sum + entry.yCm, 0) / state.length;
  const radians = deltaDeg * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const next = state.map((entry) => {
    const dx = entry.xCm - meanX;
    const dy = entry.yCm - meanY;
    return {
      xCm: meanX + dx * cos + dy * sin,
      yCm: meanY - dx * sin + dy * cos,
      rotationZDeg: normalizeRotation(entry.rotationZDeg + deltaDeg),
    };
  });
  return { next, pivot: { xCm: meanX, yCm: meanY } };
}

// Bütün üyeler dik açıdaysa ve aynı ortak kaydırmayla ızgaraya oturuyorsa, o kaydırmanın
// adayları (önce en küçük). Grup kendi içinde ızgaraya uymuyorsa aday yok: grup olduğu gibi kalır.
function gridShiftCandidates(state) {
  if (!state.every((entry) => isCardinalRotation(entry.rotationZDeg))) return [];
  const [first] = state;
  const baseX = snapGridCm(first.xCm) - first.xCm;
  const baseY = snapGridCm(first.yCm) - first.yCm;
  const fits = state.every((entry) => (
    Math.abs(snapGridCm(entry.xCm + baseX) - (entry.xCm + baseX)) < GRID_MATCH_TOLERANCE_CM
    && Math.abs(snapGridCm(entry.yCm + baseY) - (entry.yCm + baseY)) < GRID_MATCH_TOLERANCE_CM
  ));
  if (!fits) return [];
  const step = GROUP_ROTATE_GRID_CM;
  const xs = [baseX, baseX > 0 ? baseX - step : baseX + step];
  const ys = [baseY, baseY > 0 ? baseY - step : baseY + step];
  return xs.flatMap((dx) => ys.map((dy) => ({ dx, dy })))
    .sort((a, b) => Math.hypot(a.dx, a.dy) - Math.hypot(b.dx, b.dy));
}

function placementsFromState(placed, state, shift, stand) {
  const placements = new Map();
  for (let index = 0; index < placed.length; index += 1) {
    const moduleState = placed[index];
    const entry = state[index];
    const centerX = shift
      ? snapGridCm(entry.xCm + shift.dx)
      : roundCmTo(entry.xCm, isCardinalRotation(entry.rotationZDeg) ? ROTATION_ROUND_CARDINAL : ROTATION_ROUND_INTERMEDIATE);
    const centerY = shift
      ? snapGridCm(entry.yCm + shift.dy)
      : roundCmTo(entry.yCm, isCardinalRotation(entry.rotationZDeg) ? ROTATION_ROUND_CARDINAL : ROTATION_ROUND_INTERMEDIATE);
    const next = placementFromMemberCenter(moduleState, moduleState.placement, centerX, centerY, entry.rotationZDeg);
    if (!memberInsideStand(moduleState, next, stand)) return null;
    placements.set(moduleState.id, next);
  }
  return placements;
}

/**
 * Grubu döndürme planı (kullanıcı kararı 2026-11-11). Grup üye merkezlerinin ortalaması
 * etrafında, 45° katı açılar 45°'lik ara adımlarla döner. Bütün üyeler dik açıya (0/90/180/270)
 * gelince grup en küçük ortak kaydırmayla (her eksende en çok 2,5 cm) 5 cm ızgaraya oturur:
 * ham ortalama çoğu zaman ızgara dışıdır ve grubu 632,85 gibi konumlara düşürüyordu.
 * Bedeli: art arda tam tur döndürmede grup nadiren birkaç cm kayabilir.
 * Her üyenin konumu merkez etrafında çevrilir ve açısına aynı derece eklenir
 * (sahne: rotationZDeg Three.js world-Y yaw; x' = x cos + y sin, y' = -x sin + y cos).
 * Tek kısıt: döndürülmüş her üye aktif stand alanında kalmalı; tür kuralları aranmaz.
 */
export function planPlacementsRotate(members = [], deltaDeg, stand) {
  const placed = members.filter((moduleState) => moduleState?.placement);
  if (!placed.length) return { ok: false, message: 'Grup bulunamadı.', placements: new Map() };
  const delta = Number(deltaDeg) || 0;
  const substeps = delta !== 0 && delta % ROTATION_SUBSTEP_DEG === 0
    ? Array(Math.abs(delta) / ROTATION_SUBSTEP_DEG).fill(Math.sign(delta) * ROTATION_SUBSTEP_DEG)
    : [delta];
  let state = placed.map((moduleState) => ({
    ...memberCenterCm(moduleState),
    rotationZDeg: normalizeRotation(moduleState.placement.rotationZDeg),
  }));
  let pivot = null;
  for (const stepDeg of substeps) {
    const rotated = rotateStateAroundMean(state, stepDeg);
    pivot ??= rotated.pivot;
    state = rotated.next;
    // Ara adımda dik açıya gelindiyse ızgaraya oturt; sonraki adım ızgaradan başlar.
    const [shift] = gridShiftCandidates(state);
    if (shift) state = state.map((entry) => ({ ...entry, xCm: snapGridCm(entry.xCm + shift.dx), yCm: snapGridCm(entry.yCm + shift.dy) }));
  }
  // Son durum: önce ızgaraya oturmuş hali (state zaten oturtulmuşsa kaydırma 0); sığmazsa komşu
  // ızgara kaydırmaları, en son kaydırmasız.
  for (const shift of [...gridShiftCandidates(state), null]) {
    const placements = placementsFromState(placed, state, shift, stand);
    if (placements) return { ok: true, placements, pivot };
  }
  return { ok: false, message: GROUP_ROTATE_OUTSIDE_STAND_MESSAGE, placements: new Map() };
}

export function planGroupRotate(modules = [], groupId, deltaDeg, stand) {
  const members = getGroupMembers(modules, groupId);
  if (!members.length) return { ok: false, message: 'Grup bulunamadı.', placements: new Map() };
  if (members.some(isGroupLocked)) return { ok: false, message: GROUP_LOCKED_MESSAGE, placements: new Map() };
  return planPlacementsRotate(members, deltaDeg, stand);
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
  remapCopiedSurfaceGroups(members, clones);
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
