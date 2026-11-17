/**
 * Yan yana baza / banko birleşimi (kullanıcı kararı 2026-11-16).
 * Aynı hatta, aynı derinlik ve yükseklikte uç uca duran iki baza ya da iki düz banko birleşir:
 * - Ortak uçtaki iki dikme ve iki yan profil (41,5) tek sayılır ve tek çizilir. Dikmeleri birleşimin
 *   önceki modülü (hat boyunca başı küçük olan) çizer; sonraki modül o uçta dikme ve yan profil
 *   çizmez, ön rayı birleşim çizgisine kadar uzar.
 * - İki modülün arasında kalan yan paneller (bazada yanak, bankoda alt + üst) ve aparatları düşer;
 *   sahnede çizilmez, panel dökümünde sayılmaz.
 * Baza adetleri `baseRunBom.js` dizi formülündedir; banko adetleri burada modül satırlarından düşülür.
 * L banko birleşmez.
 */

import { getItem } from './items.js';
import { getModuleFootprintBoundsCm, normalizeModuleRotationZDeg } from './modulePlacement.js';

const TOLERANCE_CM = 0.5;

// Yan yüz anahtarları: yerel -x ucu `left`, +x ucu `right` (`createBaseModule` / `createCounterModule`).
const SIDE_FACE_KEYS = Object.freeze({
  base: Object.freeze({ '-1': Object.freeze(['left']), 1: Object.freeze(['right']) }),
  counter: Object.freeze({
    '-1': Object.freeze(['leftLower', 'leftUpper']),
    1: Object.freeze(['rightLower', 'rightUpper']),
  }),
});

function familyOf(module) {
  const item = getItem(module?.itemKey);
  const type = item?.type ?? module?.type;
  if (type === 'base') return 'base';
  if (type === 'counter' && (module?.shape ?? item?.shape) !== 'L') return 'counter';
  return null;
}

function isCardinal(module) {
  return normalizeModuleRotationZDeg(module?.placement?.rotationZDeg) % 90 === 0;
}

function boxFrame(module) {
  const family = familyOf(module);
  if (!family || !module?.id || !module?.placement || !isCardinal(module)) return null;
  const bounds = getModuleFootprintBoundsCm(module);
  if (!bounds) return null;
  const rotation = normalizeModuleRotationZDeg(module.placement.rotationZDeg);
  const axis = rotation % 180 === 0 ? 'x' : 'y';
  const start = axis === 'x' ? bounds.minXCm : bounds.minYCm;
  const end = axis === 'x' ? bounds.maxXCm : bounds.maxYCm;
  const acrossMin = axis === 'x' ? bounds.minYCm : bounds.minXCm;
  const acrossMax = axis === 'x' ? bounds.maxYCm : bounds.maxXCm;
  return {
    module,
    family,
    axis,
    start,
    end,
    acrossMin,
    acrossMax,
    bounds,
    zCm: Number(module.placement.zCm) || 0,
    heightCm: Number(module.heightCm) || Number(getItem(module.itemKey)?.dimensions?.heightCm) || 0,
  };
}

function near(a, b) {
  return Math.abs(a - b) <= TOLERANCE_CM;
}

function framesJoin(a, b) {
  return a.family === b.family
    && a.axis === b.axis
    && near(a.acrossMin, b.acrossMin)
    && near(a.acrossMax, b.acrossMax)
    && near(a.zCm, b.zCm)
    && near(a.heightCm, b.heightCm)
    && near(a.end, b.start);
}

// Yerel +x'in plan yönü (`applyPlacementToGroup`: dünya x = plan x, dünya z = plan y, Y dönüşü).
function localXSignAt(frame, point) {
  const theta = normalizeModuleRotationZDeg(frame.module.placement.rotationZDeg) * Math.PI / 180;
  const centerX = (frame.bounds.minXCm + frame.bounds.maxXCm) / 2;
  const centerY = (frame.bounds.minYCm + frame.bounds.maxYCm) / 2;
  const value = (point.xCm - centerX) * Math.cos(theta) - (point.yCm - centerY) * Math.sin(theta);
  return Math.abs(value) < 1e-6 ? 0 : Math.sign(value);
}

/**
 * Birleşimler: `{ family, point, drawer: { moduleId, localXSign }, skipper: { moduleId, localXSign } }`.
 * `drawer` ortak dikmeleri çizer, `skipper` o uçta dikme ve yan profil çizmez.
 */
export function detectBoxRunJoints(modules = []) {
  const frames = (Array.isArray(modules) ? modules : []).map(boxFrame).filter(Boolean);
  const joints = [];
  for (const first of frames) {
    for (const second of frames) {
      if (first === second || !framesJoin(first, second)) continue;
      const across = (first.acrossMin + first.acrossMax) / 2;
      const point = first.axis === 'x'
        ? { xCm: first.end, yCm: across }
        : { xCm: across, yCm: first.end };
      const drawerSign = localXSignAt(first, point);
      const skipperSign = localXSignAt(second, point);
      if (!drawerSign || !skipperSign) continue;
      joints.push(Object.freeze({
        family: first.family,
        point: Object.freeze(point),
        drawer: Object.freeze({ moduleId: first.module.id, localXSign: drawerSign }),
        skipper: Object.freeze({ moduleId: second.module.id, localXSign: skipperSign }),
      }));
    }
  }
  return joints;
}

