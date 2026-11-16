import { snapCm } from './modulePlacement.js';
import { STAND_DIMENSION_STEP_CM } from './standSetup.js';
import {
  getFloorFrameBarItems,
  getFloorHalfPieceItem,
  getFloorItem,
  listFloorItems,
  resolveStandFloorItemKey,
} from './items.js';

const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

function finiteCm(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function isFloorGridCm(value, { allowZero = false } = {}) {
  const number = finiteCm(value);
  if (number == null) return false;
  if (number < 0 || (!allowZero && number === 0)) return false;
  return number % STAND_DIMENSION_STEP_CM === 0;
}

function floorLine(item, quantity) {
  if (!(quantity > 0)) return null;
  return {
    itemKey: item.itemKey,
    name: item.name,
    quantity,
    unit: canonicalFloorUnit(item.unit),
    material: item.material ?? null,
  };
}

function isFloorAreaUnit(unit) {
  return unit === 'm2' || unit === 'metre_kare';
}

function canonicalFloorUnit(unit) {
  const text = String(unit ?? '').trim().toLowerCase().replaceAll('²', '2').replaceAll('^', '');
  if (isFloorAreaUnit(text) || text === 'adet') return text;
  return null;
}

export function floorCellCount(widthCm, depthCm) {
  if (!isFloorGridCm(widthCm) || !isFloorGridCm(depthCm)) return null;
  return (widthCm / STAND_DIMENSION_STEP_CM) * (depthCm / STAND_DIMENSION_STEP_CM);
}

function tilesPerFloorItem(item) {
  const tileW = Number(item?.dimensions?.widthCm);
  const tileD = Number(item?.dimensions?.depthCm);
  if (!(tileW > 0) || !(tileD > 0)) return null;
  if (tileW % STAND_DIMENSION_STEP_CM !== 0 || tileD % STAND_DIMENSION_STEP_CM !== 0) return null;
  return (tileW / STAND_DIMENSION_STEP_CM) * (tileD / STAND_DIMENSION_STEP_CM);
}

/**
 * Karolar stand köşesinden (0,0) dizilir; son sıra kalan ölçüde kesilir (sahne ile aynı).
 * Her karo yuvasında örtülen 50 cm hücreler sayılır: yarıdan fazlası tam karo,
 * yarısı ya da azı (50 × 100 kenar, 50 × 50 köşe) yarım parça. Yuvanın karosu,
 * örtülen hücrelerin çerçevesidir (hücre birimiyle x0..x1, y0..y1).
 * covers(cellX, cellY) → hücre bu kaplamaya ait mi.
 */
function floorTileSlots(stand, item, covers) {
  const standX = finiteCm(stand?.xCm);
  const standY = finiteCm(stand?.yCm);
  if (!isFloorGridCm(standX) || !isFloorGridCm(standY)) return null;
  const perTile = tilesPerFloorItem(item);
  if (!perTile) return null;
  const stepsW = Number(item.dimensions.widthCm) / STAND_DIMENSION_STEP_CM;
  const stepsD = Number(item.dimensions.depthCm) / STAND_DIMENSION_STEP_CM;
  const cellsX = standX / STAND_DIMENSION_STEP_CM;
  const cellsY = standY / STAND_DIMENSION_STEP_CM;
  const slots = [];
  for (let blockX = 0; blockX < cellsX; blockX += stepsW) {
    for (let blockY = 0; blockY < cellsY; blockY += stepsD) {
      let covered = 0;
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (let i = 0; i < stepsW; i += 1) {
        for (let j = 0; j < stepsD; j += 1) {
          const cellX = blockX + i;
          const cellY = blockY + j;
          if (cellX >= cellsX || cellY >= cellsY || !covers(cellX, cellY)) continue;
          covered += 1;
          x0 = Math.min(x0, cellX);
          y0 = Math.min(y0, cellY);
          x1 = Math.max(x1, cellX + 1);
          y1 = Math.max(y1, cellY + 1);
        }
      }
      if (!covered) continue;
      slots.push({ half: covered * 2 <= perTile, x0, y0, x1, y1 });
    }
  }
  return slots;
}

export function floorTilePieceCounts(stand, item, covers = () => true) {
  const slots = floorTileSlots(stand, item, covers);
  if (!slots) return null;
  const half = slots.filter((slot) => slot.half).length;
  return { full: slots.length - half, half };
}

/**
 * Karo altındaki demir = karo kenarları; iki karonun ortak kenarı bir kez sayılır
 * (1 kare 4, yan yana 2 kare 7, 3 kare 10). Daha uzun bir kenarın içinde kalan kısa kenar
 * ayrıca sayılmaz. Sonuç: kenar boyu (cm) → adet.
 */
export function floorFrameBarCounts(stand, item, covers = () => true) {
  const slots = floorTileSlots(stand, item, covers);
  if (!slots) return null;
  const edges = new Map();
  const addEdge = (axis, line, from, to) => {
    edges.set(`${axis}:${line}:${from}:${to}`, { axis, line, from, to });
  };
  for (const slot of slots) {
    addEdge('h', slot.y0, slot.x0, slot.x1);
    addEdge('h', slot.y1, slot.x0, slot.x1);
    addEdge('v', slot.x0, slot.y0, slot.y1);
    addEdge('v', slot.x1, slot.y0, slot.y1);
  }
  const all = [...edges.values()];
  const counts = new Map();
  for (const edge of all) {
    const inside = all.some((other) => other !== edge
      && other.axis === edge.axis
      && other.line === edge.line
      && other.from <= edge.from
      && other.to >= edge.to
      && other.to - other.from > edge.to - edge.from);
    if (inside) continue;
    const lengthCm = (edge.to - edge.from) * STAND_DIMENSION_STEP_CM;
    counts.set(lengthCm, (counts.get(lengthCm) ?? 0) + 1);
  }
  return counts;
}

/** Yarım parçası olan karo: tam, yarım ve demir satırları. Yoksa null (eski hesap geçerli). */
export function floorTilePieceLines(stand, item, covers) {
  const halfItem = getFloorHalfPieceItem(item);
  if (!halfItem || canonicalFloorUnit(item?.unit) !== 'adet') return null;
  const counts = floorTilePieceCounts(stand, item, covers);
  if (!counts) return null;
  const bars = floorFrameBarCounts(stand, item, covers) ?? new Map();
  const barLines = getFloorFrameBarItems(item).map((barItem) => (
    floorLine(barItem, bars.get(Number(barItem.dimensions?.widthCm)) ?? 0)
  ));
  return [floorLine(item, counts.full), floorLine(halfItem, counts.half), ...barLines].filter(Boolean);
}

function insideRect(area) {
  const x0 = area.xCm / STAND_DIMENSION_STEP_CM;
  const y0 = area.yCm / STAND_DIMENSION_STEP_CM;
  const x1 = x0 + area.widthCm / STAND_DIMENSION_STEP_CM;
  const y1 = y0 + area.depthCm / STAND_DIMENSION_STEP_CM;
  return (cellX, cellY) => cellX >= x0 && cellX < x1 && cellY >= y0 && cellY < y1;
}

/** Karosu yarım parçasız zeminlerde açık dikdörtgenler tek 100×100 havuzu paylaşır. */

export function defaultOverrideItemKey(baseKey) {
  const preferred = baseKey === 'parke-acik' ? 'hali' : 'parke-acik';
  if (preferred !== baseKey && getFloorItem(preferred)) return preferred;
  return listFloorItems().find((item) => item.itemKey !== baseKey)?.itemKey
    ?? resolveStandFloorItemKey(baseKey);
}

export function defaultFloorAreaRect(stand) {
  const standX = finiteCm(stand?.xCm);
  const standY = finiteCm(stand?.yCm);
  if (!isFloorGridCm(standX) || !isFloorGridCm(standY)) return null;
  const margin = standX >= 300 && standY >= 300 ? 100 : STAND_DIMENSION_STEP_CM;
  const widthCm = standX - margin * 2;
  const depthCm = standY - margin * 2;
  if (!isFloorGridCm(widthCm) || !isFloorGridCm(depthCm)) return null;
  return { xCm: margin, yCm: margin, widthCm, depthCm };
}

function clampGrid(value, maxCm) {
  const snapped = snapCm(value, STAND_DIMENSION_STEP_CM);
  if (snapped == null) return null;
  return Math.min(maxCm, Math.max(0, snapped));
}

export function rectangleFromCorners(anchor, pointer, stand) {
  const standX = finiteCm(stand?.xCm);
  const standY = finiteCm(stand?.yCm);
  if (!isFloorGridCm(standX) || !isFloorGridCm(standY)) {
    return { ok: false, message: 'Önce stand alanını oluştur.' };
  }
  const x1 = clampGrid(anchor?.xCm, standX);
  const y1 = clampGrid(anchor?.yCm, standY);
  const x2 = clampGrid(pointer?.xCm, standX);
  const y2 = clampGrid(pointer?.yCm, standY);
  if ([x1, y1, x2, y2].some((value) => value == null)) {
    return { ok: false, message: 'Zemin alanı stand içinde çizilmeli.' };
  }
  const xCm = Math.min(x1, x2);
  const yCm = Math.min(y1, y2);
  const widthCm = Math.abs(x2 - x1);
  const depthCm = Math.abs(y2 - y1);
  const checked = validateFloorArea({
    xCm,
    yCm,
    widthCm,
    depthCm,
    itemKey: getFloorItem('karolaj')?.itemKey,
  }, stand);
  if (!checked.ok) return checked;
  return {
    ok: true,
    area: {
      xCm: checked.area.xCm,
      yCm: checked.area.yCm,
      widthCm: checked.area.widthCm,
      depthCm: checked.area.depthCm,
    },
  };
}

export function validateFloorArea(area, stand) {
  if (area == null) return { ok: true, area: null };
  if (!area || typeof area !== 'object' || Array.isArray(area)) {
    return { ok: false, message: 'Zemin alanı geçersiz.' };
  }
  const standX = finiteCm(stand?.xCm);
  const standY = finiteCm(stand?.yCm);
  if (!isFloorGridCm(standX) || !isFloorGridCm(standY)) {
    return { ok: false, message: 'Zemin alanı için geçerli bir stand ölçüsü gerekli.' };
  }
  const xCm = finiteCm(area.xCm);
  const yCm = finiteCm(area.yCm);
  const widthCm = finiteCm(area.widthCm);
  const depthCm = finiteCm(area.depthCm);
  if (!isFloorGridCm(xCm, { allowZero: true }) || !isFloorGridCm(yCm, { allowZero: true })) {
    return { ok: false, message: `Alan konumu ${STAND_DIMENSION_STEP_CM} cm ve katları olmalı.` };
  }
  if (!isFloorGridCm(widthCm) || !isFloorGridCm(depthCm)) {
    return { ok: false, message: `Alan ölçüleri ${STAND_DIMENSION_STEP_CM} cm ve katları olmalı.` };
  }
  if (xCm + widthCm > standX || yCm + depthCm > standY) {
    return { ok: false, message: 'Zemin alanı stand sınırının içinde kalmalı.' };
  }
  const item = getFloorItem(area.itemKey);
  if (!item) return { ok: false, message: 'Zemin alanı kaplaması geçersiz.' };
  let color = null;
  if (area.color != null && area.color !== '') {
    const normalized = String(area.color).trim().toLowerCase();
    if (!COLOR_PATTERN.test(normalized)) {
      return { ok: false, message: 'Zemin alanı rengi geçersiz.' };
    }
    color = item.paintable ? normalized : null;
  }
  return {
    ok: true,
    area: {
      xCm,
      yCm,
      widthCm,
      depthCm,
      itemKey: item.itemKey,
      color,
    },
  };
}

function quantityForCoverage(item, widthCm, depthCm, cellOverride = null) {
  const unit = canonicalFloorUnit(item?.unit);
  if (!unit) return null;
  if (isFloorAreaUnit(unit)) return (widthCm * depthCm) / 10000;
  const cells = cellOverride ?? floorCellCount(widthCm, depthCm);
  if (cells == null) return null;
  const perTile = tilesPerFloorItem(item);
  if (!perTile) return null;
  return Math.ceil(cells / perTile);
}

/**
 * One optional override. Absent area keeps the legacy full-stand line.
 * Returns null when the override does not change the base Item, so the caller
 * keeps the existing single-floor formula.
 */
export function resolveSplitFloorBomLines(stand) {
  const checked = validateFloorArea(stand?.floorArea, stand);
  if (!checked.ok || !checked.area) return null;
  const baseItem = getFloorItem(resolveStandFloorItemKey(stand));
  const area = checked.area;
  const areaItem = getFloorItem(area.itemKey);
  if (!baseItem || !areaItem || areaItem.itemKey === baseItem.itemKey) return null;

  const standX = Number(stand.xCm);
  const standY = Number(stand.yCm);
  const standCells = floorCellCount(standX, standY);
  const areaCells = floorCellCount(area.widthCm, area.depthCm);
  const baseCells = standCells == null || areaCells == null ? null : standCells - areaCells;
  const baseQuantity = quantityForCoverage(
    baseItem,
    standX,
    standY,
    baseItem.unit && canonicalFloorUnit(baseItem.unit) === 'adet' ? baseCells : null,
  );
  const baseM2Width = standX;
  const baseM2Depth = standY;
  const baseLineQuantity = isFloorAreaUnit(canonicalFloorUnit(baseItem.unit))
    ? ((baseM2Width * baseM2Depth) - (area.widthCm * area.depthCm)) / 10000
    : baseQuantity;
  const areaQuantity = quantityForCoverage(areaItem, area.widthCm, area.depthCm);
  const inArea = insideRect(area);
  const baseLines = floorTilePieceLines(stand, baseItem, (x, y) => !inArea(x, y))
    ?? [floorLine(baseItem, baseLineQuantity)];
  const areaLines = floorTilePieceLines(stand, areaItem, inArea)
    ?? [floorLine(areaItem, areaQuantity)];
  return [...baseLines, ...areaLines].filter(Boolean);
}
