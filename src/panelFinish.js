// Panel tipi (kullanıcı kararı 2026-11-18; migration 0100_panel_finishes).
// Tipler admin'den yönetilen, katalogda görünmeyen `panel-finish` Item'larıdır: ad, renk
// (`defaultColor`), doku (`textureFile`) ve döşeme ölçüsü (`dimensions.widthCm` × `heightCm`).
// - Stand geneli tip `stand.panelFinish`; seçili panele atanan tip `surface.panelFinish`.
// - Görsel, renk, Mesh / Lightbox atanmamış ("Varsayılan Panel" grubundaki) her panel stand tipini
//   alır; panele atanan tip stand tipinin önündedir. Cam, metal separatör ve kaldırılmış panel tip almaz.
// - Ürün değildir: Üretim Listesi kalemi ve adedi değişmez; yalnız görünüş ve panel dökümünde grup.
import { getItem, listRegisteredItems } from './items.js';

export const PANEL_FINISH_ITEM_TYPE = 'panel-finish';
export const PANEL_FINISH_DEFAULT = 'panel_finish_default';

/** Katalogdaki panel tipleri: Varsayılan önce, diğerleri ada göre. */
export function listPanelFinishes() {
  return listRegisteredItems()
    .filter((item) => item?.type === PANEL_FINISH_ITEM_TYPE)
    .sort((a, b) => (a.itemKey === PANEL_FINISH_DEFAULT ? -1 : b.itemKey === PANEL_FINISH_DEFAULT ? 1
      : String(a.name).localeCompare(String(b.name), 'tr')));
}

export function isKnownPanelFinish(value) {
  return typeof value === 'string' && getItem(value)?.type === PANEL_FINISH_ITEM_TYPE;
}

/** Kayıttaki değer: bilinmeyen ya da eksikse (eski proje, admin'de silinmiş tip) varsayılan. */
export function normalizePanelFinish(value) {
  return isKnownPanelFinish(value) ? value : PANEL_FINISH_DEFAULT;
}

export function panelFinishName(value) {
  return getItem(normalizePanelFinish(value))?.name ?? 'Varsayılan';
}

/** Panele atanmış tip (bilinmiyorsa null). */
export function surfacePanelFinish(surface) {
  return isKnownPanelFinish(surface?.panelFinish) ? surface.panelFinish : null;
}

/** Varsayılan grubundaki panelin etkin tipi: panele atanan, yoksa standın tipi. */
export function effectivePanelFinish(surface, stand) {
  return surfacePanelFinish(surface) ?? normalizePanelFinish(stand?.panelFinish);
}

// Admin'den yüklenen doku Stand API'sinden (`/api/v1/fair-stand/textures/<ad>`), depodaki hazır doku
// (`textures/panel/...`) uygulamanın kendi dosyasından okunur (2026-11-18).
export const UPLOADED_TEXTURE_PREFIX = 'uploads/textures/';

export function panelTextureUrl(textureFile, baseUrl = '') {
  const path = String(textureFile ?? '');
  if (path.startsWith(UPLOADED_TEXTURE_PREFIX)) {
    return `/api/v1/fair-stand/textures/${encodeURIComponent(path.slice(UPLOADED_TEXTURE_PREFIX.length))}`;
  }
  return `${baseUrl}${path}`;
}

/**
 * Tipin görünüşü: `colorCss` null ise panel kendi katalog rengiyle çizilir (Varsayılan).
 * `textureUrl` varsa doku `tileWidthCm` × `tileHeightCm` döşenir.
 */
export function panelFinishAppearance(value, baseUrl = '') {
  const item = getItem(normalizePanelFinish(value));
  const colorCss = Number.isInteger(item?.defaultColor)
    ? `#${item.defaultColor.toString(16).padStart(6, '0')}`
    : null;
  const tileWidthCm = Number(item?.dimensions?.widthCm);
  const tileHeightCm = Number(item?.dimensions?.heightCm);
  const isDefault = item?.itemKey === PANEL_FINISH_DEFAULT || (!colorCss && !item?.textureFile);
  return {
    itemKey: item?.itemKey ?? PANEL_FINISH_DEFAULT,
    name: item?.name ?? 'Varsayılan',
    isDefault,
    colorCss,
    textureUrl: item?.textureFile ? panelTextureUrl(item.textureFile, baseUrl) : null,
    tileWidthCm: tileWidthCm > 0 ? tileWidthCm : 100,
    tileHeightCm: tileHeightCm > 0 ? tileHeightCm : 100,
  };
}
