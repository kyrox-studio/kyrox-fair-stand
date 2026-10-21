import { getStandDimensions, setStandWallLineHeightCm } from './standDimensions.js';
import { WALL_PANEL_BAND_PITCH_CM, resolveWallPanelBandPitchCm } from './wallPanelBand.js';

// catalogVisible / categoryId / catalogItemIndex her Item'ın kendi katalog görünüm verisidir.
// previewId görünür Item'da Catalog kart silüet tanımıdır; type üzerinden seçilmez.
// dimensions fiziksel ürün ölçüsüdür; sceneDimensions aynı field setinin runtime override katmanıdır.
// categoryId yalnız UI gruplamasıdır; type, Item Contract veya registry grubundan türetilmez.
// Catalog, Item runtime repository değildir; catalogVisible=false Item'ı yok etmez.
// Kanonik Item tablosu. Satır = Item (`itemKey`). Kova map yoktur.

let itemByKey = null;
/** Kuraldan türetilen duvar yükseklikleri: getItem bulur, Item listesine girmez. */
let derivedItemByKey = Object.create(null);
let catalogReady = false;
let snapRuleById = null;
let snapRuleByKey = null;
let itemTypeByKey = null;

function freezeDeep(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    value.forEach(freezeDeep);
    return Object.freeze(value);
  }
  for (const nested of Object.values(value)) freezeDeep(nested);
  return Object.freeze(value);
}

/** Stand kurulumunda seçilebilen duvar hattı yükseklikleri (cm). */
export const WALL_LINE_HEIGHTS_CM = Object.freeze([250, 300, 350, 400, 450, 500]);

/**
 * Duvar yüksekliği kuralı (DB 0068): reçete satırında perBand ve heightMatched varsa üst ürün,
 * kendi yüksekliğindeki (ör. wall_100_350) reçeteden başka yüksekliklere türetilir:
 * adet = quantity + perBand × bant farkı (50 cm), heightMatched parça (dikme) o yüksekliğin
 * dikmesiyle değişir. Türetilen ürün katalogda görünmez; stand yüksekliği seçer.
 */
// Kodda yükseklik parçası: son "_350" (ardından yalnız "_sarmasik" gibi bir ek gelebilir).
function wallHeightKeyPattern(itemKey, heightCm) {
  return new RegExp(`_${heightCm}(_[a-z]+)?$`).test(itemKey);
}

function wallKeyForHeight(itemKey, fromHeightCm, toHeightCm) {
  return itemKey.replace(new RegExp(`_${fromHeightCm}(_[a-z]+)?$`), (match, tail = '') => `_${toHeightCm}${tail}`);
}

function buildWallHeightVariants(registry) {
  const variants = Object.create(null);
  // Dikmenin gerçek boyu = duvar yüksekliği × 0,99 (ürün tablosu: 247,5 / 297 / 346,5 / 396 /
  // 445,5 / 495; kısa duvar dikmeleri 49,5 / 99 de aynı kurala uyar).
  const uprightByLineHeight = new Map();
  for (const item of Object.values(registry)) {
    const realHeight = Number(item?.dimensions?.heightCm);
    if (item?.type !== 'upright' || !Number.isFinite(realHeight)) continue;
    const lineHeight = Math.round(realHeight / 0.99);
    if (Math.abs(lineHeight * 0.99 - realHeight) < 0.01) uprightByLineHeight.set(lineHeight, item);
  }
  for (const base of Object.values(registry)) {
    const rows = base?.composition?.mode === 'recipe' ? base.composition.items : null;
    if (!Array.isArray(rows) || !rows.some((row) => Number(row?.perBand) || row?.heightMatched)) continue;
    const baseHeight = Number(base.sceneDimensions?.heightCm);
    if (!Number.isFinite(baseHeight) || !wallHeightKeyPattern(base.itemKey, baseHeight)) continue;
    for (const heightCm of WALL_LINE_HEIGHTS_CM) {
      if (heightCm === baseHeight) continue;
      const itemKey = wallKeyForHeight(base.itemKey, baseHeight, heightCm);
      if (registry[itemKey] || variants[itemKey]) continue;
      const bandDelta = (heightCm - baseHeight) / WALL_PANEL_BAND_PITCH_CM;
      if (!Number.isInteger(bandDelta)) continue;
      const upright = uprightByLineHeight.get(heightCm) ?? null;
      const items = rows.map((row) => ({
        ...row,
        itemKey: row.heightMatched ? upright?.itemKey : row.itemKey,
        quantity: Number(row.quantity) + (Number(row.perBand) || 0) * bandDelta,
      }));
      if (items.some((row) => !row.itemKey || !(row.quantity > 0))) continue;
      const derived = structuredClone(base);
      derived.itemKey = itemKey;
      derived.name = `${base.name} · ${heightCm} cm`;
      derived.catalogVisible = false;
      derived.wallHeightBaseItemKey = base.itemKey;
      derived.sceneDimensions = { ...base.sceneDimensions, heightCm };
      derived.composition = { ...base.composition, items };
      variants[itemKey] = freezeDeep(derived);
    }
  }
  return variants;
}

