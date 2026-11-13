// İki nokta profil: sahnede iki uç seçilir, araya tek profil konur.
// Kullanıcı kararı (2026-11-12): boy, iki nokta arasına en yakın katalog sahne boyudur (tam denk
// gelmezse de tek profil). Uçlar dikmedir: tek başına dikme (upright), profil ucu ve uçlarında
// dikme olan duvar ailesi (duvar / kısa duvar, separatör, kapı, vitrin) uçları. "Bir ucu boşta"
// sonraki adım. Profil iki noktanın ortasına, aynı hatta konur; yerleşim katalog bırakma
// kuralından geçer.
import { UPRIGHT_REAL_HEIGHT_RATIO } from './catalogWidthFamily.js';
import { getModuleFootprintBoundsCm, getModuleGroundSegments } from './modulePlacement.js';

// Uçlarında dikme olan duvar ailesi tipleri.
const POSTED_WALL_TYPES = new Set(['flat-panel', 'separator', 'door', 'showcase-2', 'showcase-3']);

export const TWO_POINT_PICK_RADIUS_CM = 30;
// Dikme köşeye birkaç cm kayık durabilir (2026-11-12 köşe dikmesi–duvar ucu reddediliyordu):
// iki ucun hattı seçme yarıçapı kadar kayık olabilir; profil ilk seçilen ucun hattına konur.
const ALIGN_TOLERANCE_CM = TWO_POINT_PICK_RADIUS_CM;
const SAME_POINT_CM = 1;

function isUprightModule(module) {
  return module?.type === 'upright';
}

function isProfileModule(module) {
  return module?.type === 'profile';
}

function segmentEndPoints(module, kind, topZCm) {
  return getModuleGroundSegments(module).flatMap((segment) => [segment.startCm, segment.endCm].map((alongCm) => ({
    xCm: segment.axis === 'x' ? alongCm : segment.fixedCm,
    yCm: segment.axis === 'x' ? segment.fixedCm : alongCm,
    kind,
    moduleId: module.id,
    topZCm,
    axis: segment.axis,
  })));
}

/** Seçilebilen uç noktalar: dikme merkezi, profilin iki ucu ve dikmeli duvar ailesinin iki ucu. */
export function listProfileAnchorPoints(modules = []) {
  const points = [];
  for (const module of modules) {
    const bounds = getModuleFootprintBoundsCm(module);
    if (!bounds) continue;
    const centerXCm = (bounds.minXCm + bounds.maxXCm) / 2;
    const centerYCm = (bounds.minYCm + bounds.maxYCm) / 2;
    const topZCm = topOfModuleCm(module);
    if (isUprightModule(module)) {
      points.push({ xCm: centerXCm, yCm: centerYCm, kind: 'upright', moduleId: module.id, topZCm });
    } else if (POSTED_WALL_TYPES.has(module.type)) {
      points.push(...segmentEndPoints(module, 'wall-post', topZCm));
    } else if (isProfileModule(module)) {
      const alongX = bounds.maxXCm - bounds.minXCm >= bounds.maxYCm - bounds.minYCm;
      if (alongX) {
        points.push({ xCm: bounds.minXCm, yCm: centerYCm, kind: 'profile-end', moduleId: module.id, topZCm, axis: 'x' });
        points.push({ xCm: bounds.maxXCm, yCm: centerYCm, kind: 'profile-end', moduleId: module.id, topZCm, axis: 'x' });
      } else {
        points.push({ xCm: centerXCm, yCm: bounds.minYCm, kind: 'profile-end', moduleId: module.id, topZCm, axis: 'y' });
        points.push({ xCm: centerXCm, yCm: bounds.maxYCm, kind: 'profile-end', moduleId: module.id, topZCm, axis: 'y' });
      }
    }
  }
  return points;
}

// Profil gövdesinde seçim adımı (profilin profile T bağlandığı adımla aynı: modulePlacement
// PROFILE_TEE_SNAP_STEP_CM).
const PROFILE_BODY_STEP_CM = 10;

/**
 * Gövdeler (kullanıcı isteği 2026-11-13: dikme → profil, profil → dikme, profil → profil, profil →
 * karşı duvar): profilin ortasına ve duvar ailesinin üst rayına her noktada T bağlanılır (karar
 * 2026-11-11, modulePlacement profileOnWallRail). Her gövde zemin ekseni + tepe yüksekliğidir.
 */
export function listProfileBodies(modules = []) {
  const bodies = [];
  for (const module of modules) {
    if (!isProfileModule(module) && !POSTED_WALL_TYPES.has(module?.type)) continue;
    const topZCm = topOfModuleCm(module);
    for (const segment of getModuleGroundSegments(module)) {
      bodies.push({
        axis: segment.axis,
        fixedCm: segment.fixedCm,
        startCm: Math.min(segment.startCm, segment.endCm),
        endCm: Math.max(segment.startCm, segment.endCm),
        moduleId: module.id,
        topZCm,
      });
    }
  }
  return bodies;
}

