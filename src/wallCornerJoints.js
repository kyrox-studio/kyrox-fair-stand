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
import {
  detectRelationshipJoints,
  detectShortCornerJoints,
  detectShortEndToEndJoints,
  detectShortProfileRuns,
  detectShortRunInfills,
  detectCornerStackedPosts,
  detectMergedShortPosts,
  detectMergedUprightIds,
} from './relationshipBom.js';
import { getItem, isWallShortFamilyDescriptor, resolveProceduralFrameCrossSectionCm } from './items.js';
import { resolveBoxRunEnds } from './boxRunJoints.js';
import { resolveBaseHostSides } from './baseRunBom.js';
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
  let shortEndJoints = [];
  try {
    joints = detectRelationshipJoints(list);
    shortJoints = detectShortCornerJoints(list);
    shortEndJoints = detectShortEndToEndJoints(list);
  } catch {
    return result;
  }

  // Yan yana (uç uca) birleşim (kullanıcı kararı 2026-11-16): listede ortak tek dikme sayılır; sahnede
  // dikmeyi birleşimin bir tarafı çizer, öbür taraf o uçta dikme çizmez ve rayı birleşim çizgisine
  // kadar uzar (`postWidthCm: 0`). Köşe kaydı varsa o uç köşe kuralında kalır.
  const addSharedEnd = (point, drawer, skipper) => {
    const skipModule = byKey.get(skipper.moduleId);
    if (!skipModule || !point) return;
    // Yalnız ucu bu noktada biten modül dikmesini bırakır (T'de ortasından dik gelinen gövde değil).
    const along = skipper.axis === 'x' ? point.xCm : point.yCm;
    const across = skipper.axis === 'x' ? point.yCm : point.xCm;
    const atEnd = Math.abs(across - skipper.fixedCm) <= 0.5
      && (Math.abs(along - skipper.startCm) <= 0.5 || Math.abs(along - skipper.endCm) <= 0.5);
    if (!atEnd) return;
    const sign = localXSignAt(skipper, point);
    if (!sign) return;
    pushEnd(result, skipper.moduleId, { localXSign: sign, postWidthCm: 0 });
  };

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
  for (const joint of joints) {
    if (joint.kind !== 'end-to-end' || !joint.point) continue;
    const [first, second] = joint.participants;
    const rankA = ownerRank(byKey.get(first.moduleId));
    const rankB = ownerRank(byKey.get(second.moduleId));
    if (rankA == null || rankB == null) continue;
    // Köşe kuralıyla aynı: sırası küçük olan (eşitse küçük kimlik) dikmeyi çizer.
    if (rankB < rankA) addSharedEnd(joint.point, second, first);
    else addSharedEnd(joint.point, first, second);
  }
  // T birleşimi: noktada tek ortak dikme; sırası küçük olan çizer, ucu orada biten diğerleri çizmez.
  for (const joint of joints) {
    if (joint.kind !== 'tee' || !joint.point) continue;
    const ranked = joint.participants
      .map((participant) => ({ participant, rank: ownerRank(byKey.get(participant.moduleId)) }))
      .filter((entry) => entry.rank != null)
      .sort((a, b) => a.rank - b.rank || (a.participant.moduleId < b.participant.moduleId ? -1 : 1));
    const drawer = ranked.find((entry) => {
      const p = entry.participant;
      const along = p.axis === 'x' ? joint.point.xCm : joint.point.yCm;
      return Math.abs(along - p.startCm) <= 0.5 || Math.abs(along - p.endCm) <= 0.5;
    });
    if (!drawer) continue;
    for (const entry of ranked) {
      if (entry !== drawer) addSharedEnd(joint.point, drawer.participant, entry.participant);
    }
  }
  // Kısa panel yan yana: listenin tuttuğu dikmeyi (kept) çizen taraf tutar.
  for (const joint of shortEndJoints) addSharedEnd(joint.point, joint.kept, joint.dropped);
  addFramePostEnds(list, result);
  addShortStackEnds(list, result);
  addShortRailRuns(list, result);
  addRunInfills(list, result);
  addCornerStackPosts(list, result);
  addMergedUprights(list, result);
  addBoxRunEnds(list, result);
  addBaseHostEnds(list, result);
  return result;
}