/** Duvar ürününün seçilen yükseklikteki karşılığı (wall_100_350 → wall_100_250); yoksa kendisi. */
export function resolveWallItemKeyForHeight(itemKey, heightCm) {
  const item = itemKey ? getItem(itemKey) : null;
  const height = Number(heightCm);
  if (!item || !Number.isFinite(height)) return itemKey;
  const baseKey = item.wallHeightBaseItemKey ?? itemKey;
  const base = getItem(baseKey);
  const baseHeight = Number(base?.sceneDimensions?.heightCm);
  if (!base || !Number.isFinite(baseHeight)) return itemKey;
  if (height === baseHeight) return baseKey;
  if (!wallHeightKeyPattern(baseKey, baseHeight)) return itemKey;
  const candidate = wallKeyForHeight(baseKey, baseHeight, height);
  return getItem(candidate)?.wallHeightBaseItemKey === baseKey ? candidate : itemKey;
}

export function isItemCatalogReady() {
  return catalogReady === true;
}

export function initializeItemRegistry(items) {
  if (!Array.isArray(items)) {
    throw new TypeError('Fair Stand Item catalog bootstrap items must be an array.');
  }
  const next = Object.create(null);
  for (const item of items) {
    if (!item?.itemKey) throw new TypeError('Bootstrapped Item is missing itemKey.');
    const cloned = structuredClone(item);
    delete cloned.snapFace;
    delete cloned.snapEdge;
    next[item.itemKey] = freezeDeep(cloned);
  }
  derivedItemByKey = Object.freeze(buildWallHeightVariants(next));
  itemByKey = Object.freeze(next);
  catalogReady = true;
  syncProfileColorCss();
}

/** Item.defaultColor (DB) → css hex. Görünür başlangıç rengi bundan okunur. */
export function itemDefaultColorCss(itemOrKey) {
  const item = typeof itemOrKey === 'string' ? getItem(itemOrKey) : itemOrKey;
  const defaultColor = item?.defaultColor;
  if (!Number.isInteger(defaultColor)) {
    throw new TypeError(`Missing canonical defaultColor for ${item?.itemKey ?? 'unknown Item'}.`);
  }
  return `#${defaultColor.toString(16).padStart(6, '0')}`;
}

function syncProfileColorCss() {
  if (typeof document === 'undefined') return;
  const profile = Object.values(itemByKey).find(
    (item) => item.type === 'profile' && Number.isInteger(item.defaultColor),
  );
  if (!profile) return;
  document.documentElement.style.setProperty('--aluminum-profile-color', itemDefaultColorCss(profile));
}

export function initializeSnapRuleRegistry(rules) {
  if (!Array.isArray(rules)) {
    throw new TypeError('Fair Stand snap rules bootstrap must be an array.');
  }
  const byId = Object.create(null);
  const byKey = Object.create(null);
  for (const rule of rules) {
    if (rule == null || rule.id == null || !rule.key) {
      throw new TypeError('Bootstrapped snap rule is missing id/key.');
    }
    const frozen = freezeDeep(structuredClone(rule));
    byId[Number(rule.id)] = frozen;
    byKey[String(rule.key)] = frozen;
  }
  snapRuleById = Object.freeze(byId);
  snapRuleByKey = Object.freeze(byKey);
}

export function initializeItemTypeRegistry(itemTypes) {
  if (!Array.isArray(itemTypes)) {
    throw new TypeError('Fair Stand item types bootstrap must be an array.');
  }
  const byKey = Object.create(null);
  for (const row of itemTypes) {
    if (row == null || !row.key) {
      throw new TypeError('Bootstrapped item type is missing key.');
    }
    byKey[String(row.key)] = freezeDeep(structuredClone(row));
  }
  itemTypeByKey = Object.freeze(byKey);
}

export function resetItemRegistry() {
  itemByKey = null;
  derivedItemByKey = Object.create(null);
  catalogReady = false;
  snapRuleById = null;
  snapRuleByKey = null;
  itemTypeByKey = null;
}

export function getItemType(key) {
  if (key == null || key === '' || !itemTypeByKey) return null;
  return itemTypeByKey[String(key)] ?? null;
}

export function getSnapRule(idOrKey) {
  if (idOrKey == null || idOrKey === '') return null;
  if (typeof idOrKey === 'number' || (typeof idOrKey === 'string' && /^\d+$/.test(idOrKey))) {
    return snapRuleById?.[Number(idOrKey)] ?? null;
  }
  return snapRuleByKey?.[String(idOrKey)] ?? null;
}

