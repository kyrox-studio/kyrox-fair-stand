// Modül kilidi: proje örneğinin (Item instance) yerinde sabitlenmesi.
// Kilit bir ürün/BOM özelliği değildir; bütün tiplere aynı uygulanır.
// Kilitli modül taşınmaz, döndürülmez, boyutlandırılmaz, silinmez ve başka bir
// işlemin planı (zincir kaydırması, yanına ekleme) onu yerinden oynatamaz.
// Görünüm (renk, görsel, cam, separatör, kumaş) kilitliyken de değiştirilebilir.

const PLACEMENT_EPSILON_CM = 0.001;

export const MODULE_LOCKED_MESSAGE = 'Bu öğe kilitli. Değiştirmek için önce sağ tık > Kilidi aç.';

// Öğe kendi kilidiyle ya da kilitli bir grubun üyesi olarak kilitli sayılır
// (grup bilgisi: moduleGroups.js).
export function isModuleLocked(moduleState) {
  return moduleState?.locked === true || moduleState?.group?.locked === true;
}

// Toplu kilit kontrolü grup kilidini de gerçek kilit durumuna dahil eder.
export function getModulesLockState(modules = []) {
  const total = modules.length;
  const locked = modules.filter(isModuleLocked).length;
  return { total, locked, allLocked: total > 0 && locked === total, partiallyLocked: locked > 0 && locked < total };
}

/** Toplu silme atomiktir: seçimde kilit varsa hiçbir öğe silinmez. */
export function planSelectionRemoval(modules = [], moduleIds = []) {
  const ids = new Set(moduleIds);
  const selected = modules.filter((moduleState) => ids.has(moduleState.id));
  const blockedIds = selected.filter(isModuleLocked).map((moduleState) => moduleState.id);
  return { ok: selected.length > 0 && blockedIds.length === 0, moduleIds: selected.map((moduleState) => moduleState.id), blockedIds };
}

/** Modülleri kilitler ya da kilidini açar; değişen modül sayısını döndürür. */
export function setModulesLocked(modules = [], moduleIds = [], locked = true) {
  const ids = new Set(moduleIds);
  let changed = 0;
  modules.forEach((moduleState) => {
    if (!moduleState || !ids.has(moduleState.id)) return;
    if (locked) {
      if (moduleState.locked === true) return;
      moduleState.locked = true;
    } else {
      if (!Object.hasOwn(moduleState, 'locked')) return;
      delete moduleState.locked;
    }
    changed += 1;
  });
  return changed;
}

/** Çoğaltılan modül kilitsiz doğar. */
export function clearDuplicateLock(moduleState) {
  if (moduleState && Object.hasOwn(moduleState, 'locked')) delete moduleState.locked;
  return moduleState;
}

function normalizeRotation(value) {
  const deg = Number(value) || 0;
  return ((deg % 360) + 360) % 360;
}

function samePlacement(a, b) {
  if (!a || !b) return a === b;
  const near = (x, y) => Math.abs((Number(x) || 0) - (Number(y) || 0)) <= PLACEMENT_EPSILON_CM;
  return near(a.xCm, b.xCm)
    && near(a.yCm, b.yCm)
    && near(a.zCm, b.zCm)
    && normalizeRotation(a.rotationZDeg) === normalizeRotation(b.rotationZDeg);
}

/**
 * Bir yerleşim planı kilitli bir modülü yerinden oynatıyor mu?
 * `placements`: Map<moduleId, placement> (plan çıktısı). Yalnız geometri karşılaştırılır;
 * planların duvar kenarı için yeniden çözdüğü `wallId` etiketi yer değişikliği sayılmaz.
 * Dönen dizi engelleyen kilitli modüllerdir.
 */
export function findLockedModuleMoves(placements, modules = []) {
  if (!(placements instanceof Map) || !placements.size) return [];
  const byId = new Map(modules.filter(Boolean).map((moduleState) => [moduleState.id, moduleState]));
  const blocked = [];
  placements.forEach((placement, moduleId) => {
    const moduleState = byId.get(moduleId);
    if (!isModuleLocked(moduleState)) return;
    if (!samePlacement(moduleState.placement, placement)) blocked.push(moduleState);
  });
  return blocked;
}

export function describeLockedBlock(blockedModules = []) {
  const count = blockedModules.length;
  if (!count) return null;
  return count === 1
    ? 'Bu işlem kilitli bir öğeyi yerinden oynatacağı için yapılamadı. Önce kilidini açın.'
    : `Bu işlem ${count} kilitli öğeyi yerinden oynatacağı için yapılamadı. Önce kilitlerini açın.`;
}

/**
 * Plan sonucunu kilitlere göre süzer: plan kilitli bir modülü oynatıyorsa
 * `{ ok: false, message, lockedModuleIds }` döner, yoksa planı aynen döndürür.
 */
export function guardPlanAgainstLocks(plan, modules = []) {
  if (!plan?.ok) return plan;
  const blocked = findLockedModuleMoves(plan.placements, modules);
  if (!blocked.length) return plan;
  return {
    ok: false,
    message: describeLockedBlock(blocked),
    lockedModuleIds: blocked.map((moduleState) => moduleState.id),
    placements: new Map(),
  };
}
