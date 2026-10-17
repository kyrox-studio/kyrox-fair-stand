// Otomatik kayıt süresi tercihi. Proje verisi değildir; yalnız bu tarayıcıda saklanır.
export const AUTOSAVE_MINUTE_OPTIONS = Object.freeze([0, 3, 5, 7, 10]);
export const DEFAULT_AUTOSAVE_MINUTES = 3;
export const AUTOSAVE_MINUTES_STORAGE_KEY = 'fairStand.autosaveMinutes';

export function normalizeAutosaveMinutes(value) {
  if (value === null || value === undefined || value === '') return DEFAULT_AUTOSAVE_MINUTES;
  const minutes = Number(value);
  return AUTOSAVE_MINUTE_OPTIONS.includes(minutes) ? minutes : DEFAULT_AUTOSAVE_MINUTES;
}

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readAutosaveMinutes(storage = defaultStorage()) {
  try {
    return normalizeAutosaveMinutes(storage?.getItem(AUTOSAVE_MINUTES_STORAGE_KEY));
  } catch {
    return DEFAULT_AUTOSAVE_MINUTES;
  }
}

export function writeAutosaveMinutes(value, storage = defaultStorage()) {
  const minutes = normalizeAutosaveMinutes(value);
  try {
    storage?.setItem(AUTOSAVE_MINUTES_STORAGE_KEY, String(minutes));
  } catch {
    // Depolama kapalıysa seçim yalnız bu oturumda geçerli kalır.
  }
  return minutes;
}