function bodyPoint(body, alongCm) {
  return {
    xCm: body.axis === 'x' ? alongCm : body.fixedCm,
    yCm: body.axis === 'x' ? body.fixedCm : alongCm,
    kind: 'profile-body',
    moduleId: body.moduleId,
    topZCm: body.topZCm,
    body,
  };
}

/**
 * Gövde ucu: öbür uç (other) verilirse onun gövde üzerindeki dik izdüşümü (iki nokta kendiliğinden
 * aynı hatta gelir); izdüşüm gövdenin dışındaysa ya da öbür uç yoksa imleç (xCm, yCm) 10 cm adımla.
 */
export function profileBodyAnchor(body, xCm, yCm, other = null) {
  if (other) {
    const otherAlong = body.axis === 'x' ? other.xCm : other.yCm;
    if (otherAlong >= body.startCm - 0.5 && otherAlong <= body.endCm + 0.5) {
      return bodyPoint(body, Math.min(body.endCm, Math.max(body.startCm, otherAlong)));
    }
  }
  const along = body.axis === 'x' ? xCm : yCm;
  const snapped = body.startCm + Math.round((along - body.startCm) / PROFILE_BODY_STEP_CM) * PROFILE_BODY_STEP_CM;
  return bodyPoint(body, Math.min(body.endCm, Math.max(body.startCm, snapped)));
}

/** Gövde ucunu öbür uca göre yeniden hizalar (gövde ucu değilse olduğu gibi döner). */
export function alignProfileBodyAnchor(anchor, other) {
  if (anchor?.kind !== 'profile-body' || !anchor.body || !other) return anchor;
  return profileBodyAnchor(anchor.body, anchor.xCm, anchor.yCm, other);
}

/**
 * İmleçteki uç: önce uç noktaları (dikme, profil ucu, duvar ucu), yoksa en yakın profil gövdesi.
 * other: seçilmiş ilk uç (gövde ucu onun izdüşümüne oturur).
 */
export function findProfileAnchorAt(modules, xCm, yCm, other = null, radiusCm = TWO_POINT_PICK_RADIUS_CM) {
  const point = findNearestProfileAnchor(listProfileAnchorPoints(modules), xCm, yCm, radiusCm);
  if (point) return point;
  let best = null;
  let bestDistance = Infinity;
  for (const body of listProfileBodies(modules)) {
    const along = body.axis === 'x' ? xCm : yCm;
    const across = body.axis === 'x' ? yCm : xCm;
    if (along < body.startCm - radiusCm || along > body.endCm + radiusCm) continue;
    const distance = Math.abs(across - body.fixedCm);
    if (distance <= radiusCm && distance < bestDistance) {
      best = body;
      bestDistance = distance;
    }
  }
  return best ? profileBodyAnchor(best, xCm, yCm, other) : null;
}

/** İmlece en yakın uç; yarıçap dışındaysa null. */
export function findNearestProfileAnchor(points, xCm, yCm, radiusCm = TWO_POINT_PICK_RADIUS_CM) {
  let best = null;
  let bestDistance = Infinity;
  for (const point of points) {
    const distance = Math.hypot(point.xCm - xCm, point.yCm - yCm);
    if (distance <= radiusCm && distance < bestDistance) {
      best = point;
      bestDistance = distance;
    }
  }
  return best;
}

// Tepe: dikmede karşılık gelen duvar hattı (346,5 → 350, 99 → 100; boy penceresiyle aynı),
// böylece profil duvar tepesindeki varsayılan profille aynı Z'ye oturur.
function topOfModuleCm(module) {
  const zCm = Number(module?.placement?.zCm ?? 0);
  let heightCm = Number(module?.heightCm);
  if (!Number.isFinite(zCm) || !Number.isFinite(heightCm)) return null;
  if (isUprightModule(module)) heightCm = Math.round(heightCm / UPRIGHT_REAL_HEIGHT_RATIO);
  return zCm + heightCm;
}

/** Profilin alt Z'si: üstü ilk seçilen ucun tepesiyle aynı hizada (dikme tepesi / profil üstü). */
export function resolveTwoPointProfileZCm(start, end, profileHeightCm) {
  const top = Number.isFinite(start?.topZCm) ? start.topZCm : end?.topZCm;
  const height = Number(profileHeightCm);
  if (!Number.isFinite(top) || !Number.isFinite(height)) return null;
  return Math.max(0, top - height);
}

function sceneLengthCm(item) {
  return Number(item?.sceneDimensions?.widthCm ?? item?.dimensions?.widthCm);
}

/**
 * İki uç arasına konacak profil. Sonuç: { ok, itemKey, centerXCm, centerYCm, rotationZDeg,
 * distanceCm, lengthCm } ya da { ok: false, message }.
 * items: sahnede çizilebilen profil boyları (listProfileLengthItems).
 */
