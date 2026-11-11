// Varyant ailesi: katalogda aile başına tek kart vardır; kart bırakılınca kartın kendisi (varsayılan
// varyant) konur. Varyant sahnede seçilen öğenin Özellikler panelinde seçilir ve canlı uygulanır.
// Aile Item'ın `variant` değeridir; aile tanımı (başlık, kart adı, sekme, etiket kuralı, eş aile) DB'den
// gelir (0095 `fair_stand_variant_families`, CRM admin "Varyant aileleri"; `variantFamilies.js`).
// Seçenekler aynı variant'taki, sahnede çizilebilen Item'lardır. Eş aile (Separatör → Sarmaşıklı)
// aynı genişliğin eş ailedeki Item'ını çentikle seçer.
// Raf ailesinin üyeleri genişlik kartlarıdır (tekli / 2 / 3 sıralı); sahnedeki raf genişliği duvardan
// gelir (DB 0072 `fair_stand_item_width_variants`), varyant yalnız sıra sayısını değiştirir.
// Profil ve dikme aileleri (`profile_length` / `upright_height` kuralı) bırakılırken boy penceresiyle
// seçilir (profileLength.js, uprightHeight.js); Özellikler panelinde boy alanı olarak durur.
// Duvar yüksekliği seçimden sonra çözülür (createCatalogModuleState → resolveWallItemKeyForHeight).
import {
  getItem,
  getWidthVariantFamily,
  listRegisteredItems,
  resolveShelfRows,
  resolveWidthVariantItemKey,
} from './items.js';
import { getOptionParentFamily, getVariantFamily } from './variantFamilies.js';

// Dikmenin gerçek boyu = duvar yüksekliği × 0,99 (250 cm duvar → 247,5 cm dikme).
export const UPRIGHT_REAL_HEIGHT_RATIO = 0.99;

function widthCm(item) {
  return Number(item?.dimensions?.widthCm);
}

function formatCm(value) {
  return String(value).replace('.', ',');
}

function formatWidth(item) {
  return `${formatCm(widthCm(item))} cm`;
}

function sceneLengthCm(item) {
  return Number(item?.sceneDimensions?.widthCm ?? item?.dimensions?.widthCm);
}

function uprightHeightCm(item) {
  return Number(item?.dimensions?.heightCm);
}

/** Profil boyu etiketi: gerçek boy (BOM) ve sahne boyu (41,5 → 50 … 289 → 300). */
export function formatProfileLengthLabel(item) {
  return `${formatCm(widthCm(item))} cm (sahnede ${formatCm(sceneLengthCm(item))} cm)`;
}

/** Dikme boyu etiketi: gerçek boy ve karşılık gelen duvar yüksekliği. */
export function formatUprightLabel(item) {
  const heightCm = uprightHeightCm(item);
  return `${formatCm(heightCm)} cm (${Math.round(heightCm / UPRIGHT_REAL_HEIGHT_RATIO)} cm duvar)`;
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Etiket kuralı (admin'de seçilir): düğme metni ve sıralama birlikte.
const LABEL_RULES = Object.freeze({
  width_cm: Object.freeze({ order: widthCm, label: formatWidth }),
  eye_count: Object.freeze({ order: (item) => Number(item.eyeCount), label: (item) => `${item.eyeCount} Gözlü` }),
  shelf_rows: Object.freeze({
    order: shelfRowCount,
    label: (item) => SHELF_ROW_LABELS[shelfRowCount(item)] ?? item.name,
  }),
  video_wall_grid: Object.freeze({
    order: videoWallCells,
    label: (item) => `${item.videoWall.rows}×${item.videoWall.cols}`,
  }),
  // Adın kart adından sonraki kısmı ("TV 42 inç" → "42 inç"); sıra genişlik.
  name_suffix: Object.freeze({
    order: widthCm,
    label: (item, family) => {
      const prefix = family.cardLabel ? new RegExp(`^${escapeRegExp(family.cardLabel)}\\s*`) : null;
      return (prefix ? String(item.name).replace(prefix, '') : String(item.name)) || item.name;
    },
  }),
  profile_length: Object.freeze({ order: sceneLengthCm, label: formatProfileLengthLabel, dropDialog: true }),
  upright_height: Object.freeze({ order: uprightHeightCm, label: formatUprightLabel, dropDialog: true }),
});

function labelRule(family) {
  return LABEL_RULES[family.labelRule] ?? LABEL_RULES.width_cm;
}

function familyOrder(family, item) {
  return labelRule(family).order(item);
}

function familyLabel(family, item) {
  return labelRule(family).label(item, family);
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
  const parent = getOptionParentFamily(variant);
  if (parent) return { variant: parent.key, family: parent, optionOn: true };
  const family = getVariantFamily(variant);
  return family ? { variant, family, optionOn: false } : null;
}

export function isCatalogWidthFamilyDescriptor(descriptor) {
  return resolveFamily(resolveFamilyItem(descriptor)?.variant) != null;
}

/** Ailenin sahnede çizilebilen üyeleri, etiket kuralının sırasıyla. */
export function listCatalogWidthFamilyItems(variant) {
  const family = getVariantFamily(variant);
  if (!family) return [];
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
  if (!optionOn || !resolved.family.optionFamilyKey) return item.itemKey;
  return listCatalogWidthFamilyItems(resolved.family.optionFamilyKey)
    .find((candidate) => widthCm(candidate) === widthCm(item))?.itemKey ?? null;
}

/**
 * Sahnedeki öğenin varyant seçenekleri (Özellikler paneli). Ailesizse null. Profil / dikme gibi
 * bırakılırken boy soran aile panelde boy alanıyla seçilir (main.js ITEM_SIZE_CHOICE_SPECS); null.
 * `selectedItemKey` ana ailedeki üyedir; Sarmaşıklı gibi eş aile `option.checked` ile söylenir.
 */
export function describeModuleVariants(moduleState) {
  const familyItem = resolveFamilyItem(moduleState);
  const resolved = resolveFamily(familyItem?.variant);
  if (!resolved || labelRule(resolved.family).dropDialog) return null;
  const items = listCatalogWidthFamilyItems(resolved.variant);
  if (items.length < 2) return null;
  const selected = resolved.optionOn
    ? items.find((item) => widthCm(item) === widthCm(familyItem))
    : items.find((item) => item.itemKey === familyItem.itemKey);
  return {
    variant: resolved.variant,
    title: resolved.family.title,
    tabLabel: resolved.family.tabLabel,
    selectedItemKey: selected?.itemKey ?? null,
    options: items.map((item) => ({ itemKey: item.itemKey, label: familyLabel(resolved.family, item) })),
    option: resolved.family.optionFamilyKey
      ? {
        label: resolved.family.optionLabel,
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
