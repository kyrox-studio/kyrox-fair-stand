// Yeniden boyutlandırma motoru (ROADMAP: tek motor, 2026-11-05 kararı). Sahneye ve DOM'a
// dokunmaz: mevcut modüllerden yeni modül listesini ve "ne değişecek" raporunu üretir.
// Sisteme özel ürün kuralları `standResizeRules.js` içindedir. Adımlar: duvar yüksekliği, genişlik/derinlik.
//
// Ürün kararları (2026-11-10):
// - Duvar ailesi (düz duvar, kapı, vitrin, separatör, depo duvarı) yeni yükseklikteki karşılığına döner.
// - Panel bantları alttan korunur; duvar yükselince üste boş bant eklenir, alçalınca üst bantlar kalkar.
// - Duvarın tepesine kadar uzanan Lightbox / Mesh kaplaması yeni boya uzar veya kısalır.
// - Duvar tepesine göre konumlanan öğeler (profil, kısa duvar / alınlık; z_reference = wall-top) ve
//   duvar tepesine takılı üst montaj öğeleri (projektör) fark kadar iner / çıkar.
// - Tepeye ulaşan dikme fark kadar kısalır / uzar; duvardan kısa dikme yerinde kalır.
// - Tavana değen tül tavanla birlikte iner / çıkar.
// - Diğer duvar üstü öğeler (TV, raf, strafor, tavana değmeyen tül, kutu blok) yerinde kalır;
//   yeni tepeyi aşan tepeye iner.

import {
  getItem,
  getTopLightItemForType,
  resolveAutomaticWallFlatPanelItemKey,
  resolveItemDefaultZCm,
  resolveWallItemKeyForHeight,
} from './items.js';
import {
  createModuleStateFromCatalogKey,
  createModuleStateFromDescriptor,
  normalizeModuleItemState,
} from './designState.js';
import {
  WALL_OVERLAY_DEFAULT_CENTER_CM,
  clampFloorRelativeBottomZCm,
  clampMountBottomZCm,
  createModulePlacement,
  getModuleFootprintBoundsCm,
  getWallOverlayZBoundsCm,
  overlayZCmFromSeamHeight,
  placementsOverlap,
  validateModulePlacement,
} from './modulePlacement.js';
import { composeStraightWall } from './wall.js';
import { planAutomaticFascia, resolveFasciaPanelItemKey, resolveFasciaUprightItemKey } from './autoFascia.js';
import { getContinuousWallSegments } from './wallReflow.js';
import { planAutomaticDepot } from './autoDepot.js';
import { planAutomaticFurniture } from './autoFurniture.js';
import {
  composeAutomaticBackWallWithDepot,
  composeAutomaticSideWallWithDepot,
  composeAutomaticStandWall,
  getAutomaticWallCapacityCm,
  planAutomaticDepotLampPlacements,
} from './automaticWall.js';
import { snapPlacementToItemAnchor } from './itemSnap.js';
import { isTopPlacementModule, isWallOverlayModule, usesPanelSeamOverlaySnap } from './moduleBehavior.js';
import { WALL_PANEL_BAND_PITCH_CM } from './wallPanelBand.js';
import { getStandResizeRules } from './standResizeRules.js';

const WALL_FAMILY_TYPES = new Set(['flat-panel', 'door', 'separator', 'showcase-2', 'showcase-3']);
const STRIP_FIELDS = Object.freeze(['strips', 'backStrips']);
const SCENE_SIZE_FIELDS = Object.freeze(['widthCm', 'depthCm', 'heightCm', 'eyeCount']);
const EPSILON_CM = 0.5;

// Kaplamanın parçası olan alanlar (sahibi listeleri hariç): yeni bant kaplamaya katılırken kopyalanır.
const FABRIC_SHARED_KEYS = Object.freeze([
  'fabricGroupId',
  'fabricColor',
  'fabricImageAssetId',
  'fabricImageFit',
  'fabricImageWidthCm',
  'fabricImageHeightCm',
  'fabricLightingOn',
  'fabricType',
]);

function stripIndexOf(strip, position) {
  return Number.isInteger(strip?.stripIndex) ? strip.stripIndex : position;
}

function topStrip(strips) {
  let top = null;
  let topIndex = -Infinity;
  strips.forEach((strip, position) => {
    const index = stripIndexOf(strip, position);
    if (index > topIndex) {
      topIndex = index;
      top = strip;
    }
  });
  return top;
}

function emptyReport() {
  return {
    convertedWalls: 0,
    addedBands: 0,
    removedBands: 0,
    extendedFabrics: 0,
    resizedUprights: 0,
    shiftedWithWallTop: 0,
    loweredToWallTop: 0,
  };
}

/**
 * Duvar ailesi modülünü yeni ürüne çevirir: bantlar alttan korunur, eksik bant yeni ürünün
 * boş bandıyla dolar. Kaplama ve sahiplik düzeltmesi sonra bütün sahne üzerinde yapılır.
 */
function convertWallModule(moduleState, nextItemKey, fabricWork, report) {
  const fresh = createModuleStateFromCatalogKey(nextItemKey);
  if (!fresh) return null;
  const next = structuredClone(moduleState);
  next.itemKey = fresh.itemKey;
  for (const field of SCENE_SIZE_FIELDS) {
    if (Object.hasOwn(fresh, field)) next[field] = fresh[field];
  }

  if (Array.isArray(moduleState.strips) && Array.isArray(fresh.strips)) {
    const savedByIndex = new Map(moduleState.strips.map((strip, position) => [stripIndexOf(strip, position), strip]));
    const freshIndexes = new Set(fresh.strips.map((strip, position) => stripIndexOf(strip, position)));
    const oldTop = topStrip(moduleState.strips);
    next.strips = fresh.strips.map((created, position) => {
      const saved = savedByIndex.get(stripIndexOf(created, position));
      if (saved) return structuredClone(saved);
      report.addedBands += 1;
      fabricWork.added.push({ surface: created, sourceTop: oldTop });
      return created;
    });
    moduleState.strips.forEach((strip, position) => {
      if (freshIndexes.has(stripIndexOf(strip, position))) return;
      report.removedBands += 1;
      if (strip?.id) fabricWork.removedIds.add(strip.id);
    });
  }

  const savedBack = Array.isArray(moduleState.backStrips) ? moduleState.backStrips : null;
  normalizeModuleItemState(next);
  // Arka yüz ön yüzün bant sayısını izler (alignFlatPanelBackStrips); eklenen/kalkan arka bantlar
  // kaplama sahipliği için aynı listeye yazılır.
  if (savedBack && Array.isArray(next.backStrips)) {
    const keptIds = new Set(next.backStrips.map((strip) => strip?.id).filter(Boolean));
    const oldTop = topStrip(savedBack);
    savedBack.forEach((strip) => {
      if (strip?.id && !keptIds.has(strip.id)) fabricWork.removedIds.add(strip.id);
    });
    const savedIds = new Set(savedBack.map((strip) => strip?.id).filter(Boolean));
    next.backStrips.forEach((strip) => {
      if (!savedIds.has(strip?.id)) fabricWork.added.push({ surface: strip, sourceTop: oldTop });
    });
  }
  report.convertedWalls += 1;
  return next;
}

function convertUpright(moduleState, nextItemKey, report) {
  const fresh = createModuleStateFromCatalogKey(nextItemKey);
  if (!fresh) return null;
  const next = structuredClone(moduleState);
  next.itemKey = fresh.itemKey;
  for (const field of SCENE_SIZE_FIELDS) {
    if (Object.hasOwn(fresh, field)) next[field] = fresh[field];
  }
  report.resizedUprights += 1;
  return next;
}

function withZ(moduleState, zCm) {
  return { ...moduleState, placement: { ...moduleState.placement, zCm } };
}

