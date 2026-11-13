/**
 * Köşe birleşiminin sahne çizimi için okunması (yalnız renderer; BOM'u değiştirmez).
 *
 * Üretim listesi dik köşede iki modülün ortak tek dikmesini sayar (`relationshipBom.js`: tam boy
 * duvar / kapı / separatör / vitrin için `detectRelationshipJoints`, kısa duvar için
 * `detectShortCornerJoints`). Renderer her modülü tek başına çizdiğinde iki uç dikme köşede yarı
 * yarıya biner ve dışarıdan basamaklı "+" çıkıntısı görünür. Bu modül aynı eklem tespitini okuyup
 * her modül için köşedeki ucunu yerel eksende verir; renderer o uçta kendi dikmesini çizmez, ortak
 * dikmeyi eklemin sahibi duvar çizgilerinin kesişiminde çizer.
 */
import { detectRelationshipJoints, detectShortCornerJoints } from './relationshipBom.js';
import { isWallShortFamilyDescriptor } from './items.js';
import {
  getModuleFootprintBoundsCm,
  isProfileFlushOnFrameEnd,
  normalizeModuleRotationZDeg,
} from './modulePlacement.js';

// Ortak dikmeyi kim çizer: tam boy dikmesi kesintisiz olan önce. Vitrinde dikme gövde boyunca
// kesik çizildiği için vitrin yalnız iki vitrin buluşunca sahip olur.
const POST_OWNER_RANK = Object.freeze({
  'flat-panel': 0,
  door: 0,
  separator: 1,
  'showcase-2': 2,
  'showcase-3': 2,
});

function moduleKey(module, index) {
  return module?.id ?? `idx:${index}`;
}

function segmentCenter(participant) {
  const along = (participant.startCm + participant.endCm) / 2;
  return participant.axis === 'x'
    ? { xCm: along, yCm: participant.fixedCm }
    : { xCm: participant.fixedCm, yCm: along };
}

function signOf(value) {
  if (value > 1e-6) return 1;
  if (value < -1e-6) return -1;
  return 0;
}

// Plan düzleminde yerel eksenler: ön yüz (+z) = (frontX, frontY); yerel +x = (frontY, −frontX)
// (Three.js Y dönüşü `applyPlacementToGroup` ile aynı yön).
function localXSignAt(participant, point) {
  const center = segmentCenter(participant);
  return signOf((point.xCm - center.xCm) * participant.frontY - (point.yCm - center.yCm) * participant.frontX);
}

function ownerRank(module) {
  return POST_OWNER_RANK[module?.type] ?? null;
}

/**
 * Paneller uzamaz (kullanıcı kararı 2026-11-12): köşede yalnız dikme ortaklaşır.
 * @returns {Map<string, Array<{
 *   localXSign: -1|1,  // köşenin modül yerel x ekseninde hangi uçta olduğu
 *   ownsPost: boolean, // ortak dikmeyi bu modül çizer
 * }>>}
 */
export function resolveWallCornerEnds(modules = []) {
  const list = Array.isArray(modules) ? modules : [];
  const byKey = new Map(list.map((module, index) => [moduleKey(module, index), module]));
  const result = new Map();

  const addCorner = (point, first, second, ownerId) => {
    const modA = byKey.get(first.moduleId);
    const modB = byKey.get(second.moduleId);
    if (ownerRank(modA) == null || ownerRank(modB) == null) return;
    const signs = [first, second].map((self) => localXSignAt(self, point));
    if (signs.some((sign) => !sign)) return;
    [first, second].forEach((self, index) => {
      const existing = result.get(self.moduleId) ?? [];
      if (existing.some((end) => end.localXSign === signs[index])) return;
      existing.push(Object.freeze({ localXSign: signs[index], ownsPost: self.moduleId === ownerId }));
      result.set(self.moduleId, existing);
    });
  };

  let joints = [];
  let shortJoints = [];
  try {
    joints = detectRelationshipJoints(list);
    shortJoints = detectShortCornerJoints(list);
  } catch {
    return result;
  }

  for (const joint of joints) {
    if (joint.kind !== 'corner' || !joint.point) continue;
    const [first, second] = joint.participants;
    const rankA = ownerRank(byKey.get(first.moduleId));
    const rankB = ownerRank(byKey.get(second.moduleId));
    if (rankA == null || rankB == null) continue;
    // participants kimliğe göre sıralıdır: eşit sırada küçük kimlik çizer.
    const ownerId = rankB < rankA ? second.moduleId : first.moduleId;
    addCorner(joint.point, first, second, ownerId);
  }
  // Kısa duvar köşesi: üretim listesinin tuttuğu dikme (uzun / kapsayan modül) ortak dikmedir.
  for (const joint of shortJoints) {
    addCorner(joint.point, joint.kept, joint.dropped, joint.kept.moduleId);
  }
  addFramePostEnds(list, result);
  return result;
}

const EPSILON_CM = 0.01;
const roundCm = (value) => Math.round(value * 100) / 100;

function isCardinal(module) {
  return normalizeModuleRotationZDeg(module?.placement?.rotationZDeg) % 90 === 0;
}