/** Face/edge from matched snap rule. Prefer requires-spec rule (same id as provides). */
export function resolveItemSnapGeometry(itemOrKey, preferredSpec = null) {
  if (preferredSpec) {
    const matched =
      getSnapRule(preferredSpec.requiresRuleId) ?? getSnapRule(preferredSpec.requires);
    if (matched) {
      return {
        face: typeof matched.face === 'string' ? matched.face : null,
        edge: typeof matched.edge === 'string' ? matched.edge : null,
      };
    }
  }
  const item = typeof itemOrKey === 'string' ? getItem(itemOrKey) : itemOrKey;
  if (!item) return { face: null, edge: null };
  const rule =
    getSnapRule(item.snapProvidesRuleId)
    ?? getSnapRule(item.snapRequiresRuleId)
    ?? getSnapRule(item.snapProvides)
    ?? getSnapRule(item.snapRequires)
    ?? listSnapRulesForItemType(item.type)[0]
    ?? null;
  return {
    face: typeof rule?.face === 'string' ? rule.face : null,
    edge: typeof rule?.edge === 'string' ? rule.edge : null,
  };
}

function ruleItemTypeKeys(rule) {
  if (!rule) return [];
  if (Array.isArray(rule.itemTypeKeys)) return rule.itemTypeKeys;
  if (Array.isArray(rule.item_type_keys)) return rule.item_type_keys;
  return [];
}

/** Rules whose CRM type link includes this item_type → those types provide the rule. */
export function listSnapRulesForItemType(itemType) {
  if (!itemType || !snapRuleById) return [];
  return Object.values(snapRuleById).filter((rule) => ruleItemTypeKeys(rule).includes(itemType));
}

function itemTypeProvidesRule(item, rule) {
  if (!item?.type || !rule) return false;
  return ruleItemTypeKeys(rule).includes(item.type);
}

function requireRegistry() {
  if (!itemByKey) {
    throw new Error('Fair Stand Item catalog is not bootstrapped.');
  }
  return itemByKey;
}



// Bağımsız ticari ürünler, doğrulanmış ürün varsayılanlarının sahibidir.


const COMMERCIAL_TYPES = Object.freeze(new Set([
  'coat-rack',
  'kettle',
  'mini-fridge',
  'plastic-trash-bin',
]));

export function getCommercialItemForType(type) {
  if (!COMMERCIAL_TYPES.has(type)) return null;
  return Object.values(requireRegistry()).find((item) => item.type === type) ?? null;
}

// Extra furniture. Tekil Item'lar kendi type'ına sahip. Eames ve klasik koltuk takımları child Item kümesidir.
// BOM decision-required — unit / composition.items / moduleRecipes uydurulmaz.


const FURNITURE_TYPES = Object.freeze(new Set([
  'sofa-set-classic',
  'sofa-single-classic',
  'sofa-double-classic',
  'coffee-table-classic',
  'table-chair-set-eames',
  'chair',
  'table-glass',
  'bar-stool',
]));

export function getFurnitureItemForType(type) {
  if (!FURNITURE_TYPES.has(type)) return null;
  return Object.values(requireRegistry()).find((item) => item.type === type) ?? null;
}

// Üst profil LED projektör. Tekil katalog Item. BOM decision-required — unit/recipe uydurulmaz.


export function getTopLightItemForType(type) {
  if (type !== 'led-floodlight') return null;
  const item = getItem('led_floodlight');
  return item?.type === type ? item : null;
}

// Katalog dışı SVG → ışıklı strafor. itemKey type ile aynıdır; Catalog kartı yoktur.


// Zemin kaplamaları modül değildir. Baz persist alanı stand.itemKey.
// İsteğe bağlı tek override stand.floorArea. Katalog/recipe yok.


export function listFloorItems() {
  return Object.values(requireRegistry()).filter((item) => item.type === 'floor');
}

export function getFloorItem(itemKey) {
  const item = requireRegistry()[itemKey];
  return item?.type === 'floor' ? item : null;
}

export function getFloorSelectLabel(item) {
  if (!item) return '';
  const widthCm = Number(item.dimensions?.widthCm);
  const depthCm = Number(item.dimensions?.depthCm);
  if (item.paintable && Number.isFinite(widthCm) && Number.isFinite(depthCm)) {
    return `${item.name} · ${widthCm} × ${depthCm} cm`;
  }
  return item.name;
}

export function isParquetFloorItem(item) {
  return item?.type === 'floor'
    && Number(item.dimensions?.widthCm) > 0
    && Number(item.dimensions?.depthCm) > 0
    && item.paintable === false;
}

export function isGridTileFloorItem(item) {
  return item?.type === 'floor'
    && Boolean(item.paintable)
    && Number(item.dimensions?.widthCm) > 0
    && Number(item.dimensions?.depthCm) > 0
    && !isParquetFloorItem(item);
}

export function isCarpetFloorItem(item) {
  return item?.type === 'floor'
    && Boolean(item.paintable)
    && !Number(item.dimensions?.widthCm);
}

export function resolveStandFloorItemKey(standOrKey) {
  const raw = typeof standOrKey === 'string'
    ? standOrKey
    : (standOrKey?.itemKey ?? null);
  return getFloorItem(raw)?.itemKey ?? getFloorItem('karolaj').itemKey;
}

export function getFurnitureClusterQuantity(item, childItemKey) {
  const entry = item?.composition?.items?.find((row) => row.itemKey === childItemKey);
  return entry == null ? null : Number(entry.quantity);
}

