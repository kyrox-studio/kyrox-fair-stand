// Kısa panel genişliği: katalogda Tek Sıra / Çift Sıra için birer kart vardır (migration 0079);
// kart bırakılırken genişlik sorulur. Pencere ve seçenekler genişlik ailesi düzenindedir
// (`catalogWidthFamily.js`); burada yalnız kısa panel varyantına sınırlı yardımcılar kalır.
import { isWallShortFamilyDescriptor } from './items.js';
import { formatCatalogWidthLabel, listCatalogWidthFamilyItems } from './catalogWidthFamily.js';

export function listWallShortWidthItems(variant) {
  if (!isWallShortFamilyDescriptor({ variant })) return [];
  return listCatalogWidthFamilyItems(variant);
}

export function formatWallShortWidthLabel(item) {
  return formatCatalogWidthLabel(item);
}
