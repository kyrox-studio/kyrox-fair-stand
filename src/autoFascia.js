import { listRegisteredItems } from './items.js';
import { createModulePlacement } from './modulePlacement.js';
import { getContinuousWallSegments } from './wallReflow.js';
import { MODULE_WIDTHS_CM } from './standDimensions.js';

// Otomatik alınlık: duvarı olmayan (açık) stand kenarlarının tepesine wall-short paneller
// dizilir; iki komşu kenarı da açık olan köşelere taşıyıcı dikme konur. Planner yalnız ölçü
// ve yerleşim üretir; itemKey çözümü ve Z (wall-top referansı) sahne kurulumunda yapılır.

export const AUTO_FASCIA_ROWS = Object.freeze({
  1: Object.freeze({ variant: 'wall-short-1', label: 'Tek sıra' }),
  2: Object.freeze({ variant: 'wall-short-2', label: 'Çift sıra' }),
});

// Ürün kararı (2026-10-22): iki destek (duvar ucu / dikme) arası alınlık açıklığı en çok 500 cm.
// 500'e kadar ara dikme yok, 550–1000 bir (ortada), 1050–1500 iki… dikmeler eşit aralıklı.
export const FASCIA_MAX_SPAN_CM = 500;
const STEP_CM = 50;

/**
 * Uzunluğu `parts` parçaya 50 cm adımla olabildiğince eşit böler; artan 50'likler ortadan
 * dışa verilir (simetri). Tam orta 50'nin katı değilse (ör. 650) bir yan 50 cm uzun kalır.
 */
export function splitFasciaLengthEvenly(lengthCm, parts) {
  const units = Number(lengthCm) / STEP_CM;
  const count = Number(parts);
  if (!Number.isInteger(units) || units <= 0 || !Number.isInteger(count) || count <= 0 || count > units) return null;
  const base = Math.floor(units / count);
  const sizes = Array(count).fill(base);
  const center = (count - 1) / 2;
  const order = [...sizes.keys()].sort((a, b) => Math.abs(a - center) - Math.abs(b - center) || a - b);
  for (let i = 0; i < units - base * count; i += 1) sizes[order[i]] += 1;
  return sizes.map((size) => size * STEP_CM);
}

/**
 * Aralık panelleri: en az parça, büyükten küçüğe (500 → 200+200+100). Ürün kararı: büyük
 * paneller uçlara, küçük dolgu parçaları kenarın ortasına / ara dikmeye doğru dizilir.
 */
function orderBayPanels(bayCm, side) {
  const widths = [];
  let remaining = bayCm;
  for (const width of [...MODULE_WIDTHS_CM].sort((a, b) => b - a)) {
    while (remaining >= width) {
      widths.push(width);
      remaining -= width;
    }
  }
  if (side === 'left') return widths;
  if (side === 'right') return widths.reverse();
  const head = [];
  const tail = [];
  widths.forEach((width, index) => (index % 2 === 0 ? head : tail).push(width));
  return [...head, ...tail.reverse()];
}

/** Bir kenar: ara dikmelerle ayrılmış eşit aralıklar; dolgu parçaları ortaya doğru. */
export function planFasciaEdgeLayout(lengthCm) {
  const length = Number(lengthCm);
  if (!Number.isFinite(length) || length <= 0 || length % STEP_CM !== 0) {
    return { ok: false, message: 'Alınlık kenarı 50 cm katı olmalı.' };
  }
  const bays = splitFasciaLengthEvenly(length, Math.ceil(length / FASCIA_MAX_SPAN_CM));
  const center = (bays.length - 1) / 2;
  const supportOffsetsCm = [];
  const panels = [];
  let offsetCm = 0;
  bays.forEach((bayCm, index) => {
    if (index > 0) supportOffsetsCm.push(offsetCm);
    const side = index < center ? 'left' : index > center ? 'right' : 'middle';
    for (const widthCm of orderBayPanels(bayCm, side)) {
      panels.push({ offsetCm, widthCm });
      offsetCm += widthCm;
    }
  });
  return { ok: true, bays, supportOffsetsCm, panels };
}

const EDGE_IDS = Object.freeze(['back', 'right', 'front', 'left']);