const RECIPE_WALL_PANEL_CHILD_TYPES = Object.freeze(new Set(['panel', 'separator-panel']));

/** Recipe BOM panel slot count for wall-like modules (editable strip slots). */
export function countRecipeWallPanelSlots(item) {
  if (item?.composition?.mode !== 'recipe' || !Array.isArray(item.composition.items)) {
    return null;
  }
  let total = 0;
  for (const row of item.composition.items) {
    const childItemKey = row?.itemKey ?? null;
    const child = childItemKey ? getItem(childItemKey) : null;
    if (!child || !RECIPE_WALL_PANEL_CHILD_TYPES.has(child.type)) continue;
    const quantity = Number(row.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new TypeError(`Invalid recipe panel quantity for ${item.itemKey} → ${childItemKey}: ${row.quantity}.`);
    }
    total += quantity;
  }
  return total > 0 ? total : null;
}

/** Recipe panel slots — BOM quantity is authority (no silent ceiling clamp). */
export function resolveFlatPanelStripCount(item) {
  const fromRecipe = countRecipeWallPanelSlots(item);
  if (fromRecipe != null) {
    return fromRecipe;
  }
  const pitchCm = Math.round(Number(resolveWallPanelBandPitchCm()));
  const ceilingHeightCm = requireSceneDimension(item, 'heightCm');
  return Math.max(1, Math.floor(Number(ceilingHeightCm) / pitchCm));
}

/** Full-height editable strip slots for showcase modules (ceiling ÷ band pitch). */
export function resolveShowcaseStripCount(item) {
  const pitchCm = Math.round(Number(resolveWallPanelBandPitchCm()));
  const ceilingHeightCm = requireSceneDimension(item, 'heightCm');
  return Math.max(1, Math.floor(Number(ceilingHeightCm) / pitchCm));
}

// Yapay bitki / uzun saksı ailesi. Hepsi type `indoor-plant-1`; ayrım kayıtlı itemKey.
// BOM decision-required — composition/recipe uydurulmaz.


// Duvara asılan medya ürünleri tek `tv` davranış ailesini paylaşır. Sıradan TV'ler
// doğrulanmış ekran ölçüsüne göre parametriktir; widthCm/heightCm görünür ekrandır.
// Video wall panel ölçüsü video_wall_panel Item'ındadır; ızgara rows/cols parent'ta kalır.


function resolveVideoWallPanelItem(item) {
  const panelItemKey = item?.videoWall?.panelItemKey ?? null;
  return panelItemKey ? getItem(panelItemKey) : null;
}

// Katalog, state oluşturucu ve seçim geri bildiriminin kullandığı duvar-medya ölçü çözümleyicisi.
// Video wall toplamları video_wall_panel × ızgaradan okunur; sıradan TV canonical dimensions kullanır.
export function resolveWallMediaMetrics(itemOrKey) {
  const item = typeof itemOrKey === 'string' ? getItem(itemOrKey) : itemOrKey;
  if (!item || item.type !== 'tv') return null;
  const scene = resolveSceneDimensions(item);
  const depthCm = Number(item.dimensions?.depthCm);
  const base = {
    itemKey: item.itemKey, type: item.type, label: item.name, depthCm,
    widthCm: scene.widthCm,
    heightCm: scene.heightCm,
  };
  if (item.videoWall) {
    const panel = resolveVideoWallPanelItem(item);
    const panelWidthCm = Number(panel?.dimensions?.widthCm);
    const panelHeightCm = Number(panel?.dimensions?.heightCm);
    if (!Number.isFinite(panelWidthCm) || !Number.isFinite(panelHeightCm)) {
      throw new TypeError(`Missing video_wall_panel dimensions for ${item.itemKey}.`);
    }
    return Object.freeze({
      ...base,
      widthCm: panelWidthCm * item.videoWall.cols,
      heightCm: panelHeightCm * item.videoWall.rows,
      videoWallRows: item.videoWall.rows,
      videoWallCols: item.videoWall.cols,
      panelItemKey: item.videoWall.panelItemKey,
    });
  }
  return Object.freeze({
    ...base,
    videoWallRows: 1,
    videoWallCols: 1,
  });
}





/** Maksima duvar hattı tavanı (parent SKU suffix); stand zarfı ayrı. */
export const CATALOG_WALL_LINE_HEIGHT_CM = 350;

export function catalogWallFlatPanelItemKey(widthCm, lineHeightCm = CATALOG_WALL_LINE_HEIGHT_CM) {
  return `wall_${widthCm}_${lineHeightCm}`;
}

export function catalogPlainSeparatorItemKey(widthCm, lineHeightCm = CATALOG_WALL_LINE_HEIGHT_CM) {
  return `wall_separator_${widthCm}_${lineHeightCm}`;
}

export function catalogDoorItemKey(widthCm = 100, lineHeightCm = CATALOG_WALL_LINE_HEIGHT_CM) {
  return `wall_door_${widthCm}_${lineHeightCm}`;
}

