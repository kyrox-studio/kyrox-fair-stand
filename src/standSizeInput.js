import { validateStandSetup, STAND_TYPES, MIN_STAND_DIMENSION_CM, MAX_STAND_DIMENSION_CM, STAND_DIMENSION_STEP_CM } from './standSetup.js';

// Metre yalnız giriş/gösterim birimidir; proje ve yerleşim cm kullanır.
export function metersInputToCm(value) {
  const normalized = String(value ?? '').trim().replace(',', '.');
  return normalized ? Number(normalized) * 100 : null;
}
export function formatMeters(valueCm) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(Number(valueCm) / 100);
}
export function validateStandSetupMeters({ standType, width, depth }) {
  const result = validateStandSetup({ standType, xCm: metersInputToCm(width), yCm: metersInputToCm(depth) });
  if (!result.ok && STAND_TYPES.includes(standType)) {
    return { ...result, message: 'Genişlik ve derinliği ' + formatMeters(STAND_DIMENSION_STEP_CM) + ' m adımlarla, '
      + formatMeters(MIN_STAND_DIMENSION_CM) + '–' + formatMeters(MAX_STAND_DIMENSION_CM) + ' m aralığında gir.' };
  }
  return result;
}
