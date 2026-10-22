import {
  getFloorItem,
  getItem,
  resolveStandFloorItemKey,
} from './items.js';
import { resolveItemBom } from './itemBom.js';
import {
  applyGlassPanelSplit,
  applyMetalSeparatorSplit,
  collectBackPanelSurfaces,
  collectPanelSurfaces,
  panelLinesFromSurfaces,
  summarizeGlassMoves,
} from './panelGlassBom.js';
import {
  applyCornerPanelBandSwap,
  applyModuleConnectorCharge,
  applyCornerPanelSwap,
  applyCornerPanelSwapToSurfaces,
  applyRelationshipBomAdjustments,
  applyWallShortBomDeltas,
  detectRelationshipJoints,
  planWallShortRelationshipBom,
} from './relationshipBom.js';
import { applyBaseRunBom, isBaseRunItemKey } from './baseRunBom.js';
import { collectPrintAreas } from './printAreaBom.js';
import { resolveSplitFloorBomLines } from './floorArea.js';

const DEFAULT_PROJECT_ITEM_KEY = 'elektrik_panosu';

function defaultProjectLines() {
  const item = getItem(DEFAULT_PROJECT_ITEM_KEY);
  if (!item?.unit) return [];
  return resolveItemBom(DEFAULT_PROJECT_ITEM_KEY, 1);
}

function freezeLine(line) {
  return Object.freeze({
    itemKey: line.itemKey,
    name: line.item?.name ?? line.name ?? line.itemKey,
    quantity: line.quantity,
    unit: line.unit,
    material: line.material ?? null,
  });
}

function aggregateLines(lineLists) {
  const aggregated = new Map();
  for (const lines of lineLists) {
    for (const line of lines) {
      const key = `${line.itemKey}\u0000${line.unit}`;
      const current = aggregated.get(key);
      if (current) {
        current.quantity += line.quantity;
      } else {
        aggregated.set(key, { ...line });
      }
    }
  }
  return Array.from(aggregated.values(), (line) => Object.freeze(line));
}

function mergeBomLines(lines, extra) {
  const next = lines.map((line) => ({ ...line }));
  for (const line of extra) {
    const existing = next.find((entry) => entry.itemKey === line.itemKey && entry.unit === line.unit);
    if (existing) existing.quantity += line.quantity;
    else next.push({ ...line });
  }
  return next;
}

function resolveModuleEntry(moduleState, index, {
  swapCornerPanels = false,
  swapBands = null,
  swapBackPanels = false,
  swapBackBands = null,
} = {}) {
  const moduleId = moduleState?.id ?? null;
  const itemKey = moduleState?.itemKey ?? null;

  if (!itemKey) {
    return Object.freeze({
      moduleId,
      index,
      itemKey: null,
      name: moduleState?.type ? `type:${moduleState.type}` : 'unknown',
      type: moduleState?.type ?? null,
      status: 'unresolved',
      lines: Object.freeze([]),
      message: 'Modülde itemKey yok.',
    });
  }

  const item = getItem(itemKey);
  const name = item?.name ?? itemKey;

  if (
    itemKey === 'illuminated-foam'
    || item?.type === 'illuminated-foam'
    || itemKey === 'tulle_fabric'
    || item?.type === 'tulle-fabric'
  ) {
    return Object.freeze({
      moduleId,
      index,
      itemKey,
      name,
      type: item?.type ?? (itemKey === 'tulle_fabric' ? 'tulle-fabric' : 'illuminated-foam'),
      status: 'ok',
      lines: Object.freeze([]),
      glassMoved: Object.freeze([]),
      message: null,
    });
  }

  try {
    const recipeLines = resolveItemBom(itemKey, 1);
    const collected = collectPanelSurfaces(moduleState);
    let lines = recipeLines;
    let surfaces = collected;
    if (swapCornerPanels) {
      lines = applyCornerPanelSwap(recipeLines);
      surfaces = applyCornerPanelSwapToSurfaces(collected);
    } else if (swapBands?.length) {
      const swapped = applyCornerPanelBandSwap(recipeLines, collected, swapBands);
      lines = swapped.lines;
      surfaces = swapped.surfaces;
    }
    // Arka yüz panelleri: bant başına bir panel; arka yüz köşede ise köşe paneline döner.
    const backCollected = collectBackPanelSurfaces(moduleState);
    if (backCollected.length) {
      let backSurfaces = backCollected;
      if (swapBackPanels) backSurfaces = applyCornerPanelSwapToSurfaces(backCollected);
      else if (swapBackBands?.length) backSurfaces = applyCornerPanelBandSwap([], backCollected, swapBackBands).surfaces;
      lines = mergeBomLines(lines, panelLinesFromSurfaces(backSurfaces));
      surfaces = [...surfaces, ...backSurfaces];
    }
    const glassSplit = applyGlassPanelSplit(lines, surfaces);
    const split = applyMetalSeparatorSplit(glassSplit.lines, surfaces);
    return Object.freeze({
      moduleId,
      index,
      itemKey,
      name,
      type: item?.type ?? moduleState?.type ?? null,
      status: 'ok',
      lines: Object.freeze(split.lines.map(freezeLine)),
      glassMoved: Object.freeze(glassSplit.moved),
      message: null,
    });
  } catch (error) {
    return Object.freeze({
      moduleId,
      index,
      itemKey,
      name,
      type: item?.type ?? moduleState?.type ?? null,
      status: 'unresolved',
      lines: Object.freeze([]),
      message: error?.message || 'Bu Item için üretim reçetesi çözülemedi.',
    });
  }
}

