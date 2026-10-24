// Genişlik ailesi: katalogda aile başına tek kart vardır; kart bırakılırken (ya da katalogdan
// eklenirken) genişlik sorulur. Aile Item'ın `variant` değeridir (DB); seçenekler aynı variant'taki,
// sahnede çizilebilen Item'lardır. Kısa panel (0079), duvar paneli ve separatör (0082) bu düzendedir.
// Separatör penceresinde ek çentik (Sarmaşıklı) aynı genişliğin eş ailesindeki Item'ı seçer.
// Tercih tutulmaz, her bırakışta sorulur. Duvar yüksekliği seçimden sonra çözülür
// (createCatalogModuleState → resolveWallItemKeyForHeight).
import { getItem, listRegisteredItems } from './items.js';
import { requestItemSizeChoice } from './itemSizeDialog.js';

const WIDTH_FAMILIES = Object.freeze({
  'wall-short-1': Object.freeze({ title: 'Panel genişliği' }),
  'wall-short-2': Object.freeze({ title: 'Panel genişliği' }),
  'wall-panel': Object.freeze({ title: 'Panel genişliği' }),
  'wall-separator': Object.freeze({
    title: 'Separatör genişliği',
    option: Object.freeze({ label: 'Sarmaşıklı', variant: 'wall-separator-sarmasik' }),
  }),
  // Banko, köşe banko ve baza (0083): sahneye konurken ölçü sorulur; pencere 100 seçili açılır.
  'desk-banko': Object.freeze({ title: 'Banko ölçüsü', defaultWidthCm: 100 }),
  'desk-banko-l': Object.freeze({ title: 'Köşe banko ölçüsü', defaultWidthCm: 100 }),
  base: Object.freeze({ title: 'Baza ölçüsü', defaultWidthCm: 100 }),
});

function widthCm(item) {
  return Number(item?.dimensions?.widthCm);
}

function variantOf(descriptor) {
  return descriptor?.variant ?? getItem(descriptor?.itemKey)?.variant ?? null;
}

/** Eş aile (Sarmaşıklı) üyesi kendi ana ailesine çözülür. */
function resolveFamily(variant) {
  if (WIDTH_FAMILIES[variant]) return { variant, family: WIDTH_FAMILIES[variant], optionOn: false };
  for (const [familyVariant, family] of Object.entries(WIDTH_FAMILIES)) {
    if (family.option?.variant === variant) return { variant: familyVariant, family, optionOn: true };
  }
  return null;
}

export function isCatalogWidthFamilyDescriptor(descriptor) {
  return resolveFamily(variantOf(descriptor)) != null;
}

export function listCatalogWidthFamilyItems(variant) {
  if (!variant) return [];
  return listRegisteredItems()
    .filter((item) => item.variant === variant && item.isRender !== false && widthCm(item) > 0)
    .sort((a, b) => widthCm(a) - widthCm(b));
}

export function formatCatalogWidthLabel(item) {
  return `${String(widthCm(item)).replace('.', ',')} cm`;
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
 * Genişlik penceresi. Sonuç: { itemKey } ya da iptalde / aile dışında null.
 * `selectedItemKey` duvar yüksekliği türevi olabilir (wall_100_250); 350 tabanına çözülür.
 */
export function requestCatalogWidth({ selectedItemKey } = {}) {
  const selected = getItem(selectedItemKey);
  const base = getItem(selected?.wallHeightBaseItemKey) ?? selected;
  const resolved = resolveFamily(base?.variant);
  if (!resolved) return Promise.resolve(null);
  const items = listCatalogWidthFamilyItems(resolved.variant);
  if (!items.length) return Promise.resolve(null);
  const preferredWidthCm = resolved.family.defaultWidthCm ?? widthCm(base);
  const preselected = items.find((item) => widthCm(item) === preferredWidthCm)?.itemKey ?? items[0].itemKey;
  return requestItemSizeChoice({
    title: resolved.family.title,
    itemType: base.type,
    items,
    formatLabel: formatCatalogWidthLabel,
    selectedItemKey: preselected,
    fieldLabel: 'Genişlik',
    allowRemember: false,
    option: resolved.family.option
      ? {
        label: resolved.family.option.label,
        checked: resolved.optionOn,
        // Seçili genişliğin eş ailede (ör. sarmaşıklı) karşılığı yoksa çentik seçilemez.
        isAvailable: (itemKey) => resolveCatalogWidthChoice(resolved.variant, itemKey, true) != null,
      }
      : null,
  }).then((choice) => {
    if (!choice) return null;
    const itemKey = resolveCatalogWidthChoice(resolved.variant, choice.itemKey, choice.option === true);
    return itemKey ? { itemKey } : null;
  });
}
