/**
 * Baza runs on the production list.
 * A free row of n bazas keeps 2n+2 panels, 2 starts per panel, 2n+6 singles,
 * 2n+2 uprights and 2n+2 short profiles, and two outer 48.5 cheeks.
 * A same-width wall, separator, or showcase on a baza's back drops that baza's
 * long profile from 4 to 2 and one long panel. Uprights on the host face drop; a shared one on the same face line drops once.
 * A standalone upright (346,5 …) standing on a baza corner replaces that corner's
 * 49,5 upright (user decision 2026-11-11).
 * Short-up is not a host.
 */

import { getItem } from './items.js';
import { getWallBomSegment } from './relationshipBom.js';
import { STAND_DIMENSIONS } from './standDimensions.js';

const EPSILON_CM = 0.001;
const BASE_DEPTH_CM = 50;

const BASE_SPEC = Object.freeze({
  base_100: Object.freeze({ profile: 'profile_91', panel: 'panel_98', top: 'base_top_107_50', width: 100 }),
  base_150: Object.freeze({ profile: 'profile_140_5', panel: 'panel_147_5', top: 'base_top_157_50', width: 150 }),
  base_200: Object.freeze({ profile: 'profile_190', panel: 'panel_197', top: 'base_top_206_50', width: 200 }),
});

const HOST_WIDTH_CM = Object.freeze({
  wall_100_350: 100,
  wall_150_350: 150,
  wall_200_350: 200,
  wall_separator_50_350: 50,
  wall_separator_100_350: 100,
  wall_separator_50_350_sarmasik: 50,
  wall_separator_100_350_sarmasik: 100,
  wall_showcase_100_2_350: 100,
  wall_showcase_100_3_350: 100,
});

function nearlyEqual(a, b) {
  return Math.abs(Number(a) - Number(b)) <= EPSILON_CM;
}

function normalizeRotationZDeg(rotationZDeg) {
  const value = Number(rotationZDeg);
  if (!Number.isFinite(value)) return 0;
  const normalized = ((value % 360) + 360) % 360;
  return normalized;
}

function isVerticalRotation(rotationZDeg) {
  const rot = normalizeRotationZDeg(rotationZDeg);
  return nearlyEqual(rot, 90) || nearlyEqual(rot, 270);
}

function frontNormal(rotationZDeg) {
  const theta = normalizeRotationZDeg(rotationZDeg) * Math.PI / 180;
  return { x: Math.sin(theta), y: Math.cos(theta) };
}

function baseSpec(itemKey) {
  return BASE_SPEC[itemKey] ?? null;
}

export function isBaseRunItemKey(itemKey) {
  return Boolean(baseSpec(itemKey));
}

function hostWidthCm(itemKey) {
  // Türetilmiş duvar yüksekliği (wall_100_250 …) ana 350 koduyla aynı host'tur.
  const baseKey = getItem(itemKey)?.wallHeightBaseItemKey ?? itemKey;
  return HOST_WIDTH_CM[baseKey] ?? null;
}

function bazaFrame(module) {
  const spec = baseSpec(module?.itemKey);
  const placement = module?.placement;
  if (!spec || !placement) return null;
  const x = Number(placement.xCm);
  const y = Number(placement.yCm);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const width = spec.width;
  const depth = Number(module.depthCm) > 0 ? Number(module.depthCm) : BASE_DEPTH_CM;
  const vertical = isVerticalRotation(placement.rotationZDeg);
  const centerX = vertical ? x : x + width / 2;
  const centerY = vertical ? y + width / 2 : y;
  const front = frontNormal(placement.rotationZDeg);
  const backFixed = vertical
    ? centerX - front.x * (depth / 2)
    : centerY - front.y * (depth / 2);

  return {
    moduleId: module.id ?? null,
    itemKey: module.itemKey,
    spec,
    axis: vertical ? 'y' : 'x',
    centerFixed: vertical ? centerX : centerY,
    backFixed,
    depth,
    start: vertical ? y : x,
    end: (vertical ? y : x) + width,
  };
}

function hostFrame(module) {
  const width = hostWidthCm(module?.itemKey);
  const segment = width ? getWallBomSegment(module) : null;
  if (!segment) return null;
  return {
    axis: segment.axis,
    fixedCm: segment.fixedCm,
    start: segment.startCm,
    end: segment.endCm,
    width,
  };
}

