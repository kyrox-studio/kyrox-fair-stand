// Varyant aileleri (DB 0095 `fair_stand_variant_families`, CRM admin "Varyant aileleri" ekranı).
// Bootstrap `variantFamilies` yalnız etkin aileleri taşır; arşivdeki ailenin üyeleri ailesiz davranır.
// Her satır: key, title (panel / pencere başlığı), tabLabel, cardLabel (katalog kartı adı),
// labelRule (etiket ve sıra kuralı), optionFamilyKey + optionLabel (eş aile çentiği), sortIndex.

let families = new Map();
let optionParents = new Map();

function text(value) {
  return value == null || value === '' ? null : String(value);
}

export function initializeVariantFamilyRegistry(rows) {
  if (!Array.isArray(rows)) {
    throw new TypeError('Fair Stand variant family bootstrap rows must be an array.');
  }
  const next = new Map();
  for (const row of rows) {
    const key = text(row?.key);
    if (!key) throw new TypeError('Fair Stand variant family bootstrap row is missing key.');
    next.set(key, Object.freeze({
      key,
      title: String(row.title ?? ''),
      tabLabel: String(row.tabLabel ?? ''),
      cardLabel: text(row.cardLabel),
      labelRule: String(row.labelRule ?? 'width_cm'),
      optionFamilyKey: text(row.optionFamilyKey),
      optionLabel: text(row.optionLabel),
      sortIndex: Number(row.sortIndex) || 0,
    }));
  }
  const parents = new Map();
  for (const family of next.values()) {
    if (family.optionFamilyKey && next.has(family.optionFamilyKey)) parents.set(family.optionFamilyKey, family);
  }
  families = next;
  optionParents = parents;
}

export function getVariantFamily(key) {
  return families.get(key) ?? null;
}

/** Eş aile (ör. Sarmaşıklı) ise bağlı olduğu ana aile; değilse null. */
export function getOptionParentFamily(key) {
  return optionParents.get(key) ?? null;
}