const SHOWCASE_ITEM_KEYS_BY_TYPE = Object.freeze({
  'showcase-2': `wall_showcase_100_2_${CATALOG_WALL_LINE_HEIGHT_CM}`,
  'showcase-3': `wall_showcase_100_3_${CATALOG_WALL_LINE_HEIGHT_CM}`,
});

export function getShowcaseItemKeyForType(type) {
  return SHOWCASE_ITEM_KEYS_BY_TYPE[type] ?? null;
}

export function getShowcaseBodyDefinition(itemOrKey) {
  const item = typeof itemOrKey === 'string' ? getItem(itemOrKey) : itemOrKey;
  const expectedItemKey = getShowcaseItemKeyForType(item?.type);
  // Türetilmiş yükseklik (wall_showcase_100_2_250) aynı gövde parçalarını kullanır.
  if (!item || !expectedItemKey || (item.wallHeightBaseItemKey ?? item.itemKey) !== expectedItemKey) return null;

  const sideItem = getItem(item.bodyItems?.sideItemKey);
  const horizontalItem = getItem(item.bodyItems?.horizontalItemKey);
  const glassShelfItem = getItem(item.bodyItems?.glassShelfItemKey);
  if (!sideItem?.dimensions || !horizontalItem?.dimensions || !glassShelfItem?.dimensions) {
    throw new TypeError(`Canonical showcase body Items are incomplete for ${item.itemKey}.`);
  }
  if (sideItem.material !== 'sunta' || horizontalItem.material !== 'sunta') {
    throw new TypeError(`Canonical showcase body boards must be sunta for ${item.itemKey}.`);
  }
  if (Number(sideItem.dimensions.depthCm) !== Number(horizontalItem.dimensions.depthCm)
      || Number(sideItem.dimensions.heightCm) !== Number(horizontalItem.dimensions.heightCm)) {
    throw new TypeError(`Canonical showcase body board depth/height mismatch for ${item.itemKey}.`);
  }
  if (!Number.isInteger(sideItem.defaultColor)
      || sideItem.defaultColor !== horizontalItem.defaultColor) {
    throw new TypeError(`Canonical showcase body default color mismatch for ${item.itemKey}.`);
  }
  return Object.freeze({
    item, sideItem, horizontalItem, glassShelfItem, defaultColor: sideItem.defaultColor,
  });
}

export function getItem(itemKey) {
  return requireRegistry()[itemKey] ?? derivedItemByKey[itemKey] ?? null;
}

/**
 * Genişlik ailesi (DB 0072 `fair_stand_item_width_variants`): katalog kartı (ör. "2 sıralı raf")
 * takıldığı duvar modülünün genişliğine göre bir ürüne çözülür (shelf_row_2_150). Kartın kendisi
 * de, ailedeki ürünler de aynı aileye çözülür; eşleme anahtar deseniyle değil DB satırıyla yapılır.
 */
export function getWidthVariantFamily(itemOrKey) {
  const item = typeof itemOrKey === 'string' ? getItem(itemOrKey) : itemOrKey;
  if (!item?.itemKey) return null;
  if (Array.isArray(item.widthVariants) && item.widthVariants.length) return item;
  return listRegisteredItems().find((candidate) => (
    Array.isArray(candidate.widthVariants) && candidate.widthVariants.includes(item.itemKey)
  )) ?? null;
}

/** Ailenin genişliğe göre ürünleri, genişliğe göre sıralı: [{ itemKey, widthCm }]. */
export function listWidthVariants(itemOrKey) {
  const family = getWidthVariantFamily(itemOrKey);
  if (!family) return [];
  return family.widthVariants
    .map((itemKey) => ({ itemKey, widthCm: Number(getItem(itemKey)?.dimensions?.widthCm) }))
    .filter((variant) => Number.isFinite(variant.widthCm) && variant.widthCm > 0)
    .sort((a, b) => a.widthCm - b.widthCm);
}

/** Ailede bu genişlikteki ürün; yoksa null (ör. 50 cm duvara raf yok). */
export function resolveWidthVariantItemKey(itemOrKey, widthCm) {
  const width = Number(widthCm);
  if (!Number.isFinite(width)) return null;
  return listWidthVariants(itemOrKey).find((variant) => Math.abs(variant.widthCm - width) < 0.001)?.itemKey ?? null;
}

/**
 * Raf sırası: sıralı raf reçetesindeki tekli raf (`shelf` tipli alt Item) ve adedi.
 * Tekli rafın kendisi 1 sıradır. Sayı reçeteden gelir; Item'da ayrı sıra kolonu yoktur.
 */
export function resolveShelfRows(itemOrKey) {
  const item = typeof itemOrKey === 'string' ? getItem(itemOrKey) : itemOrKey;
  if (item?.type !== 'shelf') return null;
  let count = 1;
  let rowItem = item;
  const visited = new Set();
  while (rowItem.composition?.mode === 'recipe') {
    if (visited.has(rowItem.itemKey)) throw new TypeError(`Cyclic shelf recipe: ${item.itemKey}`);
    visited.add(rowItem.itemKey);
    const row = (rowItem.composition.items ?? []).find((entry) => (
      getItem(entry?.itemKey)?.type === 'shelf'
      && Number.isInteger(Number(entry.quantity)) && Number(entry.quantity) > 0
    ));
    if (!row) break;
    count *= Number(row.quantity);
    rowItem = getItem(row.itemKey);
  }
  return { count, rowItem };
}

