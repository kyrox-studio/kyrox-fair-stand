/**
 * Baza runs on the production list.
 * A free row of n bazas keeps 2n+2 panels, 2 starts per panel, 2n+6 singles,
 * 2n+2 uprights and 2n+2 short profiles, and two outer 48.5 cheeks.
 * A same-width wall, separator, or showcase on a baza's back drops that baza's
 * long profile from 4 to 2 and one long panel. Shared back uprights drop once.
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

function framesTouch(a, b) {
  if (a.axis !== b.axis || !nearlyEqual(a.centerFixed, b.centerFixed)) return false;
  return nearlyEqual(a.end, b.start) || nearlyEqual(b.end, a.start);
}

/**
 * The long face sits flush on the host. Snap uses the same gap:
 * centers are (baza depth + wall thickness) / 2 apart.
 * The span must match; a 200 baza does not sit on a 100 host.
 */
function hostCovers(base, host) {
  if (!host || base.axis !== host.axis) return false;
  if (base.spec.width !== host.width) return false;
  if (!nearlyEqual(base.start, host.start) || !nearlyEqual(base.end, host.end)) return false;
  const gapCm = (base.depth + STAND_DIMENSIONS.depthCm) / 2;
  return nearlyEqual(Math.abs(base.centerFixed - host.fixedCm), gapCm);
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

function runTotals(run, hosts) {
  const totals = new Map();
  const hosted = run.map((frame) => hosts.some((host) => hostCovers(frame, host)));
  const hostedCount = hosted.filter(Boolean).length;
  const cleared = new Set();
  hosted.forEach((isHosted, index) => {
    if (!isHosted) return;
    cleared.add(index);
    cleared.add(index + 1);
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
  });

  const notes = [];
  const totals = new Map();
  for (const run of chainRuns(bases)) {
    const result = runTotals(run, hosts);
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
