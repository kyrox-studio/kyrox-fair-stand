// Duvar yüksekliği BOM kontrol projesi (her yükseklik için aynı yerleşim, L stand 600 × 400).
// Sol: 2 × wall_200 (yan yana) — sırtla köşe. Sırt: wall_200, kapı, 2 gözlü vitrin, wall_100,
// sarmaşıklı 50 ayırıcı, 50 ayırıcı (5 yan yana). T: sırttaki wall_200 ortasından 100 ayırıcı.
import { createModuleStateFromCatalogKey } from '../src/designState.js';
import { resolveWallItemKeyForHeight } from '../src/items.js';
import { createModulePlacement } from '../src/modulePlacement.js';

export const WALL_HEIGHT_PROJECT_LAYOUT = Object.freeze([
  ['left-1', 'wall_200_350', { xCm: 0, yCm: 200, rotationZDeg: 90, wallId: 'left' }],
  ['left-2', 'wall_200_350', { xCm: 0, yCm: 0, rotationZDeg: 90, wallId: 'left' }],
  ['back-wall-200', 'wall_200_350', { xCm: 0, yCm: 0, rotationZDeg: 0, wallId: 'back' }],
  ['back-door', 'wall_door_100_350', { xCm: 200, yCm: 0, rotationZDeg: 0, wallId: 'back' }],
  ['back-showcase-2', 'wall_showcase_100_2_350', { xCm: 300, yCm: 0, rotationZDeg: 0, wallId: 'back' }],
  ['back-wall-100', 'wall_100_350', { xCm: 400, yCm: 0, rotationZDeg: 0, wallId: 'back' }],
  ['back-separator-50-sarmasik', 'wall_separator_50_350_sarmasik', { xCm: 500, yCm: 0, rotationZDeg: 0, wallId: 'back' }],
  ['back-separator-50', 'wall_separator_50_350', { xCm: 550, yCm: 0, rotationZDeg: 0, wallId: 'back' }],
  ['tee-separator-100', 'wall_separator_100_350', { xCm: 100, yCm: 0, rotationZDeg: 270, wallId: 'free' }],
]);

export function buildWallHeightProjectModules(wallHeightCm) {
  return WALL_HEIGHT_PROJECT_LAYOUT.map(([id, catalogKey, placement]) => {
    const state = createModuleStateFromCatalogKey(resolveWallItemKeyForHeight(catalogKey, wallHeightCm));
    if (!state) throw new Error(`Modül oluşturulamadı: ${catalogKey} @ ${wallHeightCm}`);
    state.id = `module-test-${wallHeightCm}-${id}`;
    state.placement = createModulePlacement({ ...placement });
    return state;
  });
}

export function buildWallHeightProjectStand(wallHeightCm) {
  return {
    ok: true,
    xCm: 600,
    yCm: 400,
    depot: { enabled: false, sizeKey: null, includeContents: false },
    depthM: 4,
    widthM: 6,
    itemKey: 'karolaj',
    standType: 'l-left',
    sceneDepthM: 6,
    sceneWidthM: 8,
    wallHeightCm,
  };
}