/** Öğenin dikey konumunu yeni yüksekliğe uydurur; değişmezse aynı nesne döner. */
function adjustVerticalPlacement(moduleState, fromHeightCm, toHeightCm, report) {
  const zCm = Number(moduleState?.placement?.zCm);
  if (!moduleState?.placement || !Number.isFinite(zCm)) return moduleState;
  const deltaCm = toHeightCm - fromHeightCm;
  const item = moduleState.itemKey ? getItem(moduleState.itemKey) : null;
  const heightCm = Number(moduleState.heightCm) || 0;

  if (item?.zReference === 'wall-top') {
    report.shiftedWithWallTop += 1;
    const shifted = zCm + deltaCm;
    const value = moduleState.type === 'profile'
      ? shifted
      : clampFloorRelativeBottomZCm(shifted, heightCm, toHeightCm);
    return withZ(moduleState, value);
  }

  if (isTopPlacementModule(moduleState)) {
    if (zCm >= fromHeightCm - EPSILON_CM) {
      report.shiftedWithWallTop += 1;
      return withZ(moduleState, clampMountBottomZCm(zCm + deltaCm, toHeightCm));
    }
    if (zCm > toHeightCm) {
      report.loweredToWallTop += 1;
      return withZ(moduleState, clampMountBottomZCm(zCm, toHeightCm));
    }
    return moduleState;
  }

  if (isWallOverlayModule(moduleState)) {
    if (usesPanelSeamOverlaySnap(moduleState)) {
      // Raf alt kenarıyla bir panel birleşimine oturur; yeni duvara sığmıyorsa sığan en üst birleşime iner.
      const seamCm = zCm + WALL_OVERLAY_DEFAULT_CENTER_CM - heightCm / 2;
      if (seamCm + heightCm <= toHeightCm + EPSILON_CM) return moduleState;
      const pitch = WALL_PANEL_BAND_PITCH_CM;
      const nextSeamCm = Math.max(pitch, Math.floor((toHeightCm - heightCm) / pitch) * pitch);
      report.loweredToWallTop += 1;
      return withZ(moduleState, overlayZCmFromSeamHeight(nextSeamCm, heightCm));
    }
    const { maxZCm } = getWallOverlayZBoundsCm(heightCm, toHeightCm);
    if (zCm <= maxZCm + EPSILON_CM) return moduleState;
    report.loweredToWallTop += 1;
    return withZ(moduleState, maxZCm);
  }

  if (moduleState.type === 'tulle-fabric' || moduleState.type === 'box-block') {
    const extentCm = moduleState.type === 'tulle-fabric' ? Number(moduleState.depthCm) || 0 : heightCm;
    // Tül tepe öğesidir: tavana değiyorsa tavanla birlikte iner / çıkar. Kutu blok zeminde kalır.
    if (moduleState.type === 'tulle-fabric' && zCm + extentCm >= fromHeightCm - EPSILON_CM) {
      report.shiftedWithWallTop += 1;
      return withZ(moduleState, clampFloorRelativeBottomZCm(zCm + deltaCm, extentCm, toHeightCm));
    }
    const clamped = clampFloorRelativeBottomZCm(zCm, extentCm, toHeightCm);
    if (Math.abs(clamped - zCm) < EPSILON_CM) return moduleState;
    report.loweredToWallTop += 1;
    return withZ(moduleState, clamped);
  }
  return moduleState;
}

function surfacesOf(moduleState) {
  return STRIP_FIELDS.flatMap((field) => (Array.isArray(moduleState?.[field]) ? moduleState[field] : []));
}

/**
 * Kaplama: tepeye kadar uzanan kaplamaya yeni bantlar katılır; kalkan bantlar sahip listesinden
 * düşer. Sahip listesi eksik kalırsa sahne kaplamayı bütünüyle çözer (normalizeFabricOwnership).
 */
function applyFabricWork(modules, fabricWork, report) {
  const addedByGroup = new Map();
  for (const { surface, sourceTop } of fabricWork.added) {
    const groupId = sourceTop?.fabricGroupId;
    if (!groupId) continue;
    for (const key of FABRIC_SHARED_KEYS) {
      if (Object.hasOwn(sourceTop, key)) surface[key] = structuredClone(sourceTop[key]);
    }
    if (!addedByGroup.has(groupId)) addedByGroup.set(groupId, []);
    addedByGroup.get(groupId).push(surface.id);
  }
  report.extendedFabrics = addedByGroup.size;
  if (!addedByGroup.size && !fabricWork.removedIds.size) return;

  // Grup başına tek sahip listesi: eski sahipler (kalkanlar hariç) + yeni katılan bantlar.
  const ownersByGroup = new Map();
  const allSurfaces = modules.flatMap(surfacesOf).filter((surface) => surface?.fabricGroupId);
  for (const surface of allSurfaces) {
    const owners = ownersByGroup.get(surface.fabricGroupId) ?? new Set();
    (Array.isArray(surface.fabricOwnerSurfaceIds) ? surface.fabricOwnerSurfaceIds : [])
      .filter((id) => !fabricWork.removedIds.has(id))
      .forEach((id) => owners.add(id));
    ownersByGroup.set(surface.fabricGroupId, owners);
  }
  for (const [groupId, ids] of addedByGroup) {
    const owners = ownersByGroup.get(groupId) ?? new Set();
    ids.forEach((id) => owners.add(id));
    ownersByGroup.set(groupId, owners);
  }
  for (const surface of allSurfaces) {
    surface.fabricOwnerSurfaceIds = [...ownersByGroup.get(surface.fabricGroupId)];
  }
}

/**
 * Duvar yüksekliği değişimini planlar. Girdi modüllerine dokunmaz.
 * Dönüş: { ok, changed, modules, report } veya { ok: false, message }.
 */
export function planStandWallHeightChange({ modules, fromHeightCm, toHeightCm, boothType }) {
  const rules = getStandResizeRules(boothType);
  if (!rules) {
    return { ok: false, message: 'Bu stand tipinde duvar yüksekliği sonradan değiştirilemiyor.' };
  }
  const from = Number(fromHeightCm);
  const to = Number(toHeightCm);
  if (!rules.wallHeightsCm.includes(to) || !Number.isFinite(from)) {
    return { ok: false, message: 'Geçersiz duvar yüksekliği.' };
  }
  const report = emptyReport();
  if (from === to || !Array.isArray(modules)) {
    return { ok: true, changed: false, modules: Array.isArray(modules) ? modules : [], report };
  }

  const fabricWork = { added: [], removedIds: new Set() };
  const nextModules = modules.map((moduleState) => {
    if (!moduleState) return moduleState;
    let next = moduleState;
    if (WALL_FAMILY_TYPES.has(moduleState.type)) {
      const nextKey = rules.resolveWallItemKey(moduleState.itemKey, to);
      if (nextKey && nextKey !== moduleState.itemKey) {
        next = convertWallModule(moduleState, nextKey, fabricWork, report) ?? moduleState;
      }
    } else if (moduleState.type === 'upright') {
      const nextKey = rules.resolveUprightItemKey(moduleState.itemKey, from, to);
      if (nextKey && nextKey !== moduleState.itemKey) {
        next = convertUpright(moduleState, nextKey, report) ?? moduleState;
      }
    }
    return adjustVerticalPlacement(next, from, to, report);
  });

  applyFabricWork(nextModules, fabricWork, report);
  return { ok: true, changed: true, modules: nextModules, report };
}

/** Önizleme metni: kullanıcıya uygulanmadan önce ne değişeceğini söyler. */
export function describeWallHeightChangeReport(report) {
  const lines = [];
  if (report.convertedWalls) lines.push(`${report.convertedWalls} duvar parçası yeni yüksekliğe çevrilecek.`);
  if (report.addedBands) lines.push(`${report.addedBands} boş bant eklenecek.`);
  if (report.removedBands) lines.push(`${report.removedBands} üst bant (renk ve görseliyle) kaldırılacak.`);
  if (report.extendedFabrics) lines.push(`${report.extendedFabrics} Lightbox / Mesh kaplaması yeni boya uzayacak.`);
  if (report.resizedUprights) lines.push(`${report.resizedUprights} dikmenin boyu değişecek.`);
  if (report.shiftedWithWallTop) lines.push(`${report.shiftedWithWallTop} öğe duvar tepesiyle birlikte taşınacak (profil, alınlık, projektör, tül).`);
  if (report.loweredToWallTop) lines.push(`${report.loweredToWallTop} öğe yeni duvar tepesine indirilecek.`);
  return lines;
}

// ---------------------------------------------------------------------------
// Genişlik / derinlik. Ürün kararları (2026-11-10):
// - Köşe tarafı sabit; uzayan kenarda yeni düz panel açık uca girer (duvar eskiden açık uca
//   kadar uzanıyorsa). U standda sırt duvarının iki ucu köşe olduğundan yeni panel sağ uca girer.
// - Kısalan kenarda açık uçtaki paneller kalkar, yarısı kalan düz panel daha dar panele çevrilir.
// - Duvar üstü öğeler duvarıyla kayar; depo bağlı olduğu duvarla hareket eder.
// - Mobilya ve serbest öğeler en yakın kenara mesafesini korur. Aynı gruptaki ve izi birbirine değen
//   öğeler tek küme: bölünmez; taşan küme bütün hâlinde, mümkünse çarpmayan en yakın yere taşınır.
// - Standı uçtan uca kaplayan tül stand kısalınca o eksende kısalır, uzayınca uzamaz.
// - Sırt duvar ve U (kullanıcı kararı 2026-11-10): genişlik değişince sırt duvarı iki uçtan eşit
//   uzar / kısalır (50 cm adım; tek 50'lik sağ uca); bütün içerik soldaki fark kadar kayar, ortada kalır.
// - Ada stand (kullanıcı kararı 2026-11-10): iki yandan eşit uzar / kısalır; bütün içerik (bölgesel
//   zemin dahil) birlikte farkın yarısı kadar kayar, tasarım bölünmez. Kayma 10 cm adıma (zemin 50 cm) yuvarlanır.
// - Derinlik (kullanıcı kararı 2026-11-10): sırt duvarı yerinde kalır, açık ön kenar uzar / kısalır.
// - Alınlık yeni kenara göre yeniden kurulur; renk/görsel kenarda aynı konumdaki yeni panele aktarılır.
// Mutlak koordinatta sonuç: sırt duvarı L Sağ'da ΔX kayar (köşe sağda), sağ duvar yeni sağ kenara
// taşınır, sol duvar ve diğer sırt duvarları yerinde kalır.

