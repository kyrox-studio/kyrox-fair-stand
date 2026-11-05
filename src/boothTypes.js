// Stand tipi (`boothType`): standın hangi sistemle kurulduğu. `standType` ise yerleşimdir
// (Sırt Duvar / L / U / Ada) ve ondan bağımsızdır. Liste bootstrap'tan gelir; kayıtta
// `stand.boothType` olarak durur, bu alanı taşımayan eski projeler Maksima sayılır.

export const DEFAULT_BOOTH_TYPE = 'maxima';

let boothTypes = Object.freeze([]);

export function initializeBoothTypes(rows) {
  if (!Array.isArray(rows)) {
    throw new TypeError('Fair Stand booth types bootstrap must be an array.');
  }
  boothTypes = Object.freeze(rows.map((row) => Object.freeze({
    key: row.key,
    name: row.name,
    active: row.active === true,
  })));
}

export function listBoothTypes() {
  return boothTypes;
}

export function isKnownBoothType(key) {
  return boothTypes.some((type) => type.key === key);
}

export function normalizeBoothType(key) {
  return isKnownBoothType(key) ? key : DEFAULT_BOOTH_TYPE;
}

export function getBoothTypeHeading(key) {
  return `${getBoothTypeLabel(key)} Yapılandırması`;
}

export function getBoothTypeLabel(key) {
  const normalized = normalizeBoothType(key);
  return boothTypes.find((type) => type.key === normalized)?.name ?? '';
}