const EMBEDDED_RENDER_PART_TYPES = new Set([
  'panel',
  'separator-panel',
  'base-top',
  'counter-top',
  'connector',
  'showcase-board',
  'showcase-accessory',
  'video-wall-panel',
]);

/** Reçetedeki gömülü isRender parçalar (adet kadar). Kataloga bakmaz. Yerleşim modülü (profil, dikme) ayrı. */
export function listEmbeddedRenderParts(parentItem) {
  const rows = parentItem?.composition?.mode === 'recipe' ? parentItem.composition.items : null;
  if (!Array.isArray(rows)) return [];
  const parts = [];
  for (const row of rows) {
    const child = row?.itemKey ? getItem(row.itemKey) : null;
    if (!child || child.isRender !== true) continue;
    if (!EMBEDDED_RENDER_PART_TYPES.has(child.type)) continue;
    const quantity = Math.round(Number(row.quantity));
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    for (let index = 0; index < quantity; index += 1) {
      parts.push(child);
    }
  }
  return parts;
}

/** Item master `isRender`: sistem bu SKU'yu çizer. Katalog bu kapıya girmez. */
export function itemHasSceneRender(itemOrKey) {
  const item = typeof itemOrKey === 'string' ? getItem(itemOrKey) : itemOrKey;
  return item?.isRender === true;
}