const CHAIN_WALL_IDS = new Set(['back', 'left', 'right']);
const DEPOT_FLAGS = Object.freeze(['autoDepot', 'autoDepotBack', 'depotBack', 'depotSide']);
const FASCIA_EDGE_BY_ROTATION = Object.freeze({ 0: 'front', 180: 'back', 270: 'left', 90: 'right' });
const FREE_SHIFT_STEP_CM = 10;
const FREE_SHIFT_LIMIT_CM = 5000;
// Küme: izleri bu kadar yakın öğeler birbirine değiyor sayılır.
const CLUSTER_CONTACT_GAP_CM = 1;
// Sığan ilk konumdan sonra çarpmayan yer bu kadar daha uzakta aranır.
const FREE_PLACE_SEARCH_CM = 200;
const CLUSTER_SEARCH_DIRECTIONS = Object.freeze([[-1, 0], [0, -1], [1, 0], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]);
// Tül kenara bu kadar yakınsa standı uçtan uca kaplıyor sayılır.
const TULLE_EDGE_TOLERANCE_CM = 10;

/** Otomatik duvar paneli: standın yüksekliğindeki düz duvar, kilitli gelir. */
export function createStandWallPanelState(widthCm, wallHeightCm) {
  const moduleState = createModuleStateFromDescriptor({
    type: 'flat-panel',
    widthCm,
    itemKey: resolveAutomaticWallFlatPanelItemKey(widthCm, wallHeightCm),
  });
  if (!moduleState) return null;
  moduleState.locked = true;
  return moduleState;
}

/** Otomatik alınlık modülleri: Z, wall-short / dikme öğesinin kendi varsayılanından gelir. */
export function createAutomaticFasciaStates(plan, wallHeightCm) {
  if (!plan?.ok) return [];
  const states = [];
  for (const panel of plan.panels) {
    const itemKey = resolveFasciaPanelItemKey(panel.widthCm, plan.rows);
    const state = itemKey ? createModuleStateFromCatalogKey(itemKey) : null;
    if (!state) continue;
    state.placement = { ...panel.placement, zCm: resolveItemDefaultZCm(itemKey) };
    state.locked = true;
    state.autoFascia = true;
    states.push(state);
  }
  const uprightKey = resolveFasciaUprightItemKey(wallHeightCm);
  for (const upright of plan.uprights) {
    const state = uprightKey ? createModuleStateFromCatalogKey(uprightKey) : null;
    if (!state) continue;
    // Plan noktası panel hatlarının birleşimidir; sahne yatay modülde xCm'i sol kenar sayar
    // (gövde xCm + genişlik/2'de). Dikmenin merkezi birleşime otursun diye yarım genişlik geri alınır.
    state.placement = {
      ...upright.placement,
      xCm: Number(upright.placement.xCm) - Number(state.widthCm) / 2,
    };
    state.locked = true;
    state.autoFascia = true;
    states.push(state);
  }
  return states;
}

function isDepotModule(moduleState) {
  return DEPOT_FLAGS.some((flag) => moduleState?.[flag] === true);
}

function wallAxisKey(wallId) {
  return wallId === 'back' ? 'xCm' : 'yCm';
}

function wallRange(moduleState) {
  const start = Number(moduleState.placement[wallAxisKey(moduleState.placement.wallId)]);
  return { start, end: start + (Number(moduleState.widthCm) || 0) };
}

function surfaceImageCount(moduleState) {
  return surfacesOf(moduleState)
    .filter((surface) => surface?.imageAssetId || surface?.fabricImageAssetId).length;
}

function collectSurfaceIds(moduleState, target) {
  surfacesOf(moduleState).forEach((surface) => { if (surface?.id) target.add(surface.id); });
}

function emptySizeReport() {
  return {
    addedPanels: 0,
    removedPanels: 0,
    narrowedPanels: 0,
    removedImages: 0,
    removedItems: 0,
    movedItems: 0,
    clampedItems: 0,
    outsideItems: 0,
    collidingItems: 0,
    shortenedTulles: 0,
    fasciaRebuilt: false,
    floorArea: 'kept',
  };
}

/** Düz paneli aynı yükseklikte daha dar panele çevirir; bantlar (aynı sayı) korunur. */
function narrowWallPanel(moduleState, widthCm, wallHeightCm) {
  if (moduleState.type !== 'flat-panel') return null;
  const itemKey = resolveAutomaticWallFlatPanelItemKey(widthCm, wallHeightCm);
  const fresh = itemKey ? createModuleStateFromCatalogKey(itemKey) : null;
  if (!fresh || Number(fresh.widthCm) !== Number(widthCm)) return null;
  if (Array.isArray(fresh.strips) && Array.isArray(moduleState.strips)
    && fresh.strips.length !== moduleState.strips.length) {
    return null;
  }
  const next = structuredClone(moduleState);
  next.itemKey = fresh.itemKey;
  for (const field of SCENE_SIZE_FIELDS) {
    if (Object.hasOwn(fresh, field)) next[field] = fresh[field];
  }
  return normalizeModuleItemState(next);
}

function chainPlacement(wallId, startCm, toXCm) {
  if (wallId === 'left') return createModulePlacement({ xCm: 0, yCm: startCm, zCm: 0, rotationZDeg: 90, wallId });
  if (wallId === 'right') return createModulePlacement({ xCm: toXCm, yCm: startCm, zCm: 0, rotationZDeg: 270, wallId });
  return createModulePlacement({ xCm: startCm, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' });
}

function fasciaEdgeOf(moduleState) {
  const rotation = ((Math.round(Number(moduleState?.placement?.rotationZDeg) || 0) % 360) + 360) % 360;
  return FASCIA_EDGE_BY_ROTATION[rotation] ?? null;
}

function fasciaRange(moduleState) {
  const edge = fasciaEdgeOf(moduleState);
  const start = Number(edge === 'left' || edge === 'right' ? moduleState.placement.yCm : moduleState.placement.xCm);
  return { edge, start, end: start + (Number(moduleState.widthCm) || 0) };
}

/** Yeni alınlık panellerine eski panellerin bantlarını kenardaki en çok örtüşen konuma göre aktarır. */
function transferFasciaSurfaces(oldPanels, newPanels, removedSurfaceIds, contentShift = { dx: 0, dy: 0 }) {
  const filled = new Set();
  for (const oldPanel of oldPanels) {
    // Eski konum, içeriğin kaydığı kadar ötelenerek karşılaştırılır (logo içerikle birlikte gider).
    const raw = fasciaRange(oldPanel);
    const offset = raw.edge === 'left' || raw.edge === 'right' ? contentShift.dy : contentShift.dx;
    const from = { ...raw, start: raw.start + offset, end: raw.end + offset };
    let best = null;
    let bestOverlap = 0;
    for (const candidate of newPanels) {
      if (filled.has(candidate)) continue;
      const to = fasciaRange(candidate);
      if (to.edge !== from.edge) continue;
      const overlap = Math.min(from.end, to.end) - Math.max(from.start, to.start);
      if (overlap > bestOverlap + EPSILON_CM) {
        best = candidate;
        bestOverlap = overlap;
      }
    }
    const sameShape = best && Array.isArray(best.strips) && Array.isArray(oldPanel.strips)
      && best.strips.length === oldPanel.strips.length;
    if (!sameShape) {
      collectSurfaceIds(oldPanel, removedSurfaceIds);
      continue;
    }
    best.strips = structuredClone(oldPanel.strips);
    if (Array.isArray(oldPanel.backStrips)) best.backStrips = structuredClone(oldPanel.backStrips);
    filled.add(best);
  }
}

function freeShiftFor(position, fromCm, deltaCm) {
  return Number(position) > Number(fromCm) / 2 ? deltaCm : 0;
}

function shiftPlacement(moduleState, dxCm, dyCm) {
  if (!dxCm && !dyCm) return;
  moduleState.placement = {
    ...moduleState.placement,
    xCm: Number(moduleState.placement.xCm) + dxCm,
    yCm: Number(moduleState.placement.yCm) + dyCm,
  };
}

function placementFits(moduleState, standType, toXCm, toYCm) {
  return validateModulePlacement({
    placement: moduleState.placement,
    widthCm: moduleState.widthCm,
    depthCm: moduleState.depthCm ?? null,
    standType,
    standXCm: toXCm,
    standYCm: toYCm,
  }).ok;
}

function unionBounds(modules) {
  let bounds = null;
  for (const moduleState of modules) {
    const own = getModuleFootprintBoundsCm(moduleState);
    if (!own) continue;
    bounds = bounds
      ? {
        minXCm: Math.min(bounds.minXCm, own.minXCm),
        maxXCm: Math.max(bounds.maxXCm, own.maxXCm),
        minYCm: Math.min(bounds.minYCm, own.minYCm),
        maxYCm: Math.max(bounds.maxYCm, own.maxYCm),
      }
      : own;
  }
  return bounds;
}

function boundsTouch(a, b) {
  return a.minXCm <= b.maxXCm + CLUSTER_CONTACT_GAP_CM && b.minXCm <= a.maxXCm + CLUSTER_CONTACT_GAP_CM
    && a.minYCm <= b.maxYCm + CLUSTER_CONTACT_GAP_CM && b.minYCm <= a.maxYCm + CLUSTER_CONTACT_GAP_CM;
}

/**
 * Serbest öğe kümeleri: aynı gruptakiler ve zemindeki izi birbirine değenler (ör. masa + sandalye,
 * serbest duvar + üstündeki TV) tek küme. Tavandaki tül yalnız grubu üzerinden kümeye girer.
 * Dönüş: byId → { key, centerXCm, centerYCm } (kümenin ortası, kenar kararı için).
 */
function buildFreeClusters(modules) {
  const parent = new Map(modules.map((moduleState) => [moduleState.id, moduleState.id]));
  const find = (id) => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root);
    parent.set(id, root);
    return root;
  };
  const join = (a, b) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootB, rootA);
  };
  const firstInGroup = new Map();
  for (const moduleState of modules) {
    const groupId = moduleState.group?.id;
    if (!groupId) continue;
    if (firstInGroup.has(groupId)) join(firstInGroup.get(groupId), moduleState.id);
    else firstInGroup.set(groupId, moduleState.id);
  }
  const touching = modules
    .filter((moduleState) => moduleState.type !== 'tulle-fabric')
    .map((moduleState) => ({ id: moduleState.id, bounds: getModuleFootprintBoundsCm(moduleState) }))
    .filter((entry) => entry.bounds);
  for (let i = 0; i < touching.length; i += 1) {
    for (let j = i + 1; j < touching.length; j += 1) {
      if (boundsTouch(touching[i].bounds, touching[j].bounds)) join(touching[i].id, touching[j].id);
    }
  }
  const membersByRoot = new Map();
  for (const moduleState of modules) {
    const root = find(moduleState.id);
    if (!membersByRoot.has(root)) membersByRoot.set(root, []);
    membersByRoot.get(root).push(moduleState);
  }
  const byId = new Map();
  for (const [root, members] of membersByRoot) {
    const bounds = unionBounds(members);
    const centerXCm = bounds ? (bounds.minXCm + bounds.maxXCm) / 2 : Number(members[0].placement.xCm);
    const centerYCm = bounds ? (bounds.minYCm + bounds.maxYCm) / 2 : Number(members[0].placement.yCm);
    for (const member of members) byId.set(member.id, { key: root, centerXCm, centerYCm });
  }
  return { byId };
}

