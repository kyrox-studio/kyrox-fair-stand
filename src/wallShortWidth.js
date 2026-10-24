// Kısa panel genişliği: katalogda Tek Sıra / Çift Sıra için birer kart vardır (migration 0079);
// kart 100 cm bırakılır, genişlik Özellikler panelinden seçilir (0086). Seçenekler varyant ailesi
// düzenindedir (`catalogWidthFamily.js`); burada yalnız kısa panel varyantına sınırlı yardımcılar kalır.
import { isWallShortFamilyDescriptor } from './items.js';
import { formatCatalogWidthLabel, listCatalogWidthFamilyItems } from './catalogWidthFamily.js';

export function listWallShortWidthItems(variant) {
  if (!isWallShortFamilyDescriptor({ variant })) return [];
  return listCatalogWidthFamilyItems(variant);
}

export function formatWallShortWidthLabel(item) {
  return formatCatalogWidthLabel(item);
}