/**
 * Duvar sırtındaki baza (kullanıcı kararı 2026-11-16): serbest bazada ön ve arka uzun raylar çizilir
 * (4 profil); duvara dayalı bazada duvar tarafındaki uzun ray çizilmez (2 profil, listeyle aynı).
 * `{ baseHost: true, localZSign }`: duvarın bazanın yerel z ekseninde hangi yüzde olduğu (+1 ön).
 */
function addBaseHostEnds(list, result) {
  let sides;
  try {
    sides = resolveBaseHostSides(list);
  } catch {
    return;
  }
  const byId = new Map(list.filter((module) => module?.id).map((module) => [module.id, module]));
  for (const [moduleId, planSide] of sides) {
    const module = byId.get(moduleId);
    if (!module || !isCardinal(module)) continue;
    const theta = normalizeModuleRotationZDeg(module.placement.rotationZDeg) * Math.PI / 180;
    // Yerel +z'nin plan yönü (sin θ, cos θ); baza x hattındaysa dik eksen y, y hattındaysa x.
    const front = Math.round(normalizeModuleRotationZDeg(module.placement.rotationZDeg)) % 180 === 0
      ? Math.cos(theta)
      : Math.sin(theta);
    const localZSign = Math.sign(planSide * front);
    if (!localZSign) continue;
    result.set(moduleId, [...(result.get(moduleId) ?? []), Object.freeze({ baseHost: true, localZSign })]);
  }
}

/** Yan yana baza / banko birleşimi (`boxRunJoints.js`): `{ boxRun: true, localXSign, ownsPost }`. */
function addBoxRunEnds(list, result) {
  let ends;
  try {
    ends = resolveBoxRunEnds(list);
  } catch {
    return;
  }
  for (const [moduleId, entries] of ends) {
    result.set(moduleId, [...(result.get(moduleId) ?? []), ...entries]);
  }
}

/** Aynı yerde uzun bir dikmeyle birleşen dikme (2026-11-20): sahnede çizilmez, listede sayılmaz. */
function addMergedUprights(list, result) {
  let ids = [];
  try {
    ids = detectMergedUprightIds(list);
  } catch {
    return;
  }
  for (const id of ids) result.set(id, [...(result.get(id) ?? []), Object.freeze({ mergedUpright: true })]);
}

/**
 * Köşede binen kısa panel (`detectCornerStackedPosts`, 2026-11-18): o noktadaki tam boy duvar dikmesi
 * kısa panelin tepesine kadar uzar (listede 346,5 + 49,5 → 396). `{ stackPost: true, localXSign, topCm }`.
 */
function addCornerStackPosts(list, result) {
  let posts = [];
  try {
    // Kısa panel kolonunun birleşik dikmesi (farklı genişlikte üst üste kısa paneller, listede 99 /
    // 148,5 ...) da alttaki üyenin dikmesi kolon tepesine uzayarak çizilir.
    posts = [
      ...detectCornerStackedPosts(list),
      ...detectMergedShortPosts(list).map((post) => ({ ...post, hostId: post.bottomId })),
    ];
  } catch {
    return;
  }
  const byId = new Map(list.filter((module) => module?.id).map((module) => [module.id, module]));
  for (const post of posts) {
    const module = byId.get(post.hostId);
    const bounds = module ? getModuleFootprintBoundsCm(module) : null;
    if (!bounds) continue;
    const localXSign = localXSignOfPoint(module, bounds, post.point);
    if (!localXSign) continue;
    const entry = Object.freeze({ stackPost: true, localXSign, topCm: post.topCm, pieces: Object.freeze([post.combinedKey]) });
    result.set(post.hostId, [...(result.get(post.hostId) ?? []), entry]);
  }
}