function floorAreaM2(stand) {
  const xCm = Number(stand?.xCm);
  const yCm = Number(stand?.yCm);
  if (!(xCm > 0) || !(yCm > 0)) return null;
  return (xCm * yCm) / 10000;
}

function floorTileCount(stand, item) {
  const xCm = Number(stand?.xCm);
  const yCm = Number(stand?.yCm);
  const tileW = Number(item?.dimensions?.widthCm);
  const tileD = Number(item?.dimensions?.depthCm);
  if (!(xCm > 0) || !(yCm > 0) || !(tileW > 0) || !(tileD > 0)) return null;
  return Math.ceil(xCm / tileW) * Math.ceil(yCm / tileD);
}

/**
 * Existing print-area section totals. The area math stays in printAreaBom.
 * These keys only name the production leaf that receives that total.
 */
const PRINT_PRODUCTION_ITEM_KEYS = Object.freeze({
  image: 'digital_print',
  mesh: 'mesh_fabric',
  lightbox: 'lightbox_fabric',
  foam: 'illuminated-foam',
  tulle: 'tulle_fabric',
  metal: 'metal_separator',
});

function resolvePrintProductionLines(printAreas) {
  const lines = [];
  for (const section of printAreas) {
    const itemKey = PRINT_PRODUCTION_ITEM_KEYS[section.id];
    if (!itemKey) continue;
    lines.push(...resolveItemBom(itemKey, section.totalAreaM2));
  }
  return lines;
}

function isFloorAreaUnit(unit) {
  return unit === 'm2' || unit === 'metre_kare';
}

function canonicalFloorUnit(unit) {
  const text = String(unit ?? '').trim().toLowerCase().replaceAll('²', '2').replaceAll('^', '');
  if (isFloorAreaUnit(text) || text === 'adet') return text;
  return null;
}

/**
 * Selected stand floor → one aggregated line.
 * Any item_type=floor uses its catalog unit: m2 and metre_kare are stand area, adet is whole tiles.
 */
export function resolveFloorBomLine(stand) {
  if (!stand) return null;
  const item = getFloorItem(resolveStandFloorItemKey(stand));
  if (!item || item.type !== 'floor') return null;

  const unit = canonicalFloorUnit(item.unit);
  if (!unit) return null;

  const quantity = isFloorAreaUnit(unit)
    ? floorAreaM2(stand)
    : floorTileCount(stand, item);
  if (quantity == null || !(quantity > 0)) return null;

  return Object.freeze({
    itemKey: item.itemKey,
    name: item.name,
    quantity,
    unit,
    material: item.material ?? null,
  });
}

function moduleIdentity(moduleState, index) {
  return moduleState?.id ?? `idx:${index}`;
}

function mergedConnectorCharges(relationshipCharges, shortCharges) {
  const byModule = new Map();
  for (const charge of [...(relationshipCharges ?? []), ...(shortCharges ?? [])]) {
    const current = byModule.get(charge.moduleId) ?? {
      moduleId: charge.moduleId,
      single: 0,
      corner: 0,
      double: 0,
      profile: 0,
      start: 0,
      profileKey: null,
    };
    current.single += charge.single || 0;
    current.corner += charge.corner || 0;
    current.double += charge.double || 0;
    current.profile += charge.profile || 0;
    current.start += charge.start || 0;
    if (charge.profileKey) current.profileKey = charge.profileKey;
    byModule.set(charge.moduleId, current);
  }
  return [...byModule.values()];
}

function chargeModuleEntries(moduleEntries, charges) {
  if (!charges.length) return moduleEntries;
  const byModule = new Map(charges.map((charge) => [charge.moduleId, charge]));
  return moduleEntries.map((entry) => {
    const charge = byModule.get(entry.moduleId);
    if (!charge || entry.status !== 'ok') return entry;
    return Object.freeze({
      ...entry,
      lines: Object.freeze(applyModuleConnectorCharge(entry.lines, charge).map(freezeLine)),
    });
  });
}

