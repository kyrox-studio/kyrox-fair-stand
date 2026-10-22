// Dikme boyu seçimi: katalogdaki tek dikme kartı bırakılırken boy sorulur. Varsayılan seçili
// duvar yüksekliğinin dikmesidir (gerçek boy = duvar × 0,99). "Bir daha sorma" işaretlenirse
// seçilen boy bu tarayıcıda hatırlanır ve sonraki dikmeler sormadan o boyda gelir; sağ tık
// "Dikme yüksekliği…" aynı pencereyi açar, çentik oradan kaldırılınca yeniden sorulur.
import { listRegisteredItems } from './items.js';
import { readItemSizePreference, requestItemSizeChoice, writeItemSizePreference } from './itemSizeDialog.js';

export const UPRIGHT_HEIGHT_PREFERENCE_KEY = 'fairStand.uprightHeightItemKey';
const UPRIGHT_REAL_HEIGHT_RATIO = 0.99;

export function listUprightHeightItems() {
  return listRegisteredItems()
    // Yalnız sahnede çizilebilen dikmeler (is_render); çizilemeyen boy seçilirse bırakma reddedilirdi.
    .filter((item) => item.type === 'upright' && item.isRender !== false && Number(item.dimensions?.heightCm) > 0)
    .sort((a, b) => Number(a.dimensions.heightCm) - Number(b.dimensions.heightCm));
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

function formatUprightLabel(item) {
  const heightCm = Number(item.dimensions.heightCm);
  const wallCm = Math.round(heightCm / UPRIGHT_REAL_HEIGHT_RATIO);
  return `${String(heightCm).replace('.', ',')} cm (${wallCm} cm duvar)`;
}

/**
 * Dikme boyu penceresi. Sonuç: { itemKey, remember } ya da iptalde null.
 * remember true: tercih yazılır; false: tercih silinir (yeniden sorulur).
 */
export function requestUprightHeight({ selectedItemKey, remember = false } = {}) {
  return requestItemSizeChoice({
    title: 'Dikme yüksekliği',
    itemType: 'upright',
    items: listUprightHeightItems(),
    formatLabel: formatUprightLabel,
    selectedItemKey,
    remember,
  });
}