/**
 * Açıklık içi ara profil (`detectShortRunInfills`): o noktadaki dikey parça dikme değil profildir;
 * çizen modülün o ucuna `{ infill: true, localXSign, pieces }` yazılır (İskelet etiketi profil).
 */
function addRunInfills(list, result) {
  let infills = [];
  try {
    infills = detectShortRunInfills(list);
  } catch {
    return;
  }
  const byId = new Map(list.filter((module) => module?.id).map((module) => [module.id, module]));
  for (const infill of infills) {
    for (const moduleId of infill.moduleIds) {
      const module = byId.get(moduleId);
      const bounds = module ? getModuleFootprintBoundsCm(module) : null;
      if (!bounds) continue;
      const localXSign = localXSignOfPoint(module, bounds, infill.point);
      if (!localXSign) continue;
      const entry = Object.freeze({ infill: true, localXSign, pieces: Object.freeze([infill.profileKey]) });
      result.set(moduleId, [...(result.get(moduleId) ?? []), entry]);
    }
  }
}

/**
 * Kısa panel ray açıklığı (kullanıcı kararı 2026-11-16, yalnız çizim): listenin tek profil saydığı
 * açıklıkta (`detectShortProfileRuns`) rayı açıklığın ilk modülü açıklık boyunca tek parça çizer,
 * diğerleri o rayı çizmez. Kayıt `{ railRun: true, rail, owner, fromCm, toCm, pieces }`; from / to
 * modülün yerel x ekseninde merkezden cm.
 */
function addShortRailRuns(list, result) {
  let runs = [];
  try {
    runs = detectShortProfileRuns(list);
  } catch {
    return;
  }
  const byId = new Map(list.filter((module) => module?.id).map((module) => [module.id, module]));
  // Açıklığın ucundaki modülün o uçtaki dikme durumu: kendi dikmesi varsa ray dikme kesiti kadar içeride,
  // komşu / bağımsız dikme kullanılıyorsa (postWidthCm) o kadar, köşe dikmesinde yarım kesit biter
  // (2026-11-18: sabit kesit varsayımı yan duvarın dikmesiyle ray arasında boşluk bırakıyordu).
  const endInsetCm = (point) => {
    for (const moduleId of new Set(runs.flatMap((run) => run.moduleIds))) {
      const module = byId.get(moduleId);
      const bounds = module ? getModuleFootprintBoundsCm(module) : null;
      if (!bounds) continue;
      const sign = localXSignOfPoint(module, bounds, point);
      const along = point.xCm >= bounds.minXCm - 0.5 && point.xCm <= bounds.maxXCm + 0.5
        && point.yCm >= bounds.minYCm - 0.5 && point.yCm <= bounds.maxYCm + 0.5;
      if (!sign || !along) continue;
      const ends = (result.get(moduleId) ?? []).filter((end) => end.localXSign === sign && !end.railRun && !end.infill);
      const post = ends.find((end) => end.postWidthCm != null);
      if (post) return post.postWidthCm;
      if (ends.some((end) => end.ownsPost != null)) return frameSectionCm(module) / 2;
    }
    return null;
  };
  for (const run of runs) {
    const across = run.fixedCm ?? null;
    const pointAt = (alongCm) => (run.axis === 'x'
      ? { xCm: alongCm, yCm: across ?? 0 }
      : { xCm: across ?? 0, yCm: alongCm });
    const startInset = across == null ? null : endInsetCm(pointAt(run.startCm));
    const endInset = across == null ? null : endInsetCm(pointAt(run.endCm));
    run.moduleIds.forEach((moduleId, index) => {
      const module = byId.get(moduleId);
      const bounds = module ? getModuleFootprintBoundsCm(module) : null;
      if (!bounds) return;
      const centerX = (bounds.minXCm + bounds.maxXCm) / 2;
      const centerY = (bounds.minYCm + bounds.maxYCm) / 2;
      const center = run.axis === 'x' ? centerX : centerY;
      const probe = run.axis === 'x' ? { xCm: centerX + 10, yCm: centerY } : { xCm: centerX, yCm: centerY + 10 };
      const dir = localXSignOfPoint(module, bounds, probe) || 1;
      const a = (run.startCm - center) * dir;
      const b = (run.endCm - center) * dir;
      const entry = Object.freeze({
        railRun: true,
        rail: run.rail,
        owner: index === 0,
        fromCm: roundCm(Math.min(a, b)),
        toCm: roundCm(Math.max(a, b)),
        // Uçtaki iç boşluk (cm); null: modülün kendi dikmesi (kesit kadar).
        fromInsetCm: a <= b ? startInset : endInset,
        toInsetCm: a <= b ? endInset : startInset,
        pieces: run.pieces,
      });
      result.set(moduleId, [...(result.get(moduleId) ?? []), entry]);
    });
  }
}

