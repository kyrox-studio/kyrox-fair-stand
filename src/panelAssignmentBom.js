import { getItem } from './items.js';

/**
 * Paneller atama türüne göre (Üretim Listesi ve sahnedeki "Panel Ölçüleri" aynı sayımı kullanır).
 * Kaynak: resolveProjectBom modül girdisindeki `panelSurfaces`; panel anahtarı birleşim / köşe
 * kurallarından sonraki BOM anahtarıdır (ör. panel_98 → panel_corner_92), ölçü o Item'dan okunur.
 * - Görsel atanan: dosya + ölçü başına adet (görsel dört paneli kaplıyorsa dört panel).
 * - Renk atanan: görselsiz, rengi Item varsayılanından farklı panel; renk + ölçü başına adet.
 * - Varsayılan Panel: görsel, renk, Mesh veya Lightbox atanmamış panel; ölçü başına adet.
 * Mesh / Lightbox kaplı, cam, metal separatör ve kaldırılmış paneller sayılmaz.
 */

export const PANEL_ASSIGNMENT_GROUPS = Object.freeze([
  Object.freeze({ id: 'image', label: 'Görsel atanan paneller' }),
  Object.freeze({ id: 'color', label: 'Renk atanan paneller' }),
  Object.freeze({ id: 'default', label: 'Varsayılan Panel' }),
  Object.freeze({ id: 'depot', label: 'Depo içi paneller' }),
]);

const PANEL_TYPES = new Set(['panel']);
const HEX_RE = /^#[0-9a-f]{6}$/;

