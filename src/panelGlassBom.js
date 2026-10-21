import { getItem, listEmbeddedRenderParts } from './items.js';

const STRAIGHT_PANEL_RE = /^panel_(48_5|98|147_5|197)$/;
const CORNER_PANEL_RE = /^panel_corner_(42_5|92|142_5|192)$/;

export const METAL_SEPARATOR_ITEM_KEY = 'metal_separator';

/** panel_xxx → panel_cam_xxx, panel_corner_xxx → panel_corner_cam_xxx. */
export function glassTwinKey(itemKey) {
  if (CORNER_PANEL_RE.test(itemKey)) {
    return `panel_corner_cam_${itemKey.slice('panel_corner_'.length)}`;
  }
  if (STRAIGHT_PANEL_RE.test(itemKey)) {
    return `panel_cam_${itemKey.slice('panel_'.length)}`;
  }
  return null;
}

function recipePanelParts(moduleState) {
  const parent = moduleState?.itemKey ? getItem(moduleState.itemKey) : null;
  if (!parent) return [];
  return listEmbeddedRenderParts(parent).filter((part) => (
    part.type === 'panel' || part.type === 'separator-panel'
  ));
}

function withRecipePanelKeys(surfaces, parts) {
  return surfaces.map((surface, index) => {
    if (!surface || typeof surface !== 'object' || surface.itemKey) return surface;
    const itemKey = parts[index]?.itemKey;
    if (!itemKey) return surface;
    return { ...surface, itemKey };
  });
}

/** Arka yüz paneli (`backStrips`): panel kimliği ön yüzle aynı duvar reçetesinden gelir. */
export function collectBackPanelSurfaces(moduleState) {
  if (!Array.isArray(moduleState?.backStrips)) return [];
  return withRecipePanelKeys(moduleState.backStrips, recipePanelParts(moduleState));
}

/** Arka yüz panelleri BOM satırı: aynı panel kimliği başına bir adet (birim Item'dan). */
export function panelLinesFromSurfaces(surfaces = []) {
  const lines = new Map();
  for (const surface of surfaces) {
    const item = surface?.itemKey ? getItem(surface.itemKey) : null;
    if (!item) continue;
    const unit = item.unit ?? 'adet';
    const key = `${item.itemKey}\u0000${unit}`;
    const current = lines.get(key);
    if (current) current.quantity += 1;
    else lines.set(key, { itemKey: item.itemKey, name: item.name, quantity: 1, unit, material: item.material ?? null, item });
  }
  return [...lines.values()];
}

export function collectPanelSurfaces(moduleState) {
  const parts = recipePanelParts(moduleState);
  const surfaces = [];
  if (Array.isArray(moduleState?.strips)) {
    surfaces.push(...withRecipePanelKeys(moduleState.strips, parts));
  }
  if (moduleState?.faces && typeof moduleState.faces === 'object') {
    surfaces.push(...withRecipePanelKeys(Object.values(moduleState.faces), parts));
  }
  if (moduleState?.surface && typeof moduleState.surface === 'object') {
    surfaces.push(moduleState.surface);
  }
  return surfaces;
}

/**
 * Move glass strip/face counts off the sunta line onto the cam twin.
 * Never exceeds the recipe quantity already on the line.
 */
export function applyGlassPanelSplit(lines = [], surfaces = []) {
  const glassCounts = new Map();
  for (const surface of surfaces) {
    if (!surface?.isGlass) continue;
    const twinKey = glassTwinKey(surface.itemKey);
    if (!twinKey || !getItem(twinKey)) continue;
    glassCounts.set(surface.itemKey, (glassCounts.get(surface.itemKey) ?? 0) + 1);
  }
  if (!glassCounts.size) {
    return { lines, moved: [] };
  }

  const next = lines.map((line) => ({ ...line }));
  const moved = [];
  for (const [boardKey, requested] of glassCounts) {
    const line = next.find((entry) => entry.itemKey === boardKey);
    if (!line || !(line.quantity > 0)) continue;
    const quantity = Math.min(requested, line.quantity);
    const twinKey = glassTwinKey(boardKey);
    const twin = getItem(twinKey);
    if (!twin || !(quantity > 0)) continue;
    line.quantity -= quantity;
    const unit = twin.unit ?? line.unit;
    const existing = next.find((entry) => entry.itemKey === twinKey && entry.unit === unit);
    if (existing) {
      existing.quantity += quantity;
    } else {
      next.push({
        itemKey: twinKey,
        quantity,
        unit,
        material: twin.material ?? null,
        item: twin,
      });
    }
    moved.push({ from: boardKey, to: twinKey, quantity });
  }

  return {
    lines: next.filter((line) => line.quantity > 0),
    moved,
  };
}

/**
 * Each metal-separator strip leaves its sunta line.
 * The square-metre total is one measurement per Ctrl group, added with the print areas.
 */
export function applyMetalSeparatorSplit(lines = [], surfaces = []) {
  const counts = new Map();
  for (const surface of surfaces) {
    if (!surface?.isMetalSeparator || surface.isGlass) continue;
    if (!surface.itemKey) continue;
    counts.set(surface.itemKey, (counts.get(surface.itemKey) ?? 0) + 1);
  }
  if (!counts.size || !getItem(METAL_SEPARATOR_ITEM_KEY)) {
    return { lines, moved: [] };
  }

  const next = lines.map((line) => ({ ...line }));
  const moved = [];
  for (const [boardKey, requested] of counts) {
    const line = next.find((entry) => entry.itemKey === boardKey);
    if (!line || !(line.quantity > 0)) continue;
    const quantity = Math.min(requested, line.quantity);
    if (!(quantity > 0)) continue;
    line.quantity -= quantity;
    moved.push({ from: boardKey, to: METAL_SEPARATOR_ITEM_KEY, quantity });
  }

  return {
    lines: next.filter((line) => line.quantity > 0),
    moved,
  };
}

export function summarizeGlassMoves(moves = []) {
  const totals = new Map();
  for (const move of moves) {
    if (!move?.from || !move?.to || !(move.quantity > 0)) continue;
    const key = `${move.from}\u0000${move.to}`;
    totals.set(key, (totals.get(key) ?? 0) + move.quantity);
  }
  return [...totals.entries()].map(([key, quantity]) => {
    const [from, to] = key.split('\u0000');
    return `Cam panel: ${from} × ${quantity} → ${to}.`;
  });
}