// Tek başına duran dikmenin plan merkezi (dik açıda). Gövdesi köşe noktasının üstündeyse (merkez
// köşeye yarım kesitten yakın) o köşenin 49,5 dikmesinin yerini alır. Bazanın yanına sıfır yaslanmış
// dikme (merkez tam yarım kesit uzakta) köşeyi kaplamaz; baza kendi dikmesini korur.
function uprightFrame(module) {
  const item = getItem(module?.itemKey);
  const placement = module?.placement;
  if ((item?.type ?? module?.type) !== 'upright' || !placement) return null;
  const x = Number(placement.xCm);
  const y = Number(placement.yCm);
  const width = Number(module.widthCm) || Number(item?.dimensions?.widthCm) || 0;
  if (!Number.isFinite(x) || !Number.isFinite(y) || width <= 0) return null;
  if (!nearlyEqual(normalizeRotationZDeg(placement.rotationZDeg) % 90, 0)) return null;
  const vertical = isVerticalRotation(placement.rotationZDeg);
  return {
    xCm: vertical ? x : x + width / 2,
    yCm: vertical ? y + width / 2 : y,
    halfCm: width / 2,
  };
}

// Dikme köşeyi kaplar: gövdesi köşe noktasının üstündedir ya da köşenin içinde, bazanın iki dış
// yüzüyle hizalı durur (kullanıcı kararı 2026-11-11: dikme bazanın köşe dikmesinin yerinde durur).
// `inwardAlong` / `inwardAcross` köşeden bazanın içine doğru işarettir. Dışarıdan yaslı dikme kaplamaz.
function uprightOnPoint(upright, axis, alongCm, acrossCm, inwardAlong = 0, inwardAcross = 0) {
  const along = axis === 'x' ? upright.xCm : upright.yCm;
  const across = axis === 'x' ? upright.yCm : upright.xCm;
  const half = upright.halfCm;
  if (Math.abs(along - alongCm) < half - EPSILON_CM && Math.abs(across - acrossCm) < half - EPSILON_CM) return true;
  if (!inwardAlong || !inwardAcross) return false;
  const insideAlong = (along - alongCm) * inwardAlong;
  const insideAcross = (across - acrossCm) * inwardAcross;
  return insideAlong > -EPSILON_CM && insideAlong < half + EPSILON_CM
    && insideAcross > -EPSILON_CM && insideAcross < half + EPSILON_CM;
}

function framesTouch(a, b) {
  if (a.axis !== b.axis || !nearlyEqual(a.centerFixed, b.centerFixed)) return false;
  return nearlyEqual(a.end, b.start) || nearlyEqual(b.end, a.start);
}

/**
 * The host wall sits inside the baza back strip (back faces flush; centers (depth - wall) / 2
 * apart, user decision 2026-11-11) or, in older projects, flush behind the baza
 * ((depth + wall) / 2 apart).
 * The span must match; a 200 baza does not sit on a 100 host.
 */
function hostCovers(base, host) {
  if (!host || base.axis !== host.axis) return false;
  if (base.spec.width !== host.width) return false;
  if (!nearlyEqual(base.start, host.start) || !nearlyEqual(base.end, host.end)) return false;
  // Duvar bazanın arka kenarının içinde, arka yüzler hizalı (kullanıcı kararı 2026-11-11; yaslanma
  // kuralı `modulePlacement.js` isWallInBaseBack) ya da eski düzende bazanın arkasında, yüze sıfır.
  const insideGapCm = (base.depth - STAND_DIMENSIONS.depthCm) / 2;
  const outsideGapCm = (base.depth + STAND_DIMENSIONS.depthCm) / 2;
  const gapCm = Math.abs(base.centerFixed - host.fixedCm);
  return nearlyEqual(gapCm, insideGapCm) || nearlyEqual(gapCm, outsideGapCm);
}

function chainRuns(frames) {
  const parent = frames.map((_, index) => index);
  const find = (index) => {
    let cursor = index;
    while (parent[cursor] !== cursor) cursor = parent[cursor];
    return cursor;
  };
  const unite = (left, right) => {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent[b] = a;
  };

  for (let i = 0; i < frames.length; i += 1) {
    for (let j = i + 1; j < frames.length; j += 1) {
      if (framesTouch(frames[i], frames[j])) unite(i, j);
    }
  }

  const groups = new Map();
  frames.forEach((frame, index) => {
    const key = find(index);
    const list = groups.get(key) ?? [];
    list.push(frame);
    groups.set(key, list);
  });

  return [...groups.values()].map((run) => run.sort((a, b) => a.start - b.start));
}

function addQuantity(totals, itemKey, quantity) {
  totals.set(itemKey, (totals.get(itemKey) ?? 0) + quantity);
}