/**
 * Taşan kümeyi bütün hâlinde içeri alır. Önce sınırlara göre en kısa kaydırma, sonra çevresi
 * halka halka denenir; sığan ilk konum yedeklenir, başka öğeye çarpmayan ilk konum seçilir.
 */
function pullClusterInside(members, others, standType, toXCm, toYCm) {
  const bases = members.map((member) => ({ ...member.placement }));
  const apply = (dx, dy) => members.forEach((member, index) => {
    member.placement = { ...bases[index], xCm: Number(bases[index].xCm) + dx, yCm: Number(bases[index].yCm) + dy };
  });
  const fits = () => members.every((member) => placementFits(member, standType, toXCm, toYCm));
  const collides = () => members.some((member) => others.some((other) => placementsOverlap(member, other)));

  const bounds = unionBounds(members);
  const step = FREE_SHIFT_STEP_CM;
  const outward = (value) => Math.sign(value) * Math.ceil(Math.abs(value) / step) * step;
  const baseDx = bounds ? outward(bounds.minXCm < 0 ? -bounds.minXCm : Math.min(0, toXCm - bounds.maxXCm)) : 0;
  const baseDy = bounds ? outward(bounds.minYCm < 0 ? -bounds.minYCm : Math.min(0, toYCm - bounds.maxYCm)) : 0;

  let fallback = null;
  const tryAt = (dx, dy, ring) => {
    apply(dx, dy);
    if (!fits()) return false;
    if (!collides()) return true;
    if (!fallback) fallback = { dx, dy, ring };
    return false;
  };
  if (tryAt(baseDx, baseDy, 0)) return true;
  for (let ring = step; ring <= FREE_SHIFT_LIMIT_CM; ring += step) {
    if (fallback && ring > fallback.ring + FREE_PLACE_SEARCH_CM) break;
    for (const [ux, uy] of CLUSTER_SEARCH_DIRECTIONS) {
      if (tryAt(baseDx + ux * ring, baseDy + uy * ring, ring)) return true;
    }
  }
  if (fallback) {
    apply(fallback.dx, fallback.dy);
    return true;
  }
  apply(0, 0);
  return false;
}

function isVerticalRotation(rotationZDeg) {
  const angle = ((Math.round(Number(rotationZDeg) || 0) % 180) + 180) % 180;
  return angle === 90;
}

/** Tülün zemindeki kapladığı alan: boy (widthCm) başlangıçtan, açıklık (heightCm) ortadan. */
function tulleBounds(moduleState) {
  const x = Number(moduleState.placement.xCm);
  const y = Number(moduleState.placement.yCm);
  const lengthCm = Number(moduleState.widthCm) || 0;
  const spanCm = Number(moduleState.heightCm) || 0;
  if (isVerticalRotation(moduleState.placement.rotationZDeg)) {
    return { minXCm: x - spanCm / 2, maxXCm: x + spanCm / 2, minYCm: y, maxYCm: y + lengthCm };
  }
  return { minXCm: x, maxXCm: x + lengthCm, minYCm: y - spanCm / 2, maxYCm: y + spanCm / 2 };
}

function tulleSpanAxes(moduleState, fromXCm, fromYCm) {
  const bounds = tulleBounds(moduleState);
  return {
    x: bounds.minXCm <= TULLE_EDGE_TOLERANCE_CM && bounds.maxXCm >= fromXCm - TULLE_EDGE_TOLERANCE_CM,
    y: bounds.minYCm <= TULLE_EDGE_TOLERANCE_CM && bounds.maxYCm >= fromYCm - TULLE_EDGE_TOLERANCE_CM,
  };
}

/** Kaplayan eksende tülü kısaltır; baştaki kenar (taşma payı) yerinde kalır. */
function shrinkTulleAxis(moduleState, axis, deltaCm) {
  const vertical = isVerticalRotation(moduleState.placement.rotationZDeg);
  const lengthAxis = vertical ? 'y' : 'x';
  if (axis === lengthAxis) {
    const next = Number(moduleState.widthCm) + deltaCm;
    if (!(next > 0)) return false;
    moduleState.widthCm = next;
    return true;
  }
  const span = Number(moduleState.heightCm);
  const next = span + deltaCm;
  if (!(next > 0)) return false;
  const key = axis === 'x' ? 'xCm' : 'yCm';
  const start = Number(moduleState.placement[key]) - span / 2;
  moduleState.heightCm = next;
  moduleState.placement = { ...moduleState.placement, [key]: start + next / 2 };
  return true;
}

function roundToStep(value, stepCm) {
  return Math.round(Number(value) / stepCm) * stepCm;
}

function resizeFloorArea(area, toXCm, toYCm, shift = { dx: 0, dy: 0 }) {
  if (!area) return { area: null, status: 'kept' };
  const x = Math.max(0, Number(area.xCm) + shift.dx);
  const y = Math.max(0, Number(area.yCm) + shift.dy);
  if (shift.dx || shift.dy) area = { ...area, xCm: x, yCm: y };
  if (x >= toXCm || y >= toYCm) return { area: null, status: 'removed' };
  const widthCm = Math.min(Number(area.widthCm), toXCm - x);
  const depthCm = Math.min(Number(area.depthCm), toYCm - y);
  if (widthCm === Number(area.widthCm) && depthCm === Number(area.depthCm)) return { area, status: 'kept' };
  return { area: { ...area, widthCm, depthCm }, status: 'clamped' };
}

function removeFromChain(moduleState, report, removedSurfaceIds) {
  if (WALL_FAMILY_TYPES.has(moduleState.type)) report.removedPanels += 1;
  else report.removedItems += 1;
  report.removedImages += surfaceImageCount(moduleState);
  collectSurfaceIds(moduleState, removedSurfaceIds);
}

/**
 * Stand genişliği / derinliği değişimini planlar. Girdi modüllerine dokunmaz.
 * stand: { standType, xCm, yCm, wallHeightCm, fascia, floorArea }.
 * Dönüş: { ok, changed, modules, floorArea, report } veya { ok: false, message }.
 */
