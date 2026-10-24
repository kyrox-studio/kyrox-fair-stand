// Profil boyu seçimi: katalogdaki tek profil kartı bırakılırken boy sorulur (dikmedeki gibi).
// Seçenekler sahnede çizilebilen profil Item'larıdır; etikette gerçek boy (BOM) ve sahne boyu
// yazar (41,5 → 50 … 289 → 300). "Bir daha sorma" işaretlenirse seçilen boy bu tarayıcıda
// hatırlanır; Özellikler panelindeki profil boyu alanı boyu değiştirir, çentik oradan kaldırılınca
// yeniden sorulur.
import { listRegisteredItems } from './items.js';
import { readItemSizePreference, requestItemSizeChoice, writeItemSizePreference } from './itemSizeDialog.js';

export const PROFILE_LENGTH_PREFERENCE_KEY = 'fairStand.profileLengthItemKey';

function sceneLengthCm(item) {
  return Number(item.sceneDimensions?.widthCm ?? item.dimensions?.widthCm);
}

export function listProfileLengthItems() {
  return listRegisteredItems()
    // Yalnız sahnede çizilebilen profiller (is_render); çizilemeyen boy seçilirse bırakma reddedilirdi.
    .filter((item) => item.type === 'profile' && item.isRender !== false && sceneLengthCm(item) > 0)
    .sort((a, b) => sceneLengthCm(a) - sceneLengthCm(b));
}

export function readProfileLengthPreference(storage) {
  return readItemSizePreference(PROFILE_LENGTH_PREFERENCE_KEY, 'profile', storage);
}

export function writeProfileLengthPreference(itemKey, storage) {
  writeItemSizePreference(PROFILE_LENGTH_PREFERENCE_KEY, itemKey, storage);
}

export function formatProfileLengthLabel(item) {
  const realCm = Number(item.dimensions?.widthCm);
  const sceneCm = sceneLengthCm(item);
  return `${String(realCm).replace('.', ',')} cm (sahnede ${String(sceneCm).replace('.', ',')} cm)`;
}

/**
 * Profil boyu penceresi. Sonuç: { itemKey, remember } ya da iptalde null.
 * remember true: tercih yazılır; false: tercih silinir (yeniden sorulur).
 */
export function requestProfileLength({ selectedItemKey, remember = false } = {}) {
  return requestItemSizeChoice({
    title: 'Profil boyu',
    itemType: 'profile',
    items: listProfileLengthItems(),
    formatLabel: formatProfileLengthLabel,
    selectedItemKey,
    remember,
  });
}