function runTotals(run, hosts, uprights = []) {
  const totals = new Map();
  // Host'un bazanın hangi uzun yüzünde olduğu (-1 / +1): köşe dikmesi o yüzün hattındadır.
  const hostSides = run.map((frame) => {
    const host = hosts.find((entry) => hostCovers(frame, entry));
    return host ? Math.sign(host.fixedCm - frame.centerFixed) : 0;
  });
  const hosted = hostSides.map(Boolean);
  const hostedCount = hosted.filter(Boolean).length;
  // Köşe anahtarı: arka (b) / ön (f) hat ve sınır sırası (0..n). Host'un yaslandığı yüzün
  // dikmeleri düşer; aynı hattaki ortak dikme bir kez düşer, karşı yüzlerdeki iki dikme ayrı parçadır.
  const cleared = new Set();
  hostSides.forEach((side, index) => {
    if (!side) return;
    const frame = run[index];
    const line = side === Math.sign(frame.backFixed - frame.centerFixed) ? 'b' : 'f';
    cleared.add(`${line}:${index}`);
    cleared.add(`${line}:${index + 1}`);
  });
  run.forEach((frame, index) => {
    const frontFixed = 2 * frame.centerFixed - frame.backFixed;
    const backInward = Math.sign(frame.centerFixed - frame.backFixed);
    const frontInward = Math.sign(frame.centerFixed - frontFixed);
    [[frame.start, index, 1], [frame.end, index + 1, -1]].forEach(([alongCm, boundary, alongInward]) => {
      if (uprights.some((upright) => uprightOnPoint(upright, frame.axis, alongCm, frame.backFixed, alongInward, backInward))) cleared.add(`b:${boundary}`);
      if (uprights.some((upright) => uprightOnPoint(upright, frame.axis, alongCm, frontFixed, alongInward, frontInward))) cleared.add(`f:${boundary}`);
    });
  });

  let longPanels = 0;
  run.forEach((frame, index) => {
    const onHost = hosted[index];
    addQuantity(totals, frame.spec.profile, onHost ? 2 : 4);
    addQuantity(totals, frame.spec.panel, onHost ? 1 : 2);
    addQuantity(totals, frame.spec.top, 1);
    longPanels += onHost ? 1 : 2;
  });

  const panelCount = longPanels + 2;
  addQuantity(totals, 'upright_49_5', 2 * (run.length + 1) - cleared.size);
  addQuantity(totals, 'profile_41_5', 2 * run.length + 2);
  addQuantity(totals, 'panel_48_5', 2);
  addQuantity(totals, 'connector_start', panelCount * 2);
  addQuantity(totals, 'connector_single', 2 * run.length + 6);
  return { totals, hostedCount, joints: Math.max(0, run.length - 1) };
}

function linesFromTotals(totals) {
  return [...totals.entries()].map(([itemKey, quantity]) => {
    const item = getItem(itemKey);
    return {
      itemKey,
      name: item?.name ?? itemKey,
      quantity,
      unit: item?.unit ?? 'adet',
      material: item?.material ?? null,
    };
  });
}

/**
 * Replace each baza run's solo recipes with the locked row and host totals.
 * Modules without a placement stay on their own recipe via a one-baza run only when placed;
 * unplaced bazas are omitted here and must be passed through separately.
 * @param {Array<object>} modules
 */
export function applyBaseRunBom(modules = []) {
  const list = Array.isArray(modules) ? modules : [];
  const bases = [];
  const hosts = [];
  const uprights = [];
  const unplaced = [];

  list.forEach((module) => {
    const frame = bazaFrame(module);
    if (frame) {
      bases.push(frame);
      return;
    }
    if (baseSpec(module?.itemKey)) unplaced.push(module);
    const host = hostFrame(module);
    if (host) hosts.push(host);
    const upright = uprightFrame(module);
    if (upright) uprights.push(upright);
  });

  const notes = [];
  const totals = new Map();
  for (const run of chainRuns(bases)) {
    const result = runTotals(run, hosts, uprights);
    if (result.joints > 0 || result.hostedCount > 0) {
      notes.push(
        `Baza dizisi: ${run.length} baza, ${result.joints} yan yana uç, ${result.hostedCount} host sırtı.`,
      );
    }
    for (const [itemKey, quantity] of result.totals) addQuantity(totals, itemKey, quantity);
  }

  for (const module of unplaced) {
    const spec = baseSpec(module.itemKey);
    addQuantity(totals, spec.profile, 4);
    addQuantity(totals, spec.panel, 2);
    addQuantity(totals, spec.top, 1);
    addQuantity(totals, 'upright_49_5', 4);
    addQuantity(totals, 'profile_41_5', 4);
    addQuantity(totals, 'panel_48_5', 2);
    addQuantity(totals, 'connector_start', 8);
    addQuantity(totals, 'connector_single', 8);
  }

  return {
    lines: linesFromTotals(totals),
    notes,
  };
}