function readCm(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** Catalog drop kotu (yerden cm). Instance `placement.zCm`; tavan değil. */
/** Açık standın duvar yüksekliği (cm); kısa duvar bu tepeye hizalanır. Stand yokken 350. */
let activeWallLineHeightCm = CATALOG_WALL_LINE_HEIGHT_CM;

export function setActiveWallLineHeightCm(heightCm) {
  const value = Number(heightCm);
  activeWallLineHeightCm = WALL_LINE_HEIGHTS_CM.includes(value) ? value : CATALOG_WALL_LINE_HEIGHT_CM;
  setStandWallLineHeightCm(activeWallLineHeightCm);
}

export function getActiveWallLineHeightCm() {
  return activeWallLineHeightCm;
}

export function resolveItemDefaultZCm(itemOrKey) {
  const item = typeof itemOrKey === 'string' ? getItem(itemOrKey) : itemOrKey;
  const defaultZCm = readCm(item?.defaultZCm) ?? readCm(item?.dimensions?.mountHeightCm) ?? 0;
  // Kısa duvarın DB tabanı 350 cm duvar tepesine göredir (short_2 250, short_1 300); duvar
  // yüksekliği farklıysa aynı farkla iner/çıkar (250'de 150 / 200).
  if (isWallShortFamilyDescriptor(item) && readCm(item?.defaultZCm) != null) {
    return defaultZCm + (activeWallLineHeightCm - CATALOG_WALL_LINE_HEIGHT_CM);
  }
  return defaultZCm;
}

export const SNAP_FACES = Object.freeze(['front', 'back', 'top', 'bottom', 'left', 'right']);
export const SNAP_EDGES = Object.freeze(['top', 'bottom', 'left', 'right']);

/** Driven item: rule id (+ key). Face/edge come from snap rule registry. */
export function getItemSnapSpec(itemOrKey) {
  const item = typeof itemOrKey === 'string'
    ? getItem(itemOrKey)
    : (itemOrKey?.itemKey ? getItem(itemOrKey.itemKey) ?? itemOrKey : itemOrKey);
  const requiresRuleId = Number.isFinite(Number(item?.snapRequiresRuleId))
    ? Number(item.snapRequiresRuleId)
    : null;
  const requires = typeof item?.snapRequires === 'string' ? item.snapRequires.trim() : '';
  if (!requiresRuleId && !requires) return null;
  const rule = getSnapRule(requiresRuleId) ?? getSnapRule(requires);
  return Object.freeze({
    requiresRuleId: requiresRuleId ?? (rule?.id != null ? Number(rule.id) : null),
    requires: requires || rule?.key || null,
    face: typeof rule?.face === 'string' ? rule.face : null,
    edge: typeof rule?.edge === 'string' ? rule.edge : null,
  });
}

export function itemProvidesSnapRule(itemOrKey, specOrRuleId) {
  const item = typeof itemOrKey === 'string' ? getItem(itemOrKey) : itemOrKey;
  if (!item) return false;

  const matches = (rule) => {
    if (!rule) return false;
    if (item.snapProvidesRuleId != null && Number(item.snapProvidesRuleId) === Number(rule.id)) {
      return true;
    }
    if (item.snapProvides && item.snapProvides === rule.key) return true;
    // Kural ↔ item_type M:N → o tipteki tüm item’lar provides (33 profile tek tek bağlanmaz)
    return itemTypeProvidesRule(item, rule);
  };

  if (specOrRuleId && typeof specOrRuleId === 'object') {
    const rule =
      getSnapRule(specOrRuleId.requiresRuleId) ?? getSnapRule(specOrRuleId.requires);
    return matches(rule);
  }
  if (specOrRuleId == null) return false;
  return matches(getSnapRule(specOrRuleId));
}

export function itemProvidesSnapCapability(itemOrKey, capability) {
  const item = typeof itemOrKey === 'string' ? getItem(itemOrKey) : itemOrKey;
  return Boolean(capability && item?.snapProvides === capability);
}

/** Overlay mouse Z ezer. Snap spec varsa placement.zCm (motor) kalır. Yoksa instance / defaultZCm. */
export function applyItemPlacementZCm(moduleState, placement, { overlayZCm = null } = {}) {
  if (!placement) return placement;
  const overlay = readCm(overlayZCm);
  if (overlay != null) return { ...placement, zCm: overlay };
  if (getItemSnapSpec(moduleState) && readCm(placement.zCm) != null) {
    return { ...placement, zCm: readCm(placement.zCm) };
  }
  const existing = readCm(moduleState?.placement?.zCm);
  if (moduleState?.placement && existing != null) return { ...placement, zCm: existing };
  return { ...placement, zCm: resolveItemDefaultZCm(moduleState?.itemKey ?? moduleState) };
}

export function isWallShortFamilyDescriptor(descriptor) {
  const variant = descriptor?.variant ?? getItem(descriptor?.itemKey)?.variant;
  return variant === 'wall-short-1' || variant === 'wall-short-2';
}

export function listRegisteredItems() {
  return Object.freeze(Object.values(requireRegistry()));
}

/**
 * Otomatik duvar / widthCm-only flat-panel seçimi: Item registry (DB bootstrap).
 * Katalogda görünen, render’lı, wall-short ailesi olmayan flat-panel; ölçü = widthCm.
 * Explicit itemKey yolu bunu kullanmaz.
 */
export function resolveAutomaticWallFlatPanelItemKey(
  widthCm,
  lineHeightCm = CATALOG_WALL_LINE_HEIGHT_CM,
) {
  const width = Number(widthCm);
  if (!Number.isFinite(width) || width <= 0) return null;
  const canonicalKey = catalogWallFlatPanelItemKey(width, lineHeightCm);
  if (getItem(canonicalKey)) return canonicalKey;
  const matches = listRegisteredItems()
    .filter((item) => {
      if (item?.type !== 'flat-panel') return false;
      if (item.isRender !== true) return false;
      if (item.catalogVisible !== true) return false;
      if (isWallShortFamilyDescriptor(item)) return false;
      return Number(item.dimensions?.widthCm) === width;
    })
    .map((item) => item.itemKey)
    .sort();
  return matches[0] ?? null;
}

function optionalNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export const SCENE_DIMENSION_FIELDS = Object.freeze([
  'widthCm',
  'depthCm',
  'heightCm',
]);

function readDimensionField(layer, field) {
  if (!layer || typeof layer !== 'object') return null;
  return optionalNumber(layer[field]);
}

// Scene/runtime ölçü: aynı field adı için sceneDimensions ?? dimensions ?? MISSING.
// length→width, thickness→depth, Recipe/Catalog/type/itemKey/STAND çapraz remap yoktur.
export function resolveSceneDimensions(item) {
  const resolved = {};
  for (const field of SCENE_DIMENSION_FIELDS) {
    resolved[field] = readDimensionField(item?.sceneDimensions, field)
      ?? readDimensionField(item?.dimensions, field)
      ?? null;
  }
  return Object.freeze(resolved);
}

export function requireSceneDimension(item, field) {
  const value = resolveSceneDimensions(item)[field];
  if (value == null) {
    throw new TypeError(`Item ${item?.itemKey ?? 'unknown'} is missing scene dimension ${field}.`);
  }
  return value;
}

/** Duvar tavanı (fair_stand_dimensions.height_cm); modül H bu değeri geçemez. */
export function clampHeightToStandCeilingCm(heightCm) {
  const value = Number(heightCm);
  if (!Number.isFinite(value) || value <= 0) return value;
  const ceilingCm = Number(getStandDimensions().heightCm);
  if (!Number.isFinite(ceilingCm) || ceilingCm <= 0) return value;
  return Math.min(value, ceilingCm);
}

function readModuleSceneFieldCm(moduleState, field, scene) {
  const fromState = moduleState?.[field];
  if (fromState != null && Number.isFinite(Number(fromState)) && Number(fromState) > 0) {
    return Number(fromState);
  }
  const fromScene = scene?.[field];
  if (fromScene != null && Number.isFinite(Number(fromScene)) && Number(fromScene) > 0) {
    return Number(fromScene);
  }
  return null;
}

/**
 * Modül W/H/D: state override → resolveSceneDimensions(item).
 * clampToStandCeiling: heightCm tavanla sınırlanır (varsayılan true).
 */
export function resolveModuleSceneBoxCm(moduleState, { clampToStandCeiling = true } = {}) {
  const item = moduleState?.itemKey ? getItem(moduleState.itemKey) : null;
  const scene = item ? resolveSceneDimensions(item) : Object.freeze({});
  const widthCm = readModuleSceneFieldCm(moduleState, 'widthCm', scene);
  let heightCm = readModuleSceneFieldCm(moduleState, 'heightCm', scene);
  const depthCm = readModuleSceneFieldCm(moduleState, 'depthCm', scene);
  if (clampToStandCeiling && heightCm != null) {
    heightCm = clampHeightToStandCeilingCm(heightCm);
  }
  return Object.freeze({ widthCm, heightCm, depthCm, item, scene });
}

function firstRecipeChildItem(parentItem, type) {
  const rows = parentItem?.composition?.mode === 'recipe' ? parentItem.composition.items : null;
  if (!Array.isArray(rows)) return null;
  for (const row of rows) {
    const childKey = row?.itemKey ?? null;
    const child = childKey ? getItem(childKey) : null;
    if (child?.type === type) {
      return child;
    }
  }
  return null;
}

function crossSectionCmFromFrameItem(frameItem) {
  const scene = resolveSceneDimensions(frameItem);
  let frameWidthCm;
  let frameDepthCm;
  if (frameItem.type === 'upright') {
    frameWidthCm = scene.widthCm;
    frameDepthCm = scene.depthCm;
  } else if (frameItem.type === 'profile') {
    // Profilde widthCm = duvar span; kesit depth×height (createProfileModule ile aynı).
    frameWidthCm = scene.depthCm;
    frameDepthCm = scene.heightCm;
  } else {
    throw new TypeError(`Unsupported frame cross-section item type: ${frameItem.type}.`);
  }
  if (frameWidthCm == null || frameDepthCm == null) {
    throw new TypeError(
      `Item ${frameItem.itemKey} is missing cross-section dimensions for procedural frame.`,
    );
  }
  return Object.freeze({ frameWidthCm, frameDepthCm, frameItemKey: frameItem.itemKey });
}

/**
 * Prosedürel aluminyum kesiti: modül reçetesindeki profil Item'ının sahne kesiti
 * (`fair_stand_item_scene_dimensions` depth × height). Dört çerçeve kenarı (dikmeler dahil) bu
 * kesitle çizilir; stand `frame_width_cm` sahne kesitine girmez. Reçetesinde profil olmayan
 * modülde kesit kare kutudur: genişlik = derinlik = stand `frame_depth_cm`.
 */
export function resolveProceduralFrameCrossSectionCm(moduleState) {
  const profileItem = firstRecipeChildItem(getItem(moduleState?.itemKey), 'profile');
  if (profileItem) {
    return Object.freeze({ ...crossSectionCmFromFrameItem(profileItem), source: 'recipe-profile-scene' });
  }
  const stand = getStandDimensions();
  return Object.freeze({
    frameWidthCm: stand.frameDepthCm,
    frameDepthCm: stand.frameDepthCm,
    frameItemKey: null,
    source: 'stand-dimensions',
  });
}

/** Reçetedeki panel Item'ının kalınlığı (`dimensions.depthCm`); reçetede panel yoksa null. */
export function resolveRecipePanelThicknessCm(moduleState) {
  const panelItem = firstRecipeChildItem(getItem(moduleState?.itemKey), 'panel');
  const thicknessCm = Number(panelItem?.dimensions?.depthCm);
  return Number.isFinite(thicknessCm) && thicknessCm > 0 ? thicknessCm : null;
}

export function getProceduralFrameCrossSectionM(moduleState) {
  const { frameWidthCm, frameDepthCm } = resolveProceduralFrameCrossSectionCm(moduleState);
  return Object.freeze({
    frameWidthCm,
    frameDepthCm,
    frameWidth: frameWidthCm / 100,
    frameDepth: frameDepthCm / 100,
  });
}

export function requireModuleSceneBoxCm(
  moduleState,
  requiredFields = SCENE_DIMENSION_FIELDS,
  options,
) {
  const box = resolveModuleSceneBoxCm(moduleState, options);
  const missing = requiredFields.filter((field) => box[field] == null);
  if (missing.length > 0) {
    throw new TypeError(
      `Item ${moduleState?.itemKey ?? 'unknown'} is missing scene dimensions: ${missing.join(', ')}.`,
    );
  }
  return box;
}

// Catalog projection'ı taklit etmez; Item master + resolveSceneDimensions okur.
// Item identity çözümlemesi Catalog üyeliğine bağlı değildir.
// Item kimliği yalnız kayıtlı itemKey'dir; type/ölçü/shape/modelFile tahmini yoktur.
export function resolveItemKey(descriptor) {
  const itemKey = typeof descriptor === 'string'
    ? descriptor
    : (descriptor?.itemKey ?? descriptor?.moduleState?.itemKey ?? null);
  return itemKey && getItem(itemKey) ? itemKey : null;
}
