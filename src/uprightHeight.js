// Dikme boyu seçimi: katalogdaki tek dikme kartı bırakılırken boy sorulur. Seçenekler `upright`
// varyant ailesinin (DB 0095, CRM admin "Varyant aileleri") sahnede çizilebilen üyeleridir; pencere
// başlığı ailenin başlığıdır. Varsayılan seçili duvar yüksekliğinin dikmesidir (gerçek boy = duvar
// × 0,99). "Bir daha sorma" işaretlenirse seçilen boy bu tarayıcıda hatırlanır ve sonraki dikmeler
// sormadan o boyda gelir; Özellikler panelindeki dikme boyu alanı boyu değiştirir, çentik oradan
// kaldırılınca yeniden sorulur.
import {
  formatUprightLabel,
  listCatalogWidthFamilyItems,
  UPRIGHT_REAL_HEIGHT_RATIO,
} from './catalogWidthFamily.js';
import { readItemSizePreference, requestItemSizeChoice, writeItemSizePreference } from './itemSizeDialog.js';
import { getVariantFamily } from './variantFamilies.js';

export { formatUprightLabel };

export const UPRIGHT_HEIGHT_PREFERENCE_KEY = 'fairStand.uprightHeightItemKey';
export const UPRIGHT_FAMILY_KEY = 'upright';

export function listUprightHeightItems() {
  // Yalnız sahnede çizilebilen üyeler (is_render); çizilemeyen boy seçilirse bırakma reddedilirdi.
  return listCatalogWidthFamilyItems(UPRIGHT_FAMILY_KEY);
}

export function getUprightHeightTitle() {
  return getVariantFamily(UPRIGHT_FAMILY_KEY)?.title ?? '';
}

export function getUprightHeightTabLabel() {
  return getVariantFamily(UPRIGHT_FAMILY_KEY)?.tabLabel ?? '';
}

export function defaultUprightItemKeyForWallHeight(wallLineHeightCm) {
  const items = listUprightHeightItems();
  const match = items.find((item) => (
    Math.abs(Number(item.dimensions.heightCm) - Number(wallLineHeightCm) * UPRIGHT_REAL_HEIGHT_RATIO) < 0.01
  ));
  return match?.itemKey ?? items.at(-1)?.itemKey ?? null;
}

export function readUprightHeightPreference(storage) {
  return readItemSizePreference(UPRIGHT_HEIGHT_PREFERENCE_KEY, 'upright', storage);
}

export function writeUprightHeightPreference(itemKey, storage) {
  writeItemSizePreference(UPRIGHT_HEIGHT_PREFERENCE_KEY, itemKey, storage);
}

/**
 * Dikme boyu penceresi. Sonuç: { itemKey, remember } ya da iptalde null.
 * remember true: tercih yazılır; false: tercih silinir (yeniden sorulur).
 */
export function requestUprightHeight({ selectedItemKey, remember = false } = {}) {
  return requestItemSizeChoice({
    title: getUprightHeightTitle(),
    itemType: 'upright',
    items: listUprightHeightItems(),
    formatLabel: formatUprightLabel,
    selectedItemKey,
    remember,
  });
}