const STACK_EPSILON_CM = 0.5;
// Profil / dikme kesiti modülün sahne ölçüsündendir (reçetedeki profilin sahne kesiti; kullanıcı kararı
// 2026-11-20: dikmeler sahne ölçüsüne göre hareket eder). Köşe dikmesinde ray yarım kesit içeride biter.
function frameSectionCm(module) {
  try {
    return Number(resolveProceduralFrameCrossSectionCm(module).frameWidthCm) || 0;
  } catch {
    return 0;
  }
}

/**
 * Üst üste kısa paneller (kullanıcı kararı 2026-11-16, yalnız çizim): aynı izdüşümde ve Z'de bitişik
 * kısa paneller tek kolon gibi çizilir. Kayıt `{ stack: true, below, above, uprightTopCm }`:
 * birleşen kenarda ray çizilmez ve panel açıklığı kenara kadar uzar; dikmeleri kolonun en alttaki
 * üyesi kolon boyunca çizer (`uprightTopCm`), üsttekiler çizmez. Üretim listesi değişmez.
 */
function addShortStackEnds(list, result) {
  const shorts = list.filter((module) => module?.id && module.placement
    && isWallShortFamilyDescriptor(module) && isCardinal(module));
  const groups = [];
  for (const module of shorts) {
    const bounds = getModuleFootprintBoundsCm(module);
    if (!bounds) continue;
    const rotation = normalizeModuleRotationZDeg(module.placement.rotationZDeg);
    const group = groups.find((entry) => entry.rotation === rotation
      && Math.abs(entry.bounds.minXCm - bounds.minXCm) <= STACK_EPSILON_CM
      && Math.abs(entry.bounds.maxXCm - bounds.maxXCm) <= STACK_EPSILON_CM
      && Math.abs(entry.bounds.minYCm - bounds.minYCm) <= STACK_EPSILON_CM
      && Math.abs(entry.bounds.maxYCm - bounds.maxYCm) <= STACK_EPSILON_CM);
    if (group) group.members.push(module);
    else groups.push({ rotation, bounds, members: [module] });
  }
  for (const group of groups) {
    const sorted = group.members.slice().sort((a, b) => zRangeCm(a).bottom - zRangeCm(b).bottom);
    let chain = [];
    const flush = () => {
      if (chain.length >= 2) {
        const chainTop = zRangeCm(chain[chain.length - 1]).top;
        let bandOffset = 0;
        chain.forEach((module, index) => {
          const own = zRangeCm(module);
          const entry = {
            stack: true,
            below: index > 0,
            above: index < chain.length - 1,
            uprightTopCm: index === 0 ? roundCm(chainTop - own.bottom) : null,
            // Kolon kimliği ve kolondaki bant sırası (Panel Ölçüleri etiketi kolonu tek duvar sayar).
            chainId: chain[0].id,
            bandOffset,
          };
          bandOffset += Array.isArray(module.strips) && module.strips.length ? module.strips.length : 1;
          result.set(module.id, [...(result.get(module.id) ?? []), Object.freeze(entry)]);
        });
        // Kolonun dikmelerini alttaki üye (ya da onun komşusu / köşesi) çizer: üstteki üyelerin rayı
        // alttakinin uç durumuyla biter (komşu dikmesinde 0, köşe dikmesinde yarım kesit; 2026-11-18,
        // Winset: üst şortun rayı 8 cm kısa kalıyordu).
        const bottom = chain[0];
        const bottomEnds = result.get(bottom.id) ?? [];
        for (const side of [-1, 1]) {
          const shared = bottomEnds.find((end) => end.localXSign === side && end.postWidthCm != null);
          const corner = bottomEnds.find((end) => end.localXSign === side && end.ownsPost === false);
          if (!shared && !corner) continue;
          const postWidthCm = shared ? shared.postWidthCm : frameSectionCm(bottom) / 2;
          chain.slice(1).forEach((module) => {
            result.set(module.id, [...(result.get(module.id) ?? []), Object.freeze({ localXSign: side, postWidthCm })]);
          });
        }
      }
    };
    for (const module of sorted) {
      const last = chain[chain.length - 1];
      if (last && Math.abs(zRangeCm(module).bottom - zRangeCm(last).top) <= STACK_EPSILON_CM) {
        chain.push(module);
      } else {
        flush();
        chain = [module];
      }
    }
    flush();
  }
}

