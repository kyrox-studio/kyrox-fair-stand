export const GLASS_APPEARANCE = Object.freeze({
  color: 0xd7e9ed,
  opacity: 0.48,
  roughness: 0.16,
  metalness: 0,
  transparent: true,
  depthWrite: false,
});

export const TABLE_GLASS_APPEARANCE = Object.freeze({
  ...GLASS_APPEARANCE,
  opacity: 0.42,
  roughness: 0.10,
  clearcoat: 0.65,
});

// Cam masanın kırılma (transmission) değeri yalnız Render Al'da açılır: editörde tek bir
// transmission malzemesi bile sahneyi her karede ikinci kez çizdirir.
export const TABLE_GLASS_RENDER_TRANSMISSION = 0.32;

// Masa ayağı / tabanı ve orta sehpa gövdesi: açık alüminyum görünümü (siyah değil).
export const FURNITURE_ALUMINIUM_APPEARANCE = Object.freeze({
  color: 0xc9cdd2,
  roughness: 0.32,
  metalness: 0.85,
});

export const PANEL_GLASS_BACKING_APPEARANCE = Object.freeze({
  color: 0xc9dce1,
  opacity: 0.18,
  roughness: 0.22,
  metalness: 0,
  transparent: true,
  depthWrite: false,
});

const MATERIAL_APPEARANCE_BY_MATERIAL = Object.freeze({
  cam: GLASS_APPEARANCE,
});

export function getMaterialAppearance(material) {
  return MATERIAL_APPEARANCE_BY_MATERIAL[material] ?? null;
}