export function planStandSizeChange({ stand, modules, toXCm, toYCm, boothType }) {
  const rules = getStandResizeRules(boothType);
  if (!rules) {
    return { ok: false, message: 'Bu stand tipinde stand ölçüsü sonradan değiştirilemiyor.' };
  }
  const standType = stand?.standType;
  const fromX = Number(stand?.xCm);
  const fromY = Number(stand?.yCm);
  const toX = Number(toXCm);
  const toY = Number(toYCm);
  if (![fromX, fromY, toX, toY].every((value) => Number.isFinite(value) && value > 0)) {
    return { ok: false, message: 'Geçersiz stand ölçüsü.' };
  }
  const report = emptySizeReport();
  const sourceModules = Array.isArray(modules) ? modules : [];
  if (fromX === toX && fromY === toY) {
    return { ok: true, changed: false, modules: sourceModules, floorArea: stand?.floorArea ?? null, report };
  }

  const dX = toX - fromX;
  const dY = toY - fromY;
  const wallHeightCm = Number(stand?.wallHeightCm) || 350;
  const chainWallIds = new Set(getContinuousWallSegments(standType, fromX, fromY).map((segment) => segment.wallId));
  const symmetricWidth = standType === 'back-wall' || standType === 'u-stand';
  // Sırt duvarı içeriğinin X kayması: L Sağ'da tam fark (köşe sağda), Sırt / U'da soldaki pay.
  const leftGrowCm = symmetricWidth ? Math.sign(dX) * Math.floor(Math.abs(dX) / 2 / 50) * 50 : 0;
  const backShift = standType === 'l-right' ? dX : leftGrowCm;
  const island = standType === 'island';
  const islandShift = { dx: roundToStep(dX / 2, FREE_SHIFT_STEP_CM), dy: roundToStep(dY / 2, FREE_SHIFT_STEP_CM) };
  const depotShift = island ? islandShift : { dx: backShift, dy: 0 };
  const removedSurfaceIds = new Set();
  const oldFascia = [];

  // Küme tek parça hareket eder (aynı grup veya izi birbirine değen serbest öğeler);
  // kenar kararı kümenin ortasından verilir.
  const isFreeSource = (moduleState) => Boolean(moduleState?.placement)
    && moduleState.autoFascia !== true
    && !isDepotModule(moduleState)
    && !(CHAIN_WALL_IDS.has(moduleState.placement.wallId) && chainWallIds.has(moduleState.placement.wallId));
  const clusters = buildFreeClusters(sourceModules.filter(isFreeSource));
  const tulleSpans = new Map();
  for (const moduleState of sourceModules) {
    if (moduleState?.type !== 'tulle-fabric' || !isFreeSource(moduleState)) continue;
    tulleSpans.set(moduleState.id, tulleSpanAxes(moduleState, fromX, fromY));
  }

  // Açık uca kadar uzanan duvarlar (eski ölçüye göre): uzayan kenarda yalnız bunlara panel eklenir.
  const reachesOpenEnd = { back: false, backStart: false, left: false, right: false };
  for (const moduleState of sourceModules) {
    const wallId = moduleState?.placement?.wallId;
    if (!WALL_FAMILY_TYPES.has(moduleState?.type) || !chainWallIds.has(wallId)) continue;
    const { start, end } = wallRange(moduleState);
    if (wallId === 'back') {
      if (start <= EPSILON_CM) reachesOpenEnd.backStart = true;
      if (end >= fromX - EPSILON_CM) reachesOpenEnd.back = true;
    } else if (end >= fromY - EPSILON_CM) {
      reachesOpenEnd[wallId] = true;
    }
  }

  const freeIds = new Set();
  const movedIds = new Set();
  const next = [];
  for (const source of sourceModules) {
    if (!source) continue;
    if (source.autoFascia === true) {
      oldFascia.push(source);
      continue;
    }
    const moduleState = structuredClone(source);
    if (!moduleState.placement) {
      next.push(moduleState);
      continue;
    }

    if (isDepotModule(moduleState)) {
      shiftPlacement(moduleState, depotShift.dx, depotShift.dy);
      next.push(moduleState);
      continue;
    }

    const wallId = moduleState.placement.wallId;
    if (CHAIN_WALL_IDS.has(wallId) && chainWallIds.has(wallId)) {
      if (wallId === 'back') shiftPlacement(moduleState, backShift, 0);
      if (wallId === 'right') shiftPlacement(moduleState, dX, 0);
      const lengthCm = wallId === 'back' ? toX : toY;
      const { start, end } = wallRange(moduleState);
      if (end <= EPSILON_CM || start >= lengthCm - EPSILON_CM) {
        removeFromChain(moduleState, report, removedSurfaceIds);
        continue;
      }
      if (start < -EPSILON_CM || end > lengthCm + EPSILON_CM) {
        const keptStart = Math.max(0, start);
        const narrowed = WALL_FAMILY_TYPES.has(moduleState.type)
          ? narrowWallPanel(moduleState, Math.min(lengthCm, end) - keptStart, wallHeightCm)
          : null;
        if (!narrowed) {
          removeFromChain(moduleState, report, removedSurfaceIds);
          continue;
        }
        narrowed.placement = { ...narrowed.placement, [wallAxisKey(wallId)]: keptStart };
        report.narrowedPanels += 1;
        next.push(narrowed);
        continue;
      }
      next.push(moduleState);
      continue;
    }

    // Serbest öğe: ada standda bütün içerik birlikte ortada kalır; diğer tiplerde en yakın
    // kenara olan mesafesini korur.
    const cluster = clusters.byId.get(moduleState.id);
    const refX = cluster ? cluster.centerXCm : Number(moduleState.placement.xCm);
    const refY = cluster ? cluster.centerYCm : Number(moduleState.placement.yCm);
    let dx = freeShiftFor(refX, fromX, dX);
    if (island) dx = islandShift.dx;
    else if (symmetricWidth) dx = leftGrowCm;
    let dy = island ? islandShift.dy : freeShiftFor(refY, fromY, dY);
    // Standı uçtan uca kaplayan tül (kullanıcı kararı 2026-11-10): stand kısalınca o eksende
    // kısalır, uzayınca uzamaz; kaplayan eksende kaymaz, kenar taşma payı korunur.
    const span = tulleSpans.get(moduleState.id);
    if (span?.x && dX < 0) {
      dx = 0;
      if (shrinkTulleAxis(moduleState, 'x', dX)) report.shortenedTulles += 1;
    }
    if (span?.y && dY < 0) {
      dy = 0;
      if (shrinkTulleAxis(moduleState, 'y', dY)) report.shortenedTulles += 1;
    }
    shiftPlacement(moduleState, dx, dy);
    if (dx || dy) movedIds.add(moduleState.id);
    freeIds.add(moduleState.id);
    next.push(moduleState);
  }

  // Uzayan kenar: açık uca yeni düz paneller.
  const fills = [];
  if (dX > 0 && chainWallIds.has('back')) {
    if (standType === 'l-right') {
      if (reachesOpenEnd.backStart) fills.push({ wallId: 'back', startCm: 0, lengthCm: dX });
    } else if (symmetricWidth) {
      if (leftGrowCm > 0 && reachesOpenEnd.backStart) fills.push({ wallId: 'back', startCm: 0, lengthCm: leftGrowCm });
      if (dX - leftGrowCm > 0 && reachesOpenEnd.back) {
        fills.push({ wallId: 'back', startCm: fromX + leftGrowCm, lengthCm: dX - leftGrowCm });
      }
    } else if (reachesOpenEnd.back) {
      fills.push({ wallId: 'back', startCm: fromX, lengthCm: dX });
    }
  }
  for (const wallId of ['left', 'right']) {
    if (dY > 0 && chainWallIds.has(wallId) && reachesOpenEnd[wallId]) {
      fills.push({ wallId, startCm: fromY, lengthCm: dY });
    }
  }
  for (const fill of fills) {
    const composed = composeStraightWall(fill.lengthCm);
    if (!composed.ok) return { ok: false, message: composed.message };
    let cursor = fill.startCm;
    for (const widthCm of composed.modules) {
      const panel = createStandWallPanelState(widthCm, wallHeightCm);
      if (!panel) return { ok: false, message: `${widthCm} cm duvar paneli bulunamadı.` };
      panel.placement = chainPlacement(fill.wallId, cursor, toX);
      next.push(panel);
      report.addedPanels += 1;
      cursor += widthCm;
    }
  }

  // Alınlık: yeni kenarlara göre yeniden kurulur, bantlar aynı konuma aktarılır.
  if (oldFascia.length && stand?.fascia?.enabled) {
    const plan = planAutomaticFascia({ standType, standXCm: toX, standYCm: toY, rows: stand.fascia.rows });
    if (!plan.ok) return { ok: false, message: plan.message };
    const states = createAutomaticFasciaStates(plan, wallHeightCm);
    const contentShift = island ? islandShift : { dx: backShift, dy: 0 };
    transferFasciaSurfaces(oldFascia.filter((module) => Array.isArray(module.strips)), states, removedSurfaceIds, contentShift);
    next.push(...states);
    report.fasciaRebuilt = true;
  } else {
    // Alınlık ayarı kapalıyken kalan alınlık parçaları olduğu gibi korunur.
    next.push(...oldFascia.map((module) => structuredClone(module)));
  }

  // Taşan küme bütün hâlinde içeri alınır: en kısa kaydırma, mümkünse başka öğeye çarpmayan yer.
  const clusterMembers = new Map();
  for (const moduleState of next) {
    if (!freeIds.has(moduleState.id)) continue;
    const key = clusters.byId.get(moduleState.id)?.key ?? moduleState.id;
    if (!clusterMembers.has(key)) clusterMembers.set(key, []);
    clusterMembers.get(key).push(moduleState);
  }
  for (const members of clusterMembers.values()) {
    if (members.every((member) => placementFits(member, standType, toX, toY))) continue;
    const memberSet = new Set(members);
    const others = next.filter((other) => !memberSet.has(other) && other.placement);
    if (pullClusterInside(members, others, standType, toX, toY)) {
      report.clampedItems += members.length;
      members.forEach((member) => movedIds.add(member.id));
    } else {
      report.outsideItems += members.length;
    }
  }
  report.movedItems = movedIds.size;
  for (const moduleState of next) {
    if (!movedIds.has(moduleState.id)) continue;
    const key = clusters.byId.get(moduleState.id)?.key ?? moduleState.id;
    const hit = next.some((other) => other !== moduleState
      && (clusters.byId.get(other.id)?.key ?? other.id) !== key
      && other.placement
      && placementsOverlap(moduleState, other));
    if (hit) report.collidingItems += 1;
  }

  applyFabricWork(next, { added: [], removedIds: removedSurfaceIds }, { extendedFabrics: 0 });
  const floorShift = island ? { dx: roundToStep(dX / 2, 50), dy: roundToStep(dY / 2, 50) } : { dx: 0, dy: 0 };
  const floor = resizeFloorArea(stand?.floorArea ?? null, toX, toY, floorShift);
  report.floorArea = floor.status;
  return { ok: true, changed: true, modules: next, floorArea: floor.area, report };
}

