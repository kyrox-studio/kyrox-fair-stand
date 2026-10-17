const IMAGE_ASSET_REFERENCE_KEYS = new Set(['imageAssetId', 'fabricImageAssetId']);

function walkImageAssetReferences(value, assetId, visitor) {
  if (!assetId || value == null || typeof value !== 'object') return;

  if (Array.isArray(value)) {
    value.forEach((item) => walkImageAssetReferences(item, assetId, visitor));
    return;
  }

  Object.entries(value).forEach(([key, item]) => {
    if (IMAGE_ASSET_REFERENCE_KEYS.has(key) && item === assetId) {
      visitor(value, key);
      return;
    }
    walkImageAssetReferences(item, assetId, visitor);
  });
}

export function remapImageAssetReferences(value, idMap) {
  if (Array.isArray(value)) return value.map((item) => remapImageAssetReferences(item, idMap));
  if (!value || typeof value !== 'object') return value;

  const output = {};
  Object.entries(value).forEach(([key, item]) => {
    if (IMAGE_ASSET_REFERENCE_KEYS.has(key) && typeof item === 'string' && idMap.has(item)) {
      output[key] = idMap.get(item);
      return;
    }
    output[key] = remapImageAssetReferences(item, idMap);
  });
  return output;
}


export function collectImageAssetReferenceIds(value, ids = new Set()) {
  if (value == null || typeof value !== 'object') return ids;
  if (Array.isArray(value)) {
    value.forEach((item) => collectImageAssetReferenceIds(item, ids));
    return ids;
  }
  Object.entries(value).forEach(([key, item]) => {
    if (IMAGE_ASSET_REFERENCE_KEYS.has(key)) {
      if (typeof item === 'string' && item) ids.add(item);
      return;
    }
    collectImageAssetReferenceIds(item, ids);
  });
  return ids;
}

export function countImageAssetReferences(value, assetId) {
  let count = 0;
  walkImageAssetReferences(value, assetId, () => { count += 1; });
  return count;
}

export function clearImageAssetReferences(value, assetId) {
  let count = 0;
  walkImageAssetReferences(value, assetId, (owner, key) => {
    owner[key] = null;
    if (key === 'fabricImageAssetId') owner.fabricImageFit = 'cover';
    count += 1;
  });
  return count;
}
