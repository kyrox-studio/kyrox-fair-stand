// Özellik paneli için seçili yüzeylerin ortak özeti. Yetenek, sahnenin yüzeye yazdığı
// accepts* bayraklarından okunur (Item adı / model dosyası kaynak değildir).
// Renk ve görselde mevcut uygulama kuralı: bayrak açıkça false değilse kabul eder.
// Cam / Lightbox / Mesh: yalnız açıkça true olan yüzey kabul eder.

const SUPPORT_RULES = {
  color: (userData) => userData.acceptsColor !== false,
  image: (userData) => userData.acceptsImage !== false,
  glass: (userData) => userData.acceptsGlass === true,
  lightbox: (userData) => userData.acceptsLightbox === true,
  mesh: (userData) => userData.acceptsMesh === true,
};

// 'all' | 'some' | 'none'
function supportLevel(list, accepts) {
  const count = list.filter(accepts).length;
  if (!list.length || count === 0) return 'none';
  return count === list.length ? 'all' : 'some';
}

// Tüm değerler aynıysa o değer; farklıysa MIXED.
export const MIXED = Symbol('mixed');
function commonValue(values) {
  if (!values.length) return null;
  const [first] = values;
  return values.every((value) => value === first) ? first : MIXED;
}

export function summarizeSelectedSurfaces(surfaces = []) {
  const list = (surfaces ?? []).map((surface) => surface?.userData ?? {});
  const moduleIds = new Set(list.map((userData) => userData.moduleId).filter((id) => id != null));
  const support = Object.fromEntries(
    Object.entries(SUPPORT_RULES).map(([key, accepts]) => [key, supportLevel(list, accepts)]),
  );
  const colorTargets = list.filter(SUPPORT_RULES.color);
  const glassTargets = list.filter(SUPPORT_RULES.glass);
  return {
    count: list.length,
    moduleCount: moduleIds.size,
    support,
    color: commonValue(colorTargets.map((userData) => String(userData.surfaceState?.color ?? '#ffffff').toLowerCase())),
    imageAssetId: commonValue(list.filter(SUPPORT_RULES.image).map((userData) => (
      userData.surfaceState?.fabricGroupId
        ? (userData.surfaceState?.fabricImageAssetId ?? null)
        : (userData.surfaceState?.imageAssetId ?? null)
    ))),
    isGlass: commonValue(glassTargets.map((userData) => Boolean(userData.surfaceState?.isGlass))),
    isMetalSeparator: commonValue(glassTargets.map((userData) => Boolean(userData.surfaceState?.isMetalSeparator))),
  };
}

// Toplu işlem yalnız bütün seçim kabul ediyorsa açılır; kısmi destekte gerekçe döner.
export function describePartialSupport(summary, key, label) {
  if (!summary || summary.count < 2 || summary.support[key] !== 'some') return null;
  return `Seçimdeki panellerin bir kısmı ${label} desteklemiyor; tek tek seçin.`;
}