const EPSILON_CM = 0.01;
// Bağımsız dikme kısa panelin uç dikmesiyle aynı parçadır (kullanıcı kararı 2026-11-19): ucuna bu kadar
// yakın duran dikme o ucun dikmesi sayılır (eski projelerde snap 2 cm kayık bırakıyordu).
export const SHORT_END_POST_TOLERANCE_CM = 3;
const FULL_WALL_TYPES = new Set(['flat-panel', 'door', 'separator', 'showcase-2', 'showcase-3']);

function itemLengthCm(itemKey) {
  const item = itemKey ? getItem(itemKey) : null;
  const length = Number(item?.dimensions?.heightCm ?? item?.sceneDimensions?.heightCm);
  return Number.isFinite(length) ? length : 0;
}

function recipeUprightKey(itemKey) {
  const rows = getItem(itemKey)?.composition?.items;
  if (!Array.isArray(rows)) return null;
  return rows.map((row) => row?.itemKey).find((key) => getItem(key)?.type === 'upright') ?? null;
}

/**
 * Tam boy duvar (duvar, kapı, separatör, vitrin) ucunda bağımsız dikme (kullanıcı kararı 2026-11-16,
 * Üretim Listesi `applyStandaloneUprightsAtWallEnds` ile aynı kural): duvarın uç noktası dikmenin
 * izindeyse ve dikme duvarın dikmesinden uzun ya da eşitse duvar o uçta kendi dikmesini çizmez,
 * ray dikmenin yüzünde biter. Kısa bağımsız dikmede duvarın dikmesi kalır (listede kısa olan düşer).
 */
/** Modül izinin uç noktalarından (çizgi ortasında) dikmenin izine düşeni; yoksa null. */
function endPointInsidePost(bounds, alongX, post) {
  const centerX = (bounds.minXCm + bounds.maxXCm) / 2;
  const centerY = (bounds.minYCm + bounds.maxYCm) / 2;
  const ends = alongX
    ? [{ xCm: bounds.minXCm, yCm: centerY }, { xCm: bounds.maxXCm, yCm: centerY }]
    : [{ xCm: centerX, yCm: bounds.minYCm }, { xCm: centerX, yCm: bounds.maxYCm }];
  const t = SHORT_END_POST_TOLERANCE_CM;
  return ends.find((point) => point.xCm >= post.minXCm - t && point.xCm <= post.maxXCm + t
    && point.yCm >= post.minYCm - t && point.yCm <= post.maxYCm + t) ?? null;
}

