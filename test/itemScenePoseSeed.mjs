const CATALOG_CEILING_CM = 350;
const WALL_SHORT_HEIGHT_CM = Object.freeze({
  'wall-short-1': 50,
  'wall-short-2': 100,
});

// Eski göçlerin sahne pozu yalnız DB'de boş kalan alanı doldurur: test kataloğu DB'den gelir
// (`scripts/export-test-catalog.py`) ve backend sahne ölçüsünü olduğu gibi verir (2026-11-20).
export function applyItemScenePose(item, { hasDefaultZ = false } = {}) {
  if (item.type === 'profile') {
    const crossSection = item.sceneDimensions?.heightCm
      ?? item.dimensions?.heightCm
      ?? item.dimensions?.depthCm
      ?? item.sceneDimensions?.depthCm
      ?? 8;
    item.sceneDimensions = { ...(item.sceneDimensions ?? {}), heightCm: crossSection };
    if (!hasDefaultZ) item.defaultZCm = CATALOG_CEILING_CM - crossSection;
  }
  if (item.type === 'upright') {
    const crossSection = item.dimensions?.widthCm
      ?? item.dimensions?.depthCm
      ?? item.sceneDimensions?.depthCm
      ?? 8;
    const height = item.dimensions?.heightCm;
    const scene = { ...(item.sceneDimensions ?? {}) };
    if (scene.widthCm == null) scene.widthCm = crossSection;
    if (scene.depthCm == null) scene.depthCm = item.dimensions?.depthCm ?? crossSection;
    if (scene.heightCm == null && height != null) scene.heightCm = height;
    item.sceneDimensions = scene;
  }
  const wallShortHeight = WALL_SHORT_HEIGHT_CM[item.variant];
  if (wallShortHeight != null) {
    const heightCm = item.sceneDimensions?.heightCm ?? wallShortHeight;
    item.sceneDimensions = { ...(item.sceneDimensions ?? {}), heightCm };
    if (!hasDefaultZ) item.defaultZCm = CATALOG_CEILING_CM - heightCm;
  }
  return item;
}
