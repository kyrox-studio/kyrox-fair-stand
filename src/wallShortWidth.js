// Kısa panel genişliği: katalogda Tek Sıra / Çift Sıra için birer kart vardır (migration 0079);
// kart bırakılırken genişlik sorulur. Seçenekler kartla aynı wall-short varyantındaki, sahnede
// çizilebilen panellerdir (50 / 100 / 150 / 200). Kısa panel profile ve yan panele genişliğiyle
// bağlandığı için genişlik konum hesabından önce seçilir; tercih tutulmaz, her bırakışta sorulur.
import { getItem, isWallShortFamilyDescriptor, listRegisteredItems } from './items.js';
import { requestItemSizeChoice } from './itemSizeDialog.js';

function widthCm(item) {
  return Number(item.dimensions?.widthCm);
}

export function listWallShortWidthItems(variant) {
  if (!isWallShortFamilyDescriptor({ variant })) return [];
  return listRegisteredItems()
    .filter((item) => item.variant === variant && item.isRender !== false && widthCm(item) > 0)
    .sort((a, b) => widthCm(a) - widthCm(b));
}

export function formatWallShortWidthLabel(item) {
  return `${String(widthCm(item)).replace('.', ',')} cm`;
}

/**
 * Kısa panel genişliği penceresi. Sonuç: { itemKey, remember: false } ya da iptalde null.
 */
export function requestWallShortWidth({ selectedItemKey } = {}) {
  const variant = getItem(selectedItemKey)?.variant;
  const items = listWallShortWidthItems(variant);
  if (!items.length) return Promise.resolve(null);
  return requestItemSizeChoice({
    title: 'Panel genişliği',
    itemType: getItem(selectedItemKey).type,
    items,
    formatLabel: formatWallShortWidthLabel,
    selectedItemKey,
    fieldLabel: 'Genişlik',
    allowRemember: false,
  });
}