// Ön yüz dışa (ziyaretçiye) bakar: 0=ön(+Y), 90=sağ(+X), 180=arka(-Y), 270=sol(-X).
function edgeLine(edgeId, standXCm, standYCm) {
  if (edgeId === 'front') return { lengthCm: standXCm, rotationZDeg: 0, at: (offsetCm) => ({ xCm: offsetCm, yCm: standYCm }) };
  if (edgeId === 'back') return { lengthCm: standXCm, rotationZDeg: 180, at: (offsetCm) => ({ xCm: offsetCm, yCm: 0 }) };
  if (edgeId === 'left') return { lengthCm: standYCm, rotationZDeg: 270, at: (offsetCm) => ({ xCm: 0, yCm: offsetCm }) };
  return { lengthCm: standYCm, rotationZDeg: 90, at: (offsetCm) => ({ xCm: standXCm, yCm: offsetCm }) };
}

const CORNERS = Object.freeze([
  Object.freeze({ edges: ['back', 'left'], at: () => ({ xCm: 0, yCm: 0 }) }),
  Object.freeze({ edges: ['back', 'right'], at: (x) => ({ xCm: x, yCm: 0 }) }),
  Object.freeze({ edges: ['front', 'left'], at: (x, y) => ({ xCm: 0, yCm: y }) }),
  Object.freeze({ edges: ['front', 'right'], at: (x, y) => ({ xCm: x, yCm: y }) }),
]);

export function getOpenStandEdges(standType, standXCm, standYCm) {
  const walled = new Set(getContinuousWallSegments(standType, standXCm, standYCm).map((segment) => segment.wallId));
  return EDGE_IDS.filter((edgeId) => !walled.has(edgeId));
}

export function planAutomaticFascia({ standType, standXCm, standYCm, rows } = {}) {
  const x = Number(standXCm);
  const y = Number(standYCm);
  const rowSpec = AUTO_FASCIA_ROWS[Number(rows)];
  if (!rowSpec) return { ok: false, message: 'Alınlık sıra sayısı geçersiz.' };
  if (!Number.isFinite(x) || !Number.isFinite(y) || x <= 0 || y <= 0) {
    return { ok: false, message: 'Alınlık için stand ölçüsü geçersiz.' };
  }

  const openEdges = getOpenStandEdges(standType, x, y);
  const uprightAt = (point, role, edgeId = null) => ({
    role,
    edgeId,
    placement: createModulePlacement({ ...point, zCm: 0, rotationZDeg: 0, wallId: 'free' }),
  });
  const panels = [];
  const uprights = [];
  for (const edgeId of openEdges) {
    const line = edgeLine(edgeId, x, y);
    const layout = planFasciaEdgeLayout(line.lengthCm);
    if (!layout.ok) return { ok: false, message: layout.message };
    for (const panel of layout.panels) {
      panels.push({
        edgeId,
        widthCm: panel.widthCm,
        placement: createModulePlacement({ ...line.at(panel.offsetCm), rotationZDeg: line.rotationZDeg, wallId: 'free' }),
      });
    }
    for (const offsetCm of layout.supportOffsetsCm) uprights.push(uprightAt(line.at(offsetCm), 'span', edgeId));
  }

  const open = new Set(openEdges);
  CORNERS
    .filter((corner) => corner.edges.every((edgeId) => open.has(edgeId)))
    .forEach((corner) => uprights.push(uprightAt(corner.at(x, y), 'corner')));

  return { ok: true, rows: Number(rows), variant: rowSpec.variant, openEdges, panels, uprights };
}

/** Alınlık paneli: istenen sıranın wall-short varyantında bu genişlikteki katalog öğesi. */
export function resolveFasciaPanelItemKey(widthCm, rows) {
  const variant = AUTO_FASCIA_ROWS[Number(rows)]?.variant;
  if (!variant) return null;
  return listRegisteredItems()
    .find((item) => item.variant === variant && Number(item.dimensions?.widthCm) === Number(widthCm))
    ?.itemKey ?? null;
}

/** Köşe dikmesi: duvar yüksekliğini aşmayan en uzun upright (350 → 346,5). */
export function resolveFasciaUprightItemKey(wallHeightCm) {
  const limit = Number(wallHeightCm);
  if (!Number.isFinite(limit)) return null;
  return listRegisteredItems()
    .filter((item) => item.type === 'upright' && Number(item.dimensions?.heightCm) <= limit)
    .sort((a, b) => Number(b.dimensions.heightCm) - Number(a.dimensions.heightCm))[0]
    ?.itemKey ?? null;
}