/** Modülün birleşim uçları: `{ boxRun: true, localXSign, ownsPost }` (sahne çizimi için). */
export function resolveBoxRunEnds(modules = []) {
  const result = new Map();
  const push = (moduleId, end) => {
    const list = result.get(moduleId) ?? [];
    if (!list.some((entry) => entry.localXSign === end.localXSign)) list.push(Object.freeze(end));
    result.set(moduleId, list);
  };
  for (const joint of detectBoxRunJoints(modules)) {
    push(joint.drawer.moduleId, { boxRun: true, localXSign: joint.drawer.localXSign, ownsPost: true });
    push(joint.skipper.moduleId, { boxRun: true, localXSign: joint.skipper.localXSign, ownsPost: false });
  }
  return result;
}

/** Birleşimde içte kalan yan yüz anahtarları (bazada `left` / `right`, bankoda alt + üst). */
export function boxRunInnerFaceKeys(family, localXSign) {
  return SIDE_FACE_KEYS[family]?.[String(localXSign)] ?? [];
}

function recipeQuantity(lines, predicate) {
  return lines.filter(predicate).reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
}

function subtractLine(lines, itemKey, quantity) {
  if (!itemKey || !(quantity > 0)) return lines;
  let left = quantity;
  return lines
    .map((line) => {
      if (line.itemKey !== itemKey || !(left > 0)) return line;
      const taken = Math.min(left, Number(line.quantity) || 0);
      left -= taken;
      return { ...line, quantity: line.quantity - taken };
    })
    .filter((line) => Number(line.quantity) > 0);
}

/**
 * Modül girdilerine birleşimi uygular: içteki yan yüzler panel yüzeylerinden çıkar (bazada da);
 * bankoda içteki yan paneller ve aparatları (reçetedeki panel başına oran), `skipper` modülde
 * ortak uçtaki iki dikme ve iki yan profil 41,5 satırdan düşer. Baza satırları `baseRunBom.js`'tedir.
 * @param {Array<object>} entries resolveProjectBom modül girdileri
 * @param {Array<object>} modules aynı sıradaki modüller
 * @param {(itemKey: string) => Array<object>} recipeOf modülün tek adet reçete satırları
 */
export function applyBoxRunEntries(entries, modules, recipeOf) {
  const joints = detectBoxRunJoints(modules);
  if (!joints.length) return entries;
  const sidesByModule = new Map();
  const skippedEnds = new Map();
  for (const joint of joints) {
    for (const role of ['drawer', 'skipper']) {
      const { moduleId, localXSign } = joint[role];
      const sides = sidesByModule.get(moduleId) ?? new Set();
      sides.add(localXSign);
      sidesByModule.set(moduleId, sides);
    }
    skippedEnds.set(joint.skipper.moduleId, (skippedEnds.get(joint.skipper.moduleId) ?? 0) + 1);
  }
  const moduleById = new Map((modules ?? []).filter((module) => module?.id).map((module) => [module.id, module]));
  return entries.map((entry) => {
    const sides = sidesByModule.get(entry?.moduleId);
    const module = moduleById.get(entry?.moduleId);
    if (!sides || !module || entry.status !== 'ok') return entry;
    const family = familyOf(module);
    const innerIds = new Set(
      [...sides]
        .flatMap((sign) => boxRunInnerFaceKeys(family, sign))
        .map((key) => module.faces?.[key]?.id)
        .filter(Boolean),
    );
    const surfaces = (entry.panelSurfaces ?? []).filter((surface) => !innerIds.has(surface?.id));
    const dropped = (entry.panelSurfaces ?? []).filter((surface) => innerIds.has(surface?.id));
    let lines = entry.lines.map((line) => ({ ...line }));
    if (family === 'counter') {
      const recipe = recipeOf(module.itemKey) ?? [];
      const panelCount = recipeQuantity(recipe, (line) => getItem(line.itemKey)?.type === 'panel');
      const perPanel = (key) => (panelCount > 0 ? recipeQuantity(recipe, (line) => line.itemKey === key) / panelCount : 0);
      const droppedPanels = dropped.length || sides.size * boxRunInnerFaceKeys(family, 1).length;
      for (const surface of dropped) lines = subtractLine(lines, surface.itemKey, 1);
      lines = subtractLine(lines, 'connector_start', perPanel('connector_start') * droppedPanels);
      lines = subtractLine(lines, 'connector_single', perPanel('connector_single') * droppedPanels);
      const ends = skippedEnds.get(module.id) ?? 0;
      const uprightKey = recipe.map((line) => line.itemKey).find((key) => getItem(key)?.type === 'upright');
      lines = subtractLine(lines, uprightKey, 2 * ends);
      lines = subtractLine(lines, 'profile_41_5', 2 * ends);
    }
    const next = { ...entry, lines: Object.freeze(lines.map((line) => Object.freeze(line))) };
    Object.defineProperty(next, 'panelSurfaces', {
      value: Object.freeze(surfaces),
      enumerable: false,
    });
    return Object.freeze(next);
  });
}