function addFullWallStandalonePostEnds(list, uprights, result) {
  const walls = list.filter((module) => module?.id && module.placement && isCardinal(module)
    && FULL_WALL_TYPES.has(module.type) && !isWallShortFamilyDescriptor(module));
  for (const wall of walls) {
    const ownKey = recipeUprightKey(wall.itemKey);
    if (!ownKey) continue;
    const bounds = getModuleFootprintBoundsCm(wall);
    if (!bounds) continue;
    const wallZ = zRangeCm(wall);
    const alongX = bounds.maxXCm - bounds.minXCm > bounds.maxYCm - bounds.minYCm;
    const centerX = (bounds.minXCm + bounds.maxXCm) / 2;
    const centerY = (bounds.minYCm + bounds.maxYCm) / 2;
    const ends = alongX
      ? [{ xCm: bounds.minXCm, yCm: centerY }, { xCm: bounds.maxXCm, yCm: centerY }]
      : [{ xCm: centerX, yCm: bounds.minYCm }, { xCm: centerX, yCm: bounds.maxYCm }];
    for (const point of ends) {
      const upright = uprights.find((candidate) => {
        const post = getModuleFootprintBoundsCm(candidate);
        if (!post) return false;
        const contains = point.xCm >= post.minXCm - 0.5 && point.xCm <= post.maxXCm + 0.5
          && point.yCm >= post.minYCm - 0.5 && point.yCm <= post.maxYCm + 0.5;
        const postZ = zRangeCm(candidate);
        return contains && postZ.bottom <= wallZ.bottom + 0.5 && postZ.top > wallZ.bottom + EPSILON_CM
          && itemLengthCm(candidate.itemKey) >= itemLengthCm(ownKey);
      });
      if (!upright) continue;
      const post = getModuleFootprintBoundsCm(upright);
      const localXSign = localXSignOfPoint(wall, bounds, point);
      if (!localXSign) continue;
      // Uç aynı zamanda köşe birleşimiyse ortak köşe dikmesini kimse çizmez: köşedeki tek dikme
      // bağımsız dikmedir (listede de o kalır).
      const existing = result.get(wall.id) ?? [];
      const cornerIndex = existing.findIndex((end) => end.localXSign === localXSign
        && end.postWidthCm == null && end.trimCm == null);
      if (cornerIndex >= 0) {
        existing[cornerIndex] = Object.freeze({ ...existing[cornerIndex], ownsPost: false });
        continue;
      }
      // Ray dikmenin iç yüzünde biter: duvar ucundan dikmenin duvara doğru uzandığı kadar.
      const insideCm = alongX
        ? (point.xCm <= centerX ? post.maxXCm - bounds.minXCm : bounds.maxXCm - post.minXCm)
        : (point.yCm <= centerY ? post.maxYCm - bounds.minYCm : bounds.maxYCm - post.minYCm);
      pushEnd(result, wall.id, { localXSign, postWidthCm: roundCm(Math.max(insideCm, 0.5)) });
    }
  }
}
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

