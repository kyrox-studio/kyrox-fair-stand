// Profil boyu seçimi: katalogdaki tek profil kartı bırakılırken boy sorulur (dikmedeki gibi).
// Seçenekler `profile` varyant ailesinin (DB 0095, CRM admin "Varyant aileleri") sahnede çizilebilen
// üyeleridir; etikette gerçek boy (BOM) ve sahne boyu yazar (41,5 → 50 … 289 → 300). Pencere
// başlığı ailenin başlığıdır. "Bir daha sorma" işaretlenirse seçilen boy bu tarayıcıda hatırlanır;
// Özellikler panelindeki profil boyu alanı boyu değiştirir, çentik oradan kaldırılınca yeniden sorulur.
import { formatProfileLengthLabel, listCatalogWidthFamilyItems } from './catalogWidthFamily.js';
import { readItemSizePreference, requestItemSizeChoice, writeItemSizePreference } from './itemSizeDialog.js';
import { getVariantFamily } from './variantFamilies.js';

export { formatProfileLengthLabel };

export const PROFILE_LENGTH_PREFERENCE_KEY = 'fairStand.profileLengthItemKey';
export const PROFILE_FAMILY_KEY = 'profile';

export function listProfileLengthItems() {
  // Yalnız sahnede çizilebilen üyeler (is_render); çizilemeyen boy seçilirse bırakma reddedilirdi.
  return listCatalogWidthFamilyItems(PROFILE_FAMILY_KEY);
}

export function getProfileLengthTitle() {
  return getVariantFamily(PROFILE_FAMILY_KEY)?.title ?? '';
}

export function getProfileLengthTabLabel() {
  return getVariantFamily(PROFILE_FAMILY_KEY)?.tabLabel ?? '';
}

export function readProfileLengthPreference(storage) {
  return readItemSizePreference(PROFILE_LENGTH_PREFERENCE_KEY, 'profile', storage);
}

export function writeProfileLengthPreference(itemKey, storage) {
  writeItemSizePreference(PROFILE_LENGTH_PREFERENCE_KEY, itemKey, storage);
}

/**
 * Profil boyu penceresi. Sonuç: { itemKey, remember } ya da iptalde null.
 * remember true: tercih yazılır; false: tercih silinir (yeniden sorulur).
 */
export function requestProfileLength({ selectedItemKey, remember = false } = {}) {
  return requestItemSizeChoice({
    title: getProfileLengthTitle(),
    itemType: 'profile',
    items: listProfileLengthItems(),
    formatLabel: formatProfileLengthLabel,
    selectedItemKey,
    remember,
  });
}