export function resolveTwoPointProfile(start, end, items = []) {
  if (!start || !end) return { ok: false, message: 'İki nokta seçilmedi.' };
  const dx = end.xCm - start.xCm;
  const dy = end.yCm - start.yCm;
  const alongX = Math.abs(dy) <= ALIGN_TOLERANCE_CM && Math.abs(dx) > Math.abs(dy);
  const alongY = Math.abs(dx) <= ALIGN_TOLERANCE_CM && Math.abs(dy) >= Math.abs(dx);
  if (Math.hypot(dx, dy) <= SAME_POINT_CM) return { ok: false, message: 'İki farklı nokta seç.' };
  if (!alongX && !alongY) {
    return { ok: false, message: 'İki nokta aynı hatta olmalı (yatay ya da dikey).' };
  }
  const distanceCm = alongX ? Math.abs(dx) : Math.abs(dy);
  let best = null;
  for (const item of items) {
    const lengthCm = sceneLengthCm(item);
    if (!Number.isFinite(lengthCm) || lengthCm <= 0) continue;
    const diff = Math.abs(lengthCm - distanceCm);
    // Eşit uzaklıkta kısa boy seçilir (taşma yerine boşluk).
    if (!best || diff < best.diff - 1e-6 || (Math.abs(diff - best.diff) <= 1e-6 && lengthCm < best.lengthCm)) {
      best = { item, lengthCm, diff };
    }
  }
  if (!best) return { ok: false, message: 'Katalogda çizilebilen profil boyu yok.' };
  return {
    ok: true,
    itemKey: best.item.itemKey,
    centerXCm: alongX ? (start.xCm + end.xCm) / 2 : start.xCm,
    centerYCm: alongX ? start.yCm : (start.yCm + end.yCm) / 2,
    rotationZDeg: alongX ? 0 : 90,
    distanceCm,
    lengthCm: best.lengthCm,
  };
}

// Uçtaki gövdenin yarı kesiti: profil dikme / profil / duvar yüzünden başlar (iki uç arası profilde
// merkezler arası uzaklıktan bir kesit kısa boy seçilmesiyle aynı sonuç).
const FREE_END_START_OFFSET_CM = 5;

function nearestLengthItem(distanceCm, items) {
  let best = null;
  for (const item of items) {
    const lengthCm = sceneLengthCm(item);
    if (!Number.isFinite(lengthCm) || lengthCm <= 0) continue;
    const diff = Math.abs(lengthCm - distanceCm);
    if (!best || diff < best.diff - 1e-6 || (Math.abs(diff - best.diff) <= 1e-6 && lengthCm < best.lengthCm)) {
      best = { item, lengthCm, diff };
    }
  }
  return best;
}

/**
 * Bir ucu boşta profil (kullanıcı isteği 2026-11-13): ilk uçtan imlece doğru, imlecin daha çok
 * kaydığı eksende (yatay / dikey) uzanır; boy uzaklığa en yakın katalog boyudur. Profil ilk uca değer:
 * dikme ve gövde uçlarında yüzden (yarı kesit), profil / duvar ucundan aynı hatta uzatılıyorsa uçtan
 * başlar. Sonuç resolveTwoPointProfile ile aynı biçimde, ayrıca boş ucun yeri (endXCm, endYCm).
 */
export function resolveFreeEndProfile(start, cursor, items = []) {
  if (!start || !cursor) return { ok: false, message: 'İki nokta seçilmedi.' };
  const dx = Number(cursor.xCm) - start.xCm;
  const dy = Number(cursor.yCm) - start.yCm;
  const alongX = Math.abs(dx) >= Math.abs(dy);
  const delta = alongX ? dx : dy;
  if (Math.abs(delta) <= SAME_POINT_CM) return { ok: false, message: 'Boş ucu ilk noktadan uzağa bırak.' };
  const axis = alongX ? 'x' : 'y';
  const direction = Math.sign(delta);
  const collinearEnd = (start.kind === 'profile-end' || start.kind === 'wall-post') && start.axis === axis;
  const offsetCm = collinearEnd ? 0 : FREE_END_START_OFFSET_CM;
  const best = nearestLengthItem(Math.abs(delta) - offsetCm, items);
  if (!best) return { ok: false, message: 'Katalogda çizilebilen profil boyu yok.' };
  const faceCm = (alongX ? start.xCm : start.yCm) + direction * offsetCm;
  const centerCm = faceCm + direction * (best.lengthCm / 2);
  const endCm = faceCm + direction * best.lengthCm;
  return {
    ok: true,
    itemKey: best.item.itemKey,
    centerXCm: alongX ? centerCm : start.xCm,
    centerYCm: alongX ? start.yCm : centerCm,
    endXCm: alongX ? endCm : start.xCm,
    endYCm: alongX ? start.yCm : endCm,
    rotationZDeg: alongX ? 0 : 90,
    distanceCm: Math.abs(delta),
    lengthCm: best.lengthCm,
  };
}