function unresolvedFrom(moduleEntries) {
  return moduleEntries
    .filter((entry) => entry.status === 'unresolved')
    .map((entry) => Object.freeze({
      moduleId: entry.moduleId,
      index: entry.index,
      itemKey: entry.itemKey,
      name: entry.name,
      message: entry.message,
    }));
}

/**
 * Project modules → per-module BOM + unresolved + aggregated leaf totals.
 * Applies locked wall joints, then baza rows and same-width host backs.
 * @param {Array<{ id?: string, itemKey?: string, type?: string, placement?: object, widthCm?: number }>} modules
 * @param {Map<string, string> | Record<string, string> | null} assetNames
 */
export function resolveProjectBom(modules = [], stand = null, assetNames = null) {
  const list = Array.isArray(modules) ? modules : [];
  const joints = detectRelationshipJoints(list);
  const wallShort = planWallShortRelationshipBom(list);
  let moduleEntries = list.map((moduleState, index) => resolveModuleEntry(moduleState, index));
  const wallLinesOf = () => moduleEntries
    .filter((entry) => entry.status === 'ok' && !isBaseRunItemKey(entry.itemKey))
    .map((entry) => entry.lines);
  const preview = applyRelationshipBomAdjustments(
    aggregateLines(wallLinesOf()),
    joints,
  );

  const swapIds = new Set(wallShort.swapModuleIds);
  if (preview.appliedJointCount > 0) {
    for (const moduleId of preview.swapModuleIds) swapIds.add(moduleId);
  }
  const backSwapIds = new Set(preview.appliedJointCount > 0 ? preview.backSwapModuleIds ?? [] : []);
  for (const moduleId of wallShort.backSwapModuleIds ?? []) backSwapIds.add(moduleId);
  const backBandsByModule = new Map();
  for (const entry of wallShort.backPanelSwaps ?? []) {
    if (backSwapIds.has(entry.moduleId)) continue;
    backBandsByModule.set(entry.moduleId, entry.bands);
  }
  const bandByModule = new Map();
  for (const entry of wallShort.panelSwaps ?? []) {
    if (swapIds.has(entry.moduleId)) continue;
    bandByModule.set(entry.moduleId, entry.bands);
  }
  if (swapIds.size > 0 || bandByModule.size > 0 || backSwapIds.size > 0 || backBandsByModule.size > 0) {
    moduleEntries = list.map((moduleState, index) => {
      const moduleId = moduleIdentity(moduleState, index);
      const swapBackPanels = backSwapIds.has(moduleId);
      const swapBackBands = backBandsByModule.get(moduleId) ?? null;
      if (swapIds.has(moduleId)) {
        return resolveModuleEntry(moduleState, index, { swapCornerPanels: true, swapBackPanels, swapBackBands });
      }
      const bands = bandByModule.get(moduleId);
      if (bands?.length) {
        return resolveModuleEntry(moduleState, index, { swapBands: bands, swapBackPanels, swapBackBands });
      }
      if (swapBackPanels || swapBackBands?.length) {
        return resolveModuleEntry(moduleState, index, { swapBackPanels, swapBackBands });
      }
      return moduleEntries[index];
    });
  }

  const adjusted = applyRelationshipBomAdjustments(
    aggregateLines(wallLinesOf()),
    joints,
  );
  const wallShortLines = applyWallShortBomDeltas(adjusted.lines, wallShort);
  const baza = applyBaseRunBom(list);
  const glassNotes = summarizeGlassMoves(
    moduleEntries
      .filter((entry) => entry.status === 'ok' && !isBaseRunItemKey(entry.itemKey))
      .flatMap((entry) => entry.glassMoved ?? []),
  );
  const splitFloorLines = stand?.floorArea ? resolveSplitFloorBomLines(stand) : null;
  const floorLine = splitFloorLines ? null : resolveFloorBomLine(stand);
  const printAreas = collectPrintAreas(list, assetNames);
  const lines = aggregateLines([
    wallShortLines,
    baza.lines,
    splitFloorLines ?? (floorLine ? [floorLine] : []),
    resolvePrintProductionLines(printAreas),
    defaultProjectLines(),
  ]);
  const chargedModules = chargeModuleEntries(
    moduleEntries,
    mergedConnectorCharges(adjusted.moduleCharges, wallShort.moduleCharges),
  );

  return Object.freeze({
    modules: Object.freeze(chargedModules),
    unresolved: Object.freeze(unresolvedFrom(moduleEntries)),
    joints: Object.freeze(joints),
    relationshipNotes: Object.freeze([...adjusted.notes, ...wallShort.notes, ...baza.notes, ...glassNotes]),
    appliedJointCount: adjusted.appliedJointCount,
    appliedEndToEndCount: adjusted.appliedEndToEndCount,
    appliedCornerCount: adjusted.appliedCornerCount,
    appliedTeeCount: adjusted.appliedTeeCount,
    lines: Object.freeze(lines.map(freezeLine)),
    printAreas,
  });
}