/**
 * Ölçü değişimi bir şey kaldırıyor mu (kullanıcı kararı 2026-11-10): kaldırıyorsa önce önizleme
 * penceresi sorar; kaldırmıyorsa (büyütme, hiçbir şey gitmeyen küçültme) doğrudan uygulanır.
 */
export function standSizeChangeRemovesContent(report) {
  return Boolean(report.removedPanels || report.removedImages || report.removedItems
    || report.outsideItems || report.floorArea === 'removed');
}

/** Önizleme metni: ölçü değişiminde ne olacağını sayar. */
export function describeStandSizeChangeReport(report) {
  const lines = [];
  if (report.addedPanels) lines.push(`${report.addedPanels} duvar paneli eklenecek.`);
  if (report.narrowedPanels) lines.push(`${report.narrowedPanels} duvar paneli daraltılacak.`);
  if (report.removedPanels) lines.push(`${report.removedPanels} duvar paneli kaldırılacak.`);
  if (report.removedImages) lines.push(`${report.removedImages} görsel kaldırılan panellerle birlikte gidecek.`);
  if (report.removedItems) lines.push(`${report.removedItems} duvar üstü öğe kaldırılacak.`);
  if (report.fasciaRebuilt) lines.push('Alınlık yeni kenara göre yeniden kurulacak; görseller aynı konuma taşınacak.');
  if (report.movedItems) lines.push(`${report.movedItems} öğe yakın olduğu kenarla birlikte taşınacak.`);
  if (report.clampedItems) lines.push(`${report.clampedItems} öğe bağlı olduğu kümeyle birlikte stand içine taşınacak.`);
  if (report.shortenedTulles) lines.push(`${report.shortenedTulles} tül yeni stand ölçüsüne kısalacak.`);
  if (report.outsideItems) lines.push(`${report.outsideItems} öğe yeni stand alanına sığmıyor; elle taşınmalı.`);
  if (report.collidingItems) lines.push(`${report.collidingItems} öğe başka bir öğeyle çakışıyor; kontrol et.`);
  if (report.floorArea === 'clamped') lines.push('Bölgesel zemin yeni alana sığdırılacak.');
  if (report.floorArea === 'removed') lines.push('Bölgesel zemin yeni alanın dışında kaldığı için kaldırılacak.');
  return lines;
}

// ---------------------------------------------------------------------------
// Kurulum parçaları: sihirbazın Oluştur adımı, Sahneyi Sıfırla ve yapı değişimi aynı dizimi kullanır.

/** Zincir duvarlar (sırt / sol / sağ); depo varsa sırt ve L'de yan duvar depoya göre dizilir. */
export function composeStandWallStates({ standType, standXCm, standYCm, wallHeightCm, depotPlan = null }) {
  if (standType === 'island') return { ok: true, modules: [] };
  const automaticWall = composeAutomaticStandWall({
    wallWidthCm: getAutomaticWallCapacityCm({ standType, standXCm, standYCm }),
    standType,
    standXCm,
    standYCm,
  });
  if (!automaticWall.ok) return { ok: false, message: automaticWall.message };
  let modules = automaticWall.widths.map((widthCm, index) => {
    const moduleState = createStandWallPanelState(widthCm, wallHeightCm);
    moduleState.placement = { ...automaticWall.placements[index] };
    return moduleState;
  });
  if (!depotPlan?.ok) return { ok: true, modules };

  const customBack = composeAutomaticBackWallWithDepot({
    standXCm,
    depotOriginXCm: depotPlan.originXCm,
    depotWidthCm: depotPlan.widthCm,
    sizeKey: depotPlan.sizeKey,
  });
  if (!customBack.ok) return { ok: false, message: customBack.message };
  modules = modules.filter((moduleState) => moduleState.placement?.wallId !== 'back');
  for (const entry of customBack.modules) {
    const moduleState = createStandWallPanelState(entry.widthCm, wallHeightCm);
    moduleState.placement = { ...entry.placement };
    if (entry.depotBack) {
      moduleState.autoDepotBack = true;
      moduleState.depotBack = true;
    }
    modules.push(moduleState);
  }
  if (standType === 'l-left' || standType === 'l-right') {
    const customSide = composeAutomaticSideWallWithDepot({
      standType,
      standXCm,
      standYCm,
      depotDepthCm: depotPlan.depthCm,
    });
    if (!customSide.ok) return { ok: false, message: customSide.message };
    modules = modules.filter((moduleState) => moduleState.placement?.wallId !== customSide.wallId);
    for (const entry of customSide.modules) {
      const moduleState = createStandWallPanelState(entry.widthCm, wallHeightCm);
      moduleState.placement = { ...entry.placement };
      if (entry.depotSide) {
        moduleState.autoDepotBack = true;
        moduleState.depotSide = true;
      }
      modules.push(moduleState);
    }
  }
  return { ok: true, modules };
}

/** Depo gövdesi (duvar, kapı) ve isteğe bağlı içeriği; hepsi `autoDepot` işaretlidir. */
export function createDepotStates(plan, wallHeightCm) {
  if (!plan?.ok) return [];
  return plan.specs.map((spec) => {
    if (spec.kind === 'door') {
      const state = createModuleStateFromCatalogKey(resolveWallItemKeyForHeight('wall_door_100_350', wallHeightCm));
      if (!state) return null;
      state.placement = { ...spec.placement };
      state.autoDepot = true;
      return state;
    }
    const descriptor = {
      ...spec,
      type: spec.kind === 'wall' ? 'flat-panel' : spec.kind,
    };
    // Depo duvarı da standın yüksekliğindeki düz duvardır.
    if (descriptor.type === 'flat-panel') {
      descriptor.itemKey = spec.itemKey
        ? resolveWallItemKeyForHeight(spec.itemKey, wallHeightCm)
        : resolveAutomaticWallFlatPanelItemKey(spec.widthCm, wallHeightCm);
    }
    const state = createModuleStateFromDescriptor(descriptor);
    if (!state) return null;
    state.placement = { ...spec.placement };
    state.autoDepot = true;
    return state;
  }).filter(Boolean);
}

/** Depo duvarlarının üstündeki otomatik projektörler; `modules` sahnedeki bütün modüllerdir (yapışma için). */
export function createDepotLampStates(modules) {
  const lampItem = getTopLightItemForType('led-floodlight');
  if (!lampItem) return [];
  const planned = planAutomaticDepotLampPlacements({
    modules: modules.filter((moduleState) => moduleState.depotSide || moduleState.autoDepot),
    lampWidthCm: Number(lampItem.dimensions?.widthCm) || 50,
  });
  const lamps = [];
  for (const placement of planned) {
    const lamp = createModuleStateFromDescriptor({ type: 'led-floodlight' });
    if (!lamp) continue;
    lamp.placement = snapPlacementToItemAnchor(lamp, placement, modules) ?? { ...placement };
    lamps.push(lamp);
  }
  return lamps;
}

// ---------------------------------------------------------------------------
// Yerleşim (Sırt Duvar / U / L Sol / L Sağ / Ada). Ürün kararları (kullanıcı, 2026-11-10):
// - Yeni yerleşimde de olan duvar yerinde kalır; görseli, kaplaması ve üstündeki öğeler korunur.
// - Yeni yerleşimde olmayan kenarın duvarı görselleri ve üstündeki öğelerle kalkar
//   (Ada'ya geçişte bütün kenar duvarları). Kalkan görsel hatırlanmaz; Geri al döner.
// - Yeni kenara boş, kilitli düz duvar gelir (otomatik projektör eklenmez).
// - Serbest öğeler yerinde kalır; yeni duvar / depoyla çakışan küme bütün hâlinde içeri alınır.
// - Depo yeni yerleşimdeki yerine kurulur (yeri ve dizimi değişmiyorsa dokunulmaz); alınlık yeni
//   açık kenarlara göre yeniden kurulur, görselleri aynı konumdaki panele aktarılır.
// - Önizleme + onay, tek adım Geri al (ölçü değişimiyle aynı akış).

const DEPOT_LAMP_MARGIN_CM = 15;

function depotSignature(plan) {
  if (!plan?.ok) return null;
  const pieces = plan.specs
    .filter((spec) => spec.kind === 'wall' || spec.kind === 'door')
    .map((spec) => `${spec.kind}:${spec.widthCm}:${spec.placement?.xCm}:${spec.placement?.yCm}:${spec.placement?.rotationZDeg}`)
    .sort();
  return `${plan.originXCm}:${plan.originYCm}:${pieces.join('|')}`;
}