// Bağımsız dikme o uçtaki dikmedir (2026-11-19): köşe kaydı varsa (ortak köşe dikmesi) onun yerini alır;
// köşe dikmesi ayrıca çizilmez, ray bağımsız dikmenin iç yüzünde biter.
function replaceCornerEnd(result, moduleId, end) {
  const existing = (result.get(moduleId) ?? []).filter((entry) => !(entry.localXSign === end.localXSign
    && entry.ownsPost != null && entry.postWidthCm == null));
  result.set(moduleId, existing);
  pushEnd(result, moduleId, end);
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
 *   onun iç yüzünde biter. İki ucu da köşe olan profil (H / U) iki çıkıntının arasına girer.
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
      const postZ = zRangeCm(upright);
      if (postZ.top <= wallZ.bottom + EPSILON_CM || postZ.bottom >= wallZ.top - EPSILON_CM) continue;
      const alongX = bounds.maxXCm - bounds.minXCm > bounds.maxYCm - bounds.minYCm;
      if (!inside) {
        // Dikme kısa panelin izinden taşıyorsa (ör. köşede): kısa panelin ucu dikmenin izindeyse ve
        // dikme kısa panelin dikmesinden uzunsa (listede uzun olan kalır) aynı kural uygulanır.
        const endPoint = endPointInsidePost(bounds, alongX, post);
        const ownKey = recipeUprightKey(wall.itemKey);
        if (!endPoint || itemLengthCm(upright.itemKey) < itemLengthCm(ownKey)) continue;
        const sign = localXSignOfPoint(wall, bounds, endPoint);
        if (!sign) continue;
        const centerX = (bounds.minXCm + bounds.maxXCm) / 2;
        const centerY = (bounds.minYCm + bounds.maxYCm) / 2;
        const insideCm = alongX
          ? (endPoint.xCm <= centerX ? post.maxXCm - bounds.minXCm : bounds.maxXCm - post.minXCm)
          : (endPoint.yCm <= centerY ? post.maxYCm - bounds.minYCm : bounds.maxYCm - post.minYCm);
        replaceCornerEnd(result, wall.id, { localXSign: sign, postWidthCm: roundCm(Math.max(insideCm, 0.5)) });
        continue;
      }
      // Uca SHORT_END_POST_TOLERANCE_CM içinde duran dikme o ucun dikmesidir; ray dikmenin iç yüzünde biter.
      const fromStart = alongX ? post.minXCm - bounds.minXCm : post.minYCm - bounds.minYCm;
      const fromEnd = alongX ? bounds.maxXCm - post.maxXCm : bounds.maxYCm - post.maxYCm;
      const atStart = fromStart < SHORT_END_POST_TOLERANCE_CM;
      if (!atStart && !(fromEnd < SHORT_END_POST_TOLERANCE_CM)) continue;
      const point = { xCm: (post.minXCm + post.maxXCm) / 2, yCm: (post.minYCm + post.maxYCm) / 2 };
      const localXSign = localXSignOfPoint(wall, bounds, point);
      if (!localXSign) continue;
      const postWidthCm = roundCm(atStart
        ? (alongX ? post.maxXCm - bounds.minXCm : post.maxYCm - bounds.minYCm)
        : (alongX ? bounds.maxXCm - post.minXCm : bounds.maxYCm - post.minYCm));
      replaceCornerEnd(result, wall.id, { localXSign, postWidthCm });
    }
    for (const profile of profiles) {
      if (isProfileFlushOnFrameEnd(profile, wall)) pushProfileTrim(result, profile, wall);
    }
  }

  addFullWallStandalonePostEnds(list, uprights, result);

  // H / U (kullanıcı kararı 2026-11-13, proje 452d4cc1): iki uçta da dik profillerin uçlarına gelen
  // profil, duvarın üst rayının iki dikmesi arasına girdiği gibi iki çıkıntının iç yüzleri arasına
  // girer; köşe karelerini çıkıntılar tutar. Yalnız bir ucu köşe olan L'de uzun profil tutar.
  const cornerCount = new Map();
  profiles.forEach((first, index) => {
    profiles.slice(index + 1).forEach((second) => {
      if (!isProfileFlushOnFrameEnd(first, second) || !isProfileFlushOnFrameEnd(second, first)) return;
      cornerCount.set(first.id, (cornerCount.get(first.id) ?? 0) + 1);
      cornerCount.set(second.id, (cornerCount.get(second.id) ?? 0) + 1);
    });
  });
  const spansBetween = (profile, other) => (cornerCount.get(profile.id) ?? 0) >= 2
    && (cornerCount.get(other.id) ?? 0) < 2;
  profiles.forEach((first, index) => {
    profiles.slice(index + 1).forEach((second) => {
      if (!isProfileFlushOnFrameEnd(first, second) || !isProfileFlushOnFrameEnd(second, first)) return;
      if (spansBetween(first, second)) { pushProfileTrim(result, first, second); return; }
      if (spansBetween(second, first)) { pushProfileTrim(result, second, first); return; }
      const firstWidth = Number(first.widthCm) || 0;
      const secondWidth = Number(second.widthCm) || 0;
      const firstOwns = firstWidth > secondWidth
        || (firstWidth === secondWidth && String(first.id) < String(second.id));
      if (firstOwns) pushProfileTrim(result, second, first);
      else pushProfileTrim(result, first, second);
    });
  });
}