function normalizeHex(value) {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (HEX_RE.test(text)) return text;
  if (/^#[0-9a-f]{3}$/.test(text)) return `#${[...text.slice(1)].map((c) => c + c).join('')}`;
  return null;
}

function itemDefaultHex(item) {
  return Number.isInteger(item?.defaultColor)
    ? `#${item.defaultColor.toString(16).padStart(6, '0')}`
    : null;
}

function lookupAssetName(assetNames, assetId) {
  if (!assetNames || !assetId) return '';
  const raw = assetNames instanceof Map ? assetNames.get(assetId) : assetNames[assetId];
  return typeof raw === 'string' ? raw.trim() : '';
}

/** Tek panel yüzeyi → atama kaydı; sayılmayan panel null. */
export function classifyPanelSurface(surface, assetNames = null) {
  if (!surface || typeof surface !== 'object' || surface.removed === true) return null;
  if (surface.isGlass || surface.isMetalSeparator || surface.fabricGroupId) return null;
  const item = surface.itemKey ? getItem(surface.itemKey) : null;
  if (!item || !PANEL_TYPES.has(item.type)) return null;
  const widthCm = Number(item.dimensions?.widthCm);
  const heightCm = Number(item.dimensions?.heightCm);
  if (!(widthCm > 0) || !(heightCm > 0)) return null;
  const base = {
    surfaceId: surface.id ?? null,
    itemKey: item.itemKey,
    widthCm,
    heightCm,
  };
  // Deponun içine bakan alt 4 bant (projectBom splitDepotInnerSurfaces) atamadan bağımsız ayrı gruptur.
  if (surface.depotInner === true) {
    return { ...base, group: 'depot', assetId: null, assetName: null, color: null };
  }
  const assetId = typeof surface.imageAssetId === 'string' && surface.imageAssetId.trim()
    ? surface.imageAssetId.trim()
    : null;
  if (assetId) {
    return {
      ...base,
      group: 'image',
      assetId,
      assetName: lookupAssetName(assetNames, assetId) || 'Görsel',
      color: null,
    };
  }
  const color = normalizeHex(surface.color);
  const fallback = itemDefaultHex(item);
  if (color && color !== fallback) {
    return { ...base, group: 'color', assetId: null, assetName: null, color };
  }
  return { ...base, group: 'default', assetId: null, assetName: null, color: null };
}

function rowKey(panel) {
  if (panel.group === 'image') return `${panel.assetId}\u0000${panel.widthCm}\u0000${panel.heightCm}`;
  if (panel.group === 'color') return `${panel.color}\u0000${panel.widthCm}\u0000${panel.heightCm}`;
  return `${panel.widthCm}\u0000${panel.heightCm}`;
}

// Önce panel ölçüsü (büyükten küçüğe), aynı ölçüde görsel adı / renk (kullanıcı kararı 2026-11-16).
function compareRows(a, b) {
  const subject = (row) => row.assetName ?? row.color ?? '';
  return b.widthCm - a.widthCm
    || b.heightCm - a.heightCm
    || subject(a).localeCompare(subject(b), 'tr', { numeric: true });
}

/**
 * @param {Array<{ status?: string, panelSurfaces?: object[] }>} moduleEntries resolveProjectBom modül girdileri
 * @param {Map<string, string> | Record<string, string> | null} assetNames
 */
export function summarizePanelAssignments(moduleEntries = [], assetNames = null) {
  const panels = [];
  for (const entry of moduleEntries) {
    if (entry?.status !== 'ok') continue;
    for (const surface of entry.panelSurfaces ?? []) {
      const panel = classifyPanelSurface(surface, assetNames);
      if (panel) panels.push(Object.freeze({ ...panel, moduleId: entry.moduleId ?? null }));
    }
  }
  const groups = PANEL_ASSIGNMENT_GROUPS.map((group) => {
    const rows = new Map();
    for (const panel of panels) {
      if (panel.group !== group.id) continue;
      const key = rowKey(panel);
      const current = rows.get(key);
      if (current) current.quantity += 1;
      else {
        rows.set(key, {
          assetId: panel.assetId,
          assetName: panel.assetName,
          color: panel.color,
          widthCm: panel.widthCm,
          heightCm: panel.heightCm,
          quantity: 1,
        });
      }
    }
    const sorted = [...rows.values()].sort(compareRows).map((row) => Object.freeze(row));
    return Object.freeze({
      id: group.id,
      label: group.label,
      rows: Object.freeze(sorted),
      total: sorted.reduce((sum, row) => sum + row.quantity, 0),
    });
  });
  const summary = { groups: Object.freeze(groups), total: panels.length };
  // Panel başına kayıt sahne etiketi içindir; yüzey kimliği taşır, listenin içeriği sayılmaz (JSON'a girmez).
  Object.defineProperty(summary, 'panels', { value: Object.freeze(panels), enumerable: false });
  return Object.freeze(summary);
}

export function formatPanelSizeCm(widthCm, heightCm) {
  const format = (value) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(Number(value));
  return `${format(widthCm)} × ${format(heightCm)} cm`;
}

/** Satır metni: "3.jpeg · 197 × 47 cm · 4 panel", "#c0392b · 197 × 47 cm · 3 panel", "197 × 47 cm · 7 panel". */
export function formatPanelAssignmentRow(row) {
  const size = formatPanelSizeCm(row.widthCm, row.heightCm);
  const subject = row.assetName ?? row.color ?? null;
  return `${subject ? `${subject} · ` : ''}${size} · ${row.quantity} panel`;
}

/**
 * Satırları panel ölçüsü başlığı altında toplar (kullanıcı kararı 2026-11-16):
 * "197 × 47 cm · 12 panel" → altında "01.jpg · 1 panel", "ASKA LOGO.jpg · 3 panel".
 * Satırlar zaten ölçüye göre dizili gelir (compareRows).
 */
export function groupPanelRowsBySize(rows = []) {
  const sizes = [];
  for (const row of rows) {
    const current = sizes.at(-1);
    if (current && current.widthCm === row.widthCm && current.heightCm === row.heightCm) {
      current.rows.push(row);
      current.total += row.quantity;
    } else {
      sizes.push({ widthCm: row.widthCm, heightCm: row.heightCm, total: row.quantity, rows: [row] });
    }
  }
  return sizes;
}

export function formatPanelSizeHeading(size) {
  return `${formatPanelSizeCm(size.widthCm, size.heightCm)} · ${size.total} panel`;
}

/** Ölçü başlığı altındaki satır: "ASKA LOGO.jpg · 3 panel", "#c0392b · 1 panel". */
export function formatPanelSubjectRow(row) {
  return `${row.assetName ?? row.color ?? ''} · ${row.quantity} panel`;
}

/**
 * Sahnede panelin üstündeki kısa etiket (kullanıcı kararı 2026-11-16): yalnız genişlik (yükseklik
 * hepsinde aynı) + görsel adı / renk / Varsayılan / Depo içi. Adet sahnede eklenir ("197 · Varsayılan · 3").
 */
export function formatPanelSceneLabel(panel) {
  const width = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(Number(panel.widthCm));
  if (panel.group === 'image') return `${width} · ${panel.assetName}`;
  if (panel.group === 'color') return `${width} · ${panel.color}`;
  if (panel.group === 'depot') return `${width} · Depo içi`;
  return `${width} · Varsayılan`;
}