function insideBox(moduleState, box) {
  const bounds = getModuleFootprintBoundsCm(moduleState);
  if (!bounds) return false;
  return bounds.minXCm >= box.minXCm - DEPOT_LAMP_MARGIN_CM && bounds.maxXCm <= box.maxXCm + DEPOT_LAMP_MARGIN_CM
    && bounds.minYCm >= box.minYCm - DEPOT_LAMP_MARGIN_CM && bounds.maxYCm <= box.maxYCm + DEPOT_LAMP_MARGIN_CM;
}

function emptyLayoutReport() {
  return {
    removedWalls: [],
    addedWalls: [],
    removedPanels: 0,
    removedImages: 0,
    removedItems: 0,
    addedPanels: 0,
    depotAdded: false,
    depotRemoved: false,
    depotRebuilt: false,
    removedDepotItems: 0,
    depotContentsAdded: 0,
    fasciaRebuilt: false,
    fasciaRemoved: false,
    furnitureAdded: 0,
    furnitureRemoved: 0,
    clampedItems: 0,
    outsideItems: 0,
    collidingItems: 0,
  };
}

function normalizeDepotConfig(depot) {
  return depot?.enabled && depot.sizeKey
    ? { enabled: true, sizeKey: depot.sizeKey, includeContents: Boolean(depot.includeContents) }
    : { enabled: false, sizeKey: null, includeContents: false };
}

function normalizeFasciaConfig(fascia) {
  const rows = Number(fascia?.rows) || 0;
  return fascia?.enabled && rows ? { enabled: true, rows } : { enabled: false, rows: null };
}

/** Otomatik stand mobilyaları: katalog Item'ı olarak oluşur, kilitsizdir; kullanıcı taşıyıp silebilir. */
export function createFurnitureStates(plan) {
  if (!plan?.ok) return [];
  return plan.specs.map((spec) => {
    const state = createModuleStateFromCatalogKey(spec.itemKey);
    if (!state) return null;
    state.placement = { ...spec.placement };
    return state;
  }).filter(Boolean);
}

function placementDistance(a, b) {
  return Math.hypot(Number(a.xCm) - Number(b.xCm), Number(a.yCm) - Number(b.yCm));
}

/**
 * Stand yapısı değişimini planlar: yerleşim, depo (yok / ölçü / içerik), alınlık (yok / tek / çift)
 * ve stand mobilyaları. Girdi modüllerine dokunmaz.
 * stand: { standType, xCm, yCm, wallHeightCm, depot, fascia, furniture }.
 * to: { standType?, depot?, fascia?, furniture? } — verilmeyen alan değişmez.
 * Dönüş: { ok, changed, modules, stand, report } veya { ok: false, message }.
 */
export function planStandStructureChange({ stand, modules, to = {}, boothType }) {
  if (!getStandResizeRules(boothType)) {
    return { ok: false, message: 'Bu stand tipinde stand yapısı sonradan değiştirilemiyor.' };
  }
  const fromType = stand?.standType;
  const toType = to.standType ?? fromType;
  const xCm = Number(stand?.xCm);
  const yCm = Number(stand?.yCm);
  const wallHeightCm = Number(stand?.wallHeightCm) || 350;
  const report = emptyLayoutReport();
  const sourceModules = Array.isArray(modules) ? modules : [];

  const fromDepot = normalizeDepotConfig(stand?.depot);
  const toDepot = to.depot === undefined ? fromDepot : normalizeDepotConfig(to.depot);
  const fromFascia = normalizeFasciaConfig(stand?.fascia);
  const toFascia = to.fascia === undefined ? fromFascia : normalizeFasciaConfig(to.fascia);
  const fromFurniture = Boolean(stand?.furniture?.enabled);
  const toFurniture = to.furniture === undefined ? fromFurniture : Boolean(to.furniture?.enabled);
  const nextStand = { ...stand, standType: toType, depot: toDepot, fascia: toFascia, furniture: { enabled: toFurniture } };

  const typeChanged = toType !== fromType;
  const depotChanged = JSON.stringify(fromDepot) !== JSON.stringify(toDepot);
  const fasciaChanged = JSON.stringify(fromFascia) !== JSON.stringify(toFascia);
  const furnitureChanged = fromFurniture !== toFurniture;
  if (!typeChanged && !depotChanged && !fasciaChanged && !furnitureChanged) {
    return { ok: true, changed: false, modules: sourceModules, stand: nextStand, report };
  }

  const fromWalls = new Set(getContinuousWallSegments(fromType, xCm, yCm).map((segment) => segment.wallId));
  const toWalls = new Set(getContinuousWallSegments(toType, xCm, yCm).map((segment) => segment.wallId));
  report.removedWalls = [...fromWalls].filter((wallId) => !toWalls.has(wallId));
  report.addedWalls = [...toWalls].filter((wallId) => !fromWalls.has(wallId));

  // Depo: yeri, dizimi ve içeriği aynıysa dokunulmaz; değilse kaldırılıp yeni yerine kurulur.
  const planDepot = (standType, config) => (config.enabled ? planAutomaticDepot({
    standType,
    standXCm: xCm,
    standYCm: yCm,
    sizeKey: config.sizeKey,
    includeContents: config.includeContents,
  }) : null);
  const oldDepot = planDepot(fromType, fromDepot);
  const newDepot = planDepot(toType, toDepot);
  if (newDepot && !newDepot.ok) return { ok: false, message: newDepot.message };
  const depotWallsChange = depotSignature(oldDepot) !== depotSignature(newDepot);
  // Yalnız ekipman değişiyorsa depo yerinde kalır (duvarındaki görseller korunur); ekipman eklenir / kalkar.
  const contentsOnly = fromDepot.enabled && toDepot.enabled && fromDepot.sizeKey === toDepot.sizeKey
    && !depotWallsChange && fromDepot.includeContents !== toDepot.includeContents;
  const rebuildDepot = depotWallsChange || (depotChanged && !contentsOnly);
  const oldDepotBox = oldDepot?.ok ? {
    minXCm: oldDepot.originXCm,
    maxXCm: oldDepot.originXCm + oldDepot.widthCm,
    minYCm: oldDepot.originYCm,
    maxYCm: oldDepot.originYCm + oldDepot.depthCm,
  } : null;

  // Yeni kenarlar ve depoyla birlikte yeniden dizilen zincir duvarlar (sırt; L'de depolu yan duvar).
  const freshWalls = composeStandWallStates({
    standType: toType, standXCm: xCm, standYCm: yCm, wallHeightCm, depotPlan: newDepot,
  });
  if (!freshWalls.ok) return { ok: false, message: freshWalls.message };
  const recomposedWalls = new Set(report.addedWalls);
  if (depotWallsChange) {
    for (const moduleState of sourceModules) {
      const wallId = moduleState?.placement?.wallId;
      if ((moduleState?.depotBack || moduleState?.depotSide) && toWalls.has(wallId)) recomposedWalls.add(wallId);
    }
    for (const moduleState of freshWalls.modules) {
      if (moduleState.depotBack || moduleState.depotSide) recomposedWalls.add(moduleState.placement.wallId);
    }
  }
  const rebuildFascia = typeChanged || fasciaChanged;

  const removedSurfaceIds = new Set();
  const oldFascia = [];
  const oldWallPanels = new Map();
  const next = [];
  const freeIds = new Set();
  for (const source of sourceModules) {
    if (!source) continue;
    if (source.autoFascia === true) {
      if (rebuildFascia) oldFascia.push(source);
      else next.push(structuredClone(source));
      continue;
    }
    const moduleState = structuredClone(source);
    const wallId = moduleState.placement?.wallId;
    const isChainPiece = CHAIN_WALL_IDS.has(wallId) && fromWalls.has(wallId);

    const isDepotFixture = moduleState.autoDepot === true && !['flat-panel', 'door'].includes(moduleState.type);
    if ((rebuildDepot && moduleState.autoDepot === true)
      || (contentsOnly && !toDepot.includeContents && isDepotFixture)) {
      report.removedDepotItems += 1;
      report.removedImages += surfaceImageCount(moduleState);
      collectSurfaceIds(moduleState, removedSurfaceIds);
      continue;
    }
    if (rebuildDepot && oldDepotBox && moduleState.type === 'led-floodlight' && !isChainPiece
      && insideBox(moduleState, oldDepotBox)) continue;

    if (isChainPiece && !toWalls.has(wallId)) {
      removeFromChain(moduleState, report, removedSurfaceIds);
      continue;
    }
    if (isChainPiece && recomposedWalls.has(wallId) && WALL_FAMILY_TYPES.has(moduleState.type)) {
      // Panel yeniden dizilir; görseli aynı konumdaki yeni panele aktarılır.
      if (!oldWallPanels.has(wallId)) oldWallPanels.set(wallId, []);
      oldWallPanels.get(wallId).push(moduleState);
      continue;
    }
    if (!isChainPiece && moduleState.placement && !isDepotModule(moduleState)) freeIds.add(moduleState.id);
    next.push(moduleState);
  }

  for (const wallId of recomposedWalls) {
    const fresh = freshWalls.modules.filter((moduleState) => moduleState.placement?.wallId === wallId);
    const previous = oldWallPanels.get(wallId) ?? [];
    transferWallSurfaces(previous, fresh, removedSurfaceIds);
    for (const panel of previous) {
      if ([...collectPanelSurfaceIds(panel)].some((id) => removedSurfaceIds.has(id))) {
        report.removedImages += surfaceImageCount(panel);
      }
    }
    if (!previous.length) report.addedPanels += fresh.length;
    next.push(...fresh);
  }

  if (rebuildDepot && newDepot?.ok) {
    next.push(...createDepotStates(newDepot, wallHeightCm));
    next.push(...createDepotLampStates(next));
  }
  if (contentsOnly && toDepot.includeContents && newDepot?.ok) {
    const fixtures = createDepotStates(newDepot, wallHeightCm)
      .filter((moduleState) => !['flat-panel', 'door'].includes(moduleState.type));
    next.push(...fixtures);
    report.depotContentsAdded = fixtures.length;
  }
  if (depotChanged) {
    report.depotAdded = !fromDepot.enabled && toDepot.enabled;
    report.depotRemoved = fromDepot.enabled && !toDepot.enabled;
  }
  report.depotRebuilt = rebuildDepot && toDepot.enabled && fromDepot.enabled;
  report.depotContentsRemoved = contentsOnly && !toDepot.includeContents;

  // Alınlık yeni açık kenarlara / yeni sıra sayısına göre yeniden kurulur ya da kalkar.
  if (rebuildFascia) {
    if (toFascia.enabled) {
      const plan = planAutomaticFascia({ standType: toType, standXCm: xCm, standYCm: yCm, rows: toFascia.rows });
      if (!plan.ok) return { ok: false, message: plan.message };
      const states = createAutomaticFasciaStates(plan, wallHeightCm);
      transferFasciaSurfaces(oldFascia.filter((moduleState) => Array.isArray(moduleState.strips)), states, removedSurfaceIds);
      next.push(...states);
      if (oldFascia.length || fasciaChanged) report.fasciaRebuilt = true;
    } else if (oldFascia.length) {
      for (const moduleState of oldFascia) {
        report.removedImages += surfaceImageCount(moduleState);
        collectSurfaceIds(moduleState, removedSurfaceIds);
      }
      report.fasciaRemoved = true;
    }
  }

  // Stand mobilyaları (kullanıcı kararı 2026-11-10): işaretlenince set sahnede benzeri olsa da
  // eklenir; kaldırılınca setteki her üründen sahnede varsa birer tane, setin yerine en yakını kalkar.
  if (furnitureChanged) {
    const plan = planAutomaticFurniture({ standXCm: xCm, standYCm: yCm, depot: newDepot });
    if (!plan.ok) return { ok: false, message: plan.message };
    if (toFurniture) {
      const states = createFurnitureStates(plan);
      next.push(...states);
      report.furnitureAdded = states.length;
    } else {
      for (const spec of plan.specs) {
        let bestIndex = -1;
        let bestDistance = Infinity;
        next.forEach((moduleState, index) => {
          if (moduleState.itemKey !== spec.itemKey || !moduleState.placement) return;
          const distance = placementDistance(moduleState.placement, spec.placement);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = index;
          }
        });
        if (bestIndex < 0) continue;
        const [removed] = next.splice(bestIndex, 1);
        freeIds.delete(removed.id);
        report.furnitureRemoved += 1;
      }
    }
  }

  // Yeni duvar / depoyla çakışan veya yeni yerleşime uymayan serbest küme bütün hâlinde en yakın
  // boş yere itilir (depodan dışarı).
  const clusters = buildFreeClusters(next.filter((moduleState) => freeIds.has(moduleState.id)));
  const clusterMembers = new Map();
  for (const moduleState of next) {
    if (!freeIds.has(moduleState.id)) continue;
    const key = clusters.byId.get(moduleState.id)?.key ?? moduleState.id;
    if (!clusterMembers.has(key)) clusterMembers.set(key, []);
    clusterMembers.get(key).push(moduleState);
  }
  const structural = next.filter((moduleState) => !freeIds.has(moduleState.id) && moduleState.placement);
  for (const members of clusterMembers.values()) {
    const blocked = members.some((member) => !placementFits(member, toType, xCm, yCm)
      || structural.some((other) => placementsOverlap(member, other)));
    if (!blocked) continue;
    const memberSet = new Set(members);
    const others = next.filter((other) => !memberSet.has(other) && other.placement);
    if (pullClusterInside(members, others, toType, xCm, yCm)) {
      report.clampedItems += members.length;
      if (members.some((member) => others.some((other) => placementsOverlap(member, other)))) {
        report.collidingItems += members.length;
      }
    } else {
      report.outsideItems += members.length;
    }
  }

  applyFabricWork(next, { added: [], removedIds: removedSurfaceIds }, { extendedFabrics: 0 });
  return { ok: true, changed: true, modules: next, stand: nextStand, report };
}