// Yerel +x'in plan yönü (`applyPlacementToGroup`: dünya x = plan x, dünya z = plan y, Y dönüşü).
function localXSignOfPoint(module, bounds, point) {
  const theta = normalizeModuleRotationZDeg(module.placement.rotationZDeg) * Math.PI / 180;
  const centerX = (bounds.minXCm + bounds.maxXCm) / 2;
  const centerY = (bounds.minYCm + bounds.maxYCm) / 2;
  return signOf((point.xCm - centerX) * Math.cos(theta) - (point.yCm - centerY) * Math.sin(theta));
}

function zRangeCm(module) {
  const bottom = Number(module?.placement?.zCm) || 0;
  return { bottom, top: bottom + (Number(module?.heightCm) || 0) };
}

function pushEnd(result, moduleId, end) {
  const existing = result.get(moduleId) ?? [];
  if (existing.some((entry) => entry.localXSign === end.localXSign)) return;
  existing.push(Object.freeze(end));
  result.set(moduleId, existing);
}

/** Profil `target`'ın ucunda dış yüzden hizalıysa o uçta hedefin kalınlığı kadar kısa çizilir. */
function pushProfileTrim(result, profile, target) {
  const bounds = getModuleFootprintBoundsCm(target);
  const profileBounds = getModuleFootprintBoundsCm(profile);
  if (!bounds || !profileBounds) return;
  const targetCenter = { xCm: (bounds.minXCm + bounds.maxXCm) / 2, yCm: (bounds.minYCm + bounds.maxYCm) / 2 };
  const localXSign = localXSignOfPoint(profile, profileBounds, targetCenter);
  if (!localXSign) return;
  const alongX = profileBounds.maxXCm - profileBounds.minXCm > profileBounds.maxYCm - profileBounds.minYCm;
  const trimCm = roundCm(alongX ? bounds.maxXCm - bounds.minXCm : bounds.maxYCm - bounds.minYCm);
  pushEnd(result, profile.id, { localXSign, trimCm });
}

/**
 * Çerçeve köşelerinde tek kare (2026-11-12, yalnız çizim; BOM aynı):
 * - Short'un ucunda (kesit karesinde, yükseklikte short'a değen) bağımsız dikme varsa short o uçta
 *   kendi dikmesini çizmez, rayı dikmenin iç yüzünde biter: `{ localXSign, postWidthCm }`.
 * - Short ucundaki dikmenin üstüne binen profil short'un iç yüzünde biter: `{ localXSign, trimCm }`.
 * - Dış yüzden hizalı iki profilin L köşesinde kareyi uzun profil (eşitse küçük kimlik) çizer; diğeri
 *   onun iç yüzünde biter.
 * Köşe karesinde tek parça görünür; yüzler üst üste binip çift çizgi vermez.
 */
function addFramePostEnds(list, result) {
  const shorts = list.filter((module) => module?.id && module.placement
    && isWallShortFamilyDescriptor(module) && isCardinal(module));
  const uprights = list.filter((module) => module?.id && module.placement
    && module.type === 'upright' && isCardinal(module));
  const profiles = list.filter((module) => module?.id && module.placement
    && module.type === 'profile' && isCardinal(module));

  for (const wall of shorts) {
    const bounds = getModuleFootprintBoundsCm(wall);
    if (!bounds) continue;
    const wallZ = zRangeCm(wall);
    for (const upright of uprights) {
      const post = getModuleFootprintBoundsCm(upright);
      if (!post) continue;
      const inside = post.minXCm >= bounds.minXCm - EPSILON_CM && post.maxXCm <= bounds.maxXCm + EPSILON_CM
        && post.minYCm >= bounds.minYCm - EPSILON_CM && post.maxYCm <= bounds.maxYCm + EPSILON_CM;
      if (!inside) continue;
      const postZ = zRangeCm(upright);
      if (postZ.top <= wallZ.bottom + EPSILON_CM || postZ.bottom >= wallZ.top - EPSILON_CM) continue;
      const alongX = bounds.maxXCm - bounds.minXCm > bounds.maxYCm - bounds.minYCm;
      const atEnd = alongX
        ? Math.abs(post.minXCm - bounds.minXCm) < EPSILON_CM || Math.abs(post.maxXCm - bounds.maxXCm) < EPSILON_CM
        : Math.abs(post.minYCm - bounds.minYCm) < EPSILON_CM || Math.abs(post.maxYCm - bounds.maxYCm) < EPSILON_CM;
      if (!atEnd) continue;
      const point = { xCm: (post.minXCm + post.maxXCm) / 2, yCm: (post.minYCm + post.maxYCm) / 2 };
      const localXSign = localXSignOfPoint(wall, bounds, point);
      if (!localXSign) continue;
      const postWidthCm = roundCm(alongX ? post.maxXCm - post.minXCm : post.maxYCm - post.minYCm);
      pushEnd(result, wall.id, { localXSign, postWidthCm });
    }
    for (const profile of profiles) {
      if (isProfileFlushOnFrameEnd(profile, wall)) pushProfileTrim(result, profile, wall);
    }
  }

  profiles.forEach((first, index) => {
    profiles.slice(index + 1).forEach((second) => {
      if (!isProfileFlushOnFrameEnd(first, second) || !isProfileFlushOnFrameEnd(second, first)) return;
      const firstWidth = Number(first.widthCm) || 0;
      const secondWidth = Number(second.widthCm) || 0;
      const firstOwns = firstWidth > secondWidth
        || (firstWidth === secondWidth && String(first.id) < String(second.id));
      if (firstOwns) pushProfileTrim(result, second, first);
      else pushProfileTrim(result, first, second);
    });
  });
}
