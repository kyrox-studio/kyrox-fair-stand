import { snapCm } from './modulePlacement.js';
import { STAND_DIMENSION_STEP_CM } from './standSetup.js';
import {
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

export function karolajTileQuantityFromCells(cellCount) {
  const cells = Number(cellCount);
  if (!Number.isFinite(cells) || cells <= 0) return 0;
  const perTile = tilesPerFloorItem(getFloorItem('karolaj'));
  if (!perTile) return null;
  return Math.ceil(cells / perTile);
}

/** Explicit rectangles share one 100×100 tile pool. 50×50 is not a BOM unit. */

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
  return [floorLine(baseItem, baseLineQuantity), floorLine(areaItem, areaQuantity)].filter(Boolean);
}