function collectPanelSurfaceIds(moduleState) {
  const ids = new Set();
  collectSurfaceIds(moduleState, ids);
  return ids;
}

/** Yerleşim değişimi: yapı planının yalnız yerleşimi değiştiren hâli. */
export function planStandLayoutChange({ stand, modules, toStandType, boothType }) {
  return planStandStructureChange({ stand, modules, to: { standType: toStandType }, boothType });
}

/**
 * Yapı değişimi bir şey kaldırıyor mu: kaldırıyorsa önce önizleme penceresi sorar; kaldırmıyorsa
 * (ör. depo / alınlık / mobilya eklemek) doğrudan uygulanır.
 */
export function standStructureChangeRemovesContent(report) {
  return Boolean(report.removedWalls.length || report.removedPanels || report.removedImages
    || report.removedItems || report.depotRemoved || report.depotRebuilt || report.removedDepotItems
    || report.fasciaRemoved || report.furnitureRemoved || report.outsideItems);
}

/** Yeniden dizilen duvarda eski panelin görseli aynı konumdaki, aynı genişlikteki yeni panele geçer. */
function transferWallSurfaces(oldPanels, newPanels, removedSurfaceIds) {
  const filled = new Set();
  for (const oldPanel of oldPanels) {
    const from = wallRange(oldPanel);
    const best = newPanels.find((candidate) => !filled.has(candidate)
      && Math.abs(wallRange(candidate).start - from.start) <= EPSILON_CM
      && Math.abs(Number(candidate.widthCm) - Number(oldPanel.widthCm)) <= EPSILON_CM
      && Array.isArray(candidate.strips) && Array.isArray(oldPanel.strips)
      && candidate.strips.length === oldPanel.strips.length);
    if (!best) {
      collectSurfaceIds(oldPanel, removedSurfaceIds);
      continue;
    }
    best.strips = structuredClone(oldPanel.strips);
    if (Array.isArray(oldPanel.backStrips)) best.backStrips = structuredClone(oldPanel.backStrips);
    filled.add(best);
  }
}

const WALL_LABELS = Object.freeze({ back: 'Sırt', left: 'Sol', right: 'Sağ' });

/** Önizleme metni: yerleşim değişiminde ne olacağını sayar. */
export function describeStandLayoutChangeReport(report) {
  const lines = [];
  if (report.removedWalls.length) {
    lines.push(`${report.removedWalls.map((wallId) => WALL_LABELS[wallId]).join(', ')} duvar kalkacak.`);
  }
  if (report.removedPanels) lines.push(`${report.removedPanels} duvar paneli kaldırılacak.`);
  if (report.removedImages) lines.push(`${report.removedImages} görsel kaldırılacak.`);
  if (report.removedItems) lines.push(`${report.removedItems} duvar üstü öğe kaldırılacak.`);
  if (report.addedWalls.length) {
    lines.push(`${report.addedWalls.map((wallId) => WALL_LABELS[wallId]).join(', ')} kenara boş duvar eklenecek (${report.addedPanels} panel).`);
  }
  if (report.depotAdded) lines.push('Depo eklenecek.');
  if (report.depotRemoved) lines.push('Depo ve içindekiler kaldırılacak.');
  if (report.depotRebuilt) lines.push('Depo yeni yerine yeniden kurulacak.');
  if (report.depotContentsAdded) lines.push(`${report.depotContentsAdded} depo ekipmanı eklenecek.`);
  if (report.depotContentsRemoved) lines.push(`${report.removedDepotItems} depo ekipmanı kaldırılacak.`);
  if (report.fasciaRebuilt) lines.push('Alınlık yeniden kurulacak; görseller aynı konuma taşınacak.');
  if (report.fasciaRemoved) lines.push('Alınlık kaldırılacak.');
  if (report.furnitureAdded) lines.push(`${report.furnitureAdded} stand mobilyası eklenecek.`);
  if (report.furnitureRemoved) lines.push(`${report.furnitureRemoved} stand mobilyası kaldırılacak (setteki her üründen birer tane).`);
  if (report.clampedItems) lines.push(`${report.clampedItems} öğe çakıştığı için bağlı olduğu kümeyle en yakın boş yere itilecek.`);
  if (report.outsideItems) lines.push(`${report.outsideItems} öğe sığmıyor; elle taşınmalı.`);
  if (report.collidingItems) lines.push(`${report.collidingItems} öğe başka bir öğeyle çakışıyor; kontrol et.`);
  return lines;
}
