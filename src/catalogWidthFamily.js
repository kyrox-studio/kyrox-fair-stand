// Varyant ailesi: katalogda aile başına tek kart vardır; kart bırakılınca kartın kendisi (varsayılan
// varyant) konur. Varyant sahnede seçilen öğenin Özellikler panelinde seçilir ve canlı uygulanır.
// Aile Item'ın `variant` değeridir (DB); seçenekler aynı variant'taki, sahnede çizilebilen Item'lardır.
// Kısa panel (0079), duvar paneli ve separatör (0082), banko / köşe banko / baza (0083), vitrin, raf,
// TV, video wall ve uzun saksı (0086) bu düzendedir.
// Separatörde ek çentik (Sarmaşıklı) aynı genişliğin eş ailesindeki Item'ı seçer.
// Raf ailesinin üyeleri genişlik kartlarıdır (tekli / 2 / 3 sıralı); sahnedeki raf genişliği duvardan
// gelir (DB 0072 `fair_stand_item_width_variants`), varyant yalnız sıra sayısını değiştirir.
// Duvar yüksekliği seçimden sonra çözülür (createCatalogModuleState → resolveWallItemKeyForHeight).
import {
  getItem,
  getWidthVariantFamily,
  listRegisteredItems,
  resolveShelfRows,
  resolveWidthVariantItemKey,
} from './items.js';

function widthCm(item) {
  return Number(item?.dimensions?.widthCm);
}

function formatWidth(item) {
  return `${String(widthCm(item)).replace('.', ',')} cm`;
}

const SHELF_ROW_LABELS = Object.freeze({ 1: 'Tekli Raf', 2: 'Çiftli Raf', 3: '3\'lü Raf' });

// Raf kartı genişlik ailesidir; sıra sayısı ailenin üretim ürününün reçetesinden okunur.
function shelfRowCount(item) {
  const product = item?.widthVariants?.length ? getItem(item.widthVariants[0]) : item;
  return resolveShelfRows(product)?.count ?? 0;
}

function videoWallCells(item) {
  return Number(item?.videoWall?.rows) * Number(item?.videoWall?.cols);
}

const VARIANT_FAMILIES = Object.freeze({
  'wall-short-1': Object.freeze({ title: 'Panel genişliği' }),
  'wall-short-2': Object.freeze({ title: 'Panel genişliği' }),
  'wall-panel': Object.freeze({ title: 'Panel genişliği' }),
  'wall-separator': Object.freeze({
    title: 'Separatör genişliği',
    option: Object.freeze({ label: 'Sarmaşıklı', variant: 'wall-separator-sarmasik' }),
  }),
  'desk-banko': Object.freeze({ title: 'Banko ölçüsü' }),
  'desk-banko-l': Object.freeze({ title: 'Köşe banko ölçüsü' }),
  base: Object.freeze({ title: 'Baza ölçüsü' }),
  'wall-showcase': Object.freeze({
    title: 'Vitrin',
    cardLabel: 'Vitrin',
    order: (item) => Number(item.eyeCount),
    label: (item) => `${item.eyeCount} Gözlü`,
  }),
  'shelf-row': Object.freeze({
    title: 'Raf',
    cardLabel: 'Raf',
    order: shelfRowCount,
    label: (item) => SHELF_ROW_LABELS[shelfRowCount(item)] ?? item.name,
  }),
  tv: Object.freeze({
    title: 'Ekran boyu',
    cardLabel: 'TV',
    label: (item) => String(item.name).replace(/^TV\s*/, ''),
  }),
  'video-wall': Object.freeze({
    title: 'Video Wall düzeni',
    cardLabel: 'Video Wall',
    order: videoWallCells,
    label: (item) => `${item.videoWall.rows}×${item.videoWall.cols}`,
  }),
  'long-planter': Object.freeze({ title: 'Saksı ölçüsü', cardLabel: 'Uzun Saksı' }),
});

function familyOrder(family, item) {
  return family.order ? family.order(item) : widthCm(item);
}

/**
 * Öğenin aile Item'ı: duvar yüksekliği türevi (wall_100_250) 350 tabanına, raf genişliği
 * (shelf_row_2_150) kendi sıra kartına (shelf_row_2) çözülür.
 */
