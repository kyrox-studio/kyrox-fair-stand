import { SCENE_SURROUND_M } from './sceneDimensions.js';

export const MIN_STAND_DIMENSION_CM = 50;
export const MAX_STAND_DIMENSION_CM = 5000;
export const STAND_DIMENSION_STEP_CM = 50;

export const STAND_TYPE_LABELS = Object.freeze({
  'back-wall': 'Sırt Duvar',
  'l-left': 'L Stand Sol',
  'l-right': 'L Stand Sağ',
  'u-stand': 'U Stand',
  island: 'Ada Stand',
});

export const STAND_TYPES = Object.freeze(Object.keys(STAND_TYPE_LABELS));

export function validateStandSetup({ standType, xCm, yCm } = {}) {
  if (!STAND_TYPES.includes(standType)) {
    return { ok: false, message: 'Önce yerleşimi seç.' };
  }

  if (String(xCm ?? '').trim() === '' || String(yCm ?? '').trim() === '') {
    return { ok: false, message: 'Sahne için X ve Y ölçülerinin ikisini de gir.' };
  }

  const normalizedXCm = Number(xCm);
  const normalizedYCm = Number(yCm);

  if (
    !Number.isFinite(normalizedXCm)
    || !Number.isFinite(normalizedYCm)
    || normalizedXCm < MIN_STAND_DIMENSION_CM
    || normalizedYCm < MIN_STAND_DIMENSION_CM
  ) {
    return {
      ok: false,
      message: `X ve Y ölçüleri en az ${MIN_STAND_DIMENSION_CM} cm olmalı.`,
    };
  }

  if (normalizedXCm > MAX_STAND_DIMENSION_CM || normalizedYCm > MAX_STAND_DIMENSION_CM) {
    return {
      ok: false,
      message: `Maksimum stand alanı ${MAX_STAND_DIMENSION_CM} × ${MAX_STAND_DIMENSION_CM} cm olabilir.`,
    };
  }

  if (
    normalizedXCm % STAND_DIMENSION_STEP_CM !== 0
    || normalizedYCm % STAND_DIMENSION_STEP_CM !== 0
  ) {
    return {
      ok: false,
      message: `X ve Y ölçüleri ${STAND_DIMENSION_STEP_CM} cm ve katları olmalı.`,
    };
  }

  const widthM = normalizedXCm / 100;
  const depthM = normalizedYCm / 100;

  return {
    ok: true,
    standType,
    xCm: normalizedXCm,
    yCm: normalizedYCm,
    widthM,
    depthM,
    sceneWidthM: widthM + SCENE_SURROUND_M * 2,
    sceneDepthM: depthM + SCENE_SURROUND_M * 2,
  };
}
