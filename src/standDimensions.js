// Stand zarfı runtime kaydı. Kaynak fair_stand_dimensions (catalog bootstrap), birim: cm.
// Three.js sahnesi metre kullanır; STAND_DIMENSIONS.height / depth / … getter'ları m döner.

let standDimensions = null;

const REQUIRED_CM_FIELDS = Object.freeze([
  'heightCm',
  'depthCm',
  'frameWidthCm',
  'frameDepthCm',
  'panelRailHeightCm',
]);

function requirePositiveNumber(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new TypeError(`Fair Stand dimensions.${field} must be a positive number.`);
  }
  return number;
}

function cmToMeters(cm) {
  return Number(cm) / 100;
}

export function initializeStandDimensions(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new TypeError('Fair Stand dimensions bootstrap payload is invalid.');
  }
  const next = {};
  for (const field of REQUIRED_CM_FIELDS) {
    next[field] = requirePositiveNumber(raw[field], field);
  }
  standDimensions = Object.freeze(next);
}

export function resetStandDimensions() {
  standDimensions = null;
}

// Açık standın duvar yüksekliği (cm). DB tavanından yüksekse (450 / 500 cm stand) tavan odur;
// yoksa ayırıcı, kısa duvar gibi modüller DB tavanına kırpılır.
let wallLineHeightCm = null;
let raisedDimensions = null;

export function setStandWallLineHeightCm(heightCm) {
  const value = Number(heightCm);
  wallLineHeightCm = Number.isFinite(value) && value > 0 ? value : null;
  raisedDimensions = null;
}

export function getStandDimensions() {
  if (!standDimensions) {
    throw new Error('Fair Stand dimensions are not bootstrapped.');
  }
  if (wallLineHeightCm && wallLineHeightCm > standDimensions.heightCm) {
    if (raisedDimensions?.heightCm !== wallLineHeightCm) {
      raisedDimensions = Object.freeze({ ...standDimensions, heightCm: wallLineHeightCm });
    }
    return raisedDimensions;
  }
  return standDimensions;
}

export const STAND_DIMENSIONS = Object.freeze({
  get heightCm() {
    return getStandDimensions().heightCm;
  },
  get depthCm() {
    return getStandDimensions().depthCm;
  },
  get frameWidthCm() {
    return getStandDimensions().frameWidthCm;
  },
  get frameDepthCm() {
    return getStandDimensions().frameDepthCm;
  },
  get panelRailHeightCm() {
    return getStandDimensions().panelRailHeightCm;
  },
  /** Three.js / sahne zarfı (metre). */
  get height() {
    return cmToMeters(getStandDimensions().heightCm);
  },
  get depth() {
    return cmToMeters(getStandDimensions().depthCm);
  },
  get frameWidth() {
    return cmToMeters(getStandDimensions().frameWidthCm);
  },
  get frameDepth() {
    return cmToMeters(getStandDimensions().frameDepthCm);
  },
  /** İki panel arası ray boşluğu (metre). */
  get panelRailHeight() {
    return cmToMeters(getStandDimensions().panelRailHeightCm);
  },
});

export const MODULE_WIDTHS_CM = Object.freeze([50, 100, 150, 200]);