function resolveFamilyItem(descriptor) {
  const item = getItem(descriptor?.itemKey);
  const base = getItem(item?.wallHeightBaseItemKey) ?? item;
  if (descriptor?.variant && !base?.variant) return { ...base, variant: descriptor.variant };
  if (base?.variant) return base;
  const card = base ? getWidthVariantFamily(base) : null;
  return card?.variant ? card : base;
}

/** Eş aile (Sarmaşıklı) üyesi kendi ana ailesine çözülür. */
function resolveFamily(variant) {
  if (!variant) return null;
  if (VARIANT_FAMILIES[variant]) return { variant, family: VARIANT_FAMILIES[variant], optionOn: false };
  for (const [familyVariant, family] of Object.entries(VARIANT_FAMILIES)) {
    if (family.option?.variant === variant) return { variant: familyVariant, family, optionOn: true };
  }
  return null;
}

export function isCatalogWidthFamilyDescriptor(descriptor) {
  return resolveFamily(resolveFamilyItem(descriptor)?.variant) != null;
}

export function listCatalogWidthFamilyItems(variant) {
  const resolved = resolveFamily(variant);
  if (!resolved) return [];
  const family = VARIANT_FAMILIES[variant] ?? resolved.family;
  return listRegisteredItems()
    .filter((item) => item.variant === variant && item.isRender !== false && familyOrder(family, item) > 0)
    .sort((a, b) => familyOrder(family, a) - familyOrder(family, b));
}

export function formatCatalogWidthLabel(item) {
  return formatWidth(item);
}

/** Katalog kartı başlığı ailenin adıdır; ailesiz öğede null. */
export function getCatalogFamilyCardLabel(item) {
  return resolveFamily(item?.variant)?.family.cardLabel ?? null;
}

/** Seçilen genişlik + çentik → Item; eş ailede aynı genişlik yoksa null. */
export function resolveCatalogWidthChoice(familyVariant, itemKey, optionOn = false) {
  const resolved = resolveFamily(familyVariant);
  const item = getItem(itemKey);
  if (!resolved || !item || item.variant !== resolved.variant) return null;
  if (!optionOn || !resolved.family.option) return item.itemKey;
  return listCatalogWidthFamilyItems(resolved.family.option.variant)
    .find((candidate) => widthCm(candidate) === widthCm(item))?.itemKey ?? null;
}

/**
 * Sahnedeki öğenin varyant seçenekleri (Özellikler paneli). Ailesizse null.
 * `selectedItemKey` ana ailedeki üyedir; Sarmaşıklı gibi eş aile `option.checked` ile söylenir.
 */
export function describeModuleVariants(moduleState) {
  const familyItem = resolveFamilyItem(moduleState);
  const resolved = resolveFamily(familyItem?.variant);
  if (!resolved) return null;
  const items = listCatalogWidthFamilyItems(resolved.variant);
  if (items.length < 2) return null;
  const label = resolved.family.label ?? formatWidth;
  const selected = resolved.optionOn
    ? items.find((item) => widthCm(item) === widthCm(familyItem))
    : items.find((item) => item.itemKey === familyItem.itemKey);
  return {
    variant: resolved.variant,
    title: resolved.family.title,
    selectedItemKey: selected?.itemKey ?? null,
    options: items.map((item) => ({ itemKey: item.itemKey, label: label(item) })),
    option: resolved.family.option
      ? {
        label: resolved.family.option.label,
        checked: resolved.optionOn,
        // Seçili genişliğin eş ailede (ör. sarmaşıklı) karşılığı yoksa çentik seçilemez.
        available: selected ? resolveCatalogWidthChoice(resolved.variant, selected.itemKey, true) != null : false,
      }
      : null,
  };
}

/**
 * Panelde seçilen varyant → sahneye konacak Item. Raf sırasında genişlik öğenin bugünkü
 * genişliğinden çözülür (o genişlikte üye yoksa null).
 */
export function resolveModuleVariantItemKey(moduleState, itemKey, optionOn = false) {
  const resolved = resolveFamily(resolveFamilyItem(moduleState)?.variant);
  if (!resolved) return null;
  const chosen = resolveCatalogWidthChoice(resolved.variant, itemKey, optionOn);
  if (!chosen) return null;
  const chosenItem = getItem(chosen);
  if (Array.isArray(chosenItem?.widthVariants) && chosenItem.widthVariants.length) {
    return resolveWidthVariantItemKey(chosenItem, moduleState.widthCm);
  }
  return chosen;
}
