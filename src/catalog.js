import { getItem, listRegisteredItems, resolveItemKey } from './items.js';
import { isCatalogWidthFamilyDescriptor } from './catalogWidthFamily.js';

let catalogCategories = Object.freeze([]);
let catalogPreviews = Object.freeze([]);

function toCategoryId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function toPreviewId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function initializeCatalogCategories(categories) {
  if (!Array.isArray(categories)) {
    throw new TypeError('Fair Stand Category catalog bootstrap categories must be an array.');
  }
  catalogCategories = Object.freeze(
    categories.map((category) => {
      const id = toCategoryId(category.id);
      if (id == null) {
        throw new TypeError('Fair Stand Category bootstrap row is missing integer id.');
      }
      return Object.freeze({
        id,
        catalogName: category.catalogName,
        catalogIndex: category.catalogIndex,
      });
    }),
  );
}

export function initializeCatalogPreviews(previews) {
  if (!Array.isArray(previews)) {
    throw new TypeError('Fair Stand Catalog preview bootstrap preview kinds must be an array.');
  }
  catalogPreviews = Object.freeze(
    previews.map((preview) => {
      const id = toPreviewId(preview.id);
      if (id == null) {
        throw new TypeError('Fair Stand Catalog preview bootstrap row is missing integer id.');
      }
      return Object.freeze({
        id,
        displayName: preview.displayName,
        markup: preview.markup,
        cssCode: preview.cssCode ?? '',
        sortIndex: Number(preview.sortIndex ?? 0),
        isActive: preview.isActive !== false,
      });
    }),
  );
}

export function getCatalogPreview(previewId) {
  const id = toPreviewId(previewId);
  return catalogPreviews.find((preview) => preview.id === id) ?? null;
}

export function listCatalogPreviewIds() {
  return catalogPreviews.map((preview) => preview.id);
}

export function listCatalogCategories() {
  return Object.freeze(
    [...catalogCategories].sort((left, right) => left.catalogIndex - right.catalogIndex),
  );
}

export function getCatalogCategory(categoryId) {
  const id = toCategoryId(categoryId);
  return catalogCategories.find((category) => category.id === id) ?? null;
}

function projectCatalogItem(item) {
  const previewId = toPreviewId(item.previewId);
  if (previewId == null) {
    throw new TypeError(`Item ${item.itemKey} is catalogVisible without previewId.`);
  }
  if (!listCatalogPreviewIds().includes(previewId)) {
    throw new TypeError(`Item ${item.itemKey} has unknown previewId: ${item.previewId}.`);
  }

  return Object.freeze({
    itemKey: item.itemKey,
    label: catalogCardLabel(item),
    previewId,
  });
}

// Bırakılırken ölçü soran kartlar (profil boyu, dikme boyu, panel / kısa panel / separatör genişliği)
// tek bir ölçünün kartı gibi görünmez: başlık Item adının sonundaki ölçüyü yazmaz ("Profil 289" →
// "Profil", "Panel 100" → "Panel", "Panel Tek Sıra 100" → "Panel Tek Sıra"). Sahnedeki parça, sağ tık ve BOM Item adını kullanır.
function catalogCardLabel(item) {
  const asksSize = item.type === 'profile' || item.type === 'upright' || isCatalogWidthFamilyDescriptor(item);
  if (!asksSize) return item.name;
  // "Köşe Banko 200×200" gibi iki ölçülü ad da ölçüsüz başlığa iner ("Köşe Banko").
  return String(item.name).replace(/\s+\d+(?:[.,]\d+)?(?:\s*[×x]\s*\d+(?:[.,]\d+)?)?$/, '') || item.name;
}

export function getCatalogItem(itemKey) {
  const item = getItem(itemKey);
  if (!item || item.catalogVisible !== true) return null;
  return projectCatalogItem(item);
}

export function listCatalogItems() {
  return Object.freeze(
    listRegisteredItems()
      .filter((item) => item.catalogVisible === true)
      .sort((left, right) => {
        const leftCategory = getCatalogCategory(left.categoryId);
        const rightCategory = getCatalogCategory(right.categoryId);
        const categoryDelta = (leftCategory?.catalogIndex ?? 0) - (rightCategory?.catalogIndex ?? 0);
        if (categoryDelta !== 0) return categoryDelta;
        return Number(left.catalogItemIndex) - Number(right.catalogItemIndex);
      })
      .map(projectCatalogItem),
  );
}

export function listCatalogGroups() {
  const categories = listCatalogCategories();
  const membersById = new Map(categories.map((category) => [category.id, []]));

  for (const item of listRegisteredItems()) {
    if (item.catalogVisible !== true) continue;
    const bucket = membersById.get(toCategoryId(item.categoryId));
    if (!bucket) {
      throw new TypeError(
        `Item ${item.itemKey} categoryId is not a catalog category id: ${item.categoryId}.`,
      );
    }
    bucket.push(item);
  }

  return Object.freeze(categories.map((category) => {
    const members = [...membersById.get(category.id)]
      .sort((left, right) => left.catalogItemIndex - right.catalogItemIndex);
    return Object.freeze({
      id: category.id,
      catalogName: category.catalogName,
      catalogIndex: category.catalogIndex,
      label: category.catalogName,
      keys: Object.freeze(members.map((item) => item.itemKey)),
    });
  }));
}

export function getModuleCatalogItem(descriptor) {
  const moduleKey = resolveItemKey(descriptor);
  return moduleKey ? getCatalogItem(moduleKey) : null;
}

export function getModuleCatalogLabel(descriptor) {
  // Sahnedeki parça Item adını taşır ("Profil 289"); kart başlığı ölçüsüz olabilir ("Profil").
  const moduleKey = resolveItemKey(descriptor);
  return (moduleKey ? getItem(moduleKey)?.name : null)
    ?? getModuleCatalogItem(descriptor)?.label
    ?? (typeof descriptor?.label === 'string' ? descriptor.label : null)
    ?? 'Modül';
}
