/** Verified full-height wall panel band pitch (cm). Not stand admin `strip_height_cm`. */
export const WALL_PANEL_BAND_PITCH_CM = 50;

export function resolveWallPanelBandPitchCm() {
  return WALL_PANEL_BAND_PITCH_CM;
}

export function resolveModuleBandPitchCm(moduleState) {
  const stripCount = Array.isArray(moduleState?.strips) ? moduleState.strips.length : 0;
  const heightCm = Number(moduleState?.heightCm);
  if (stripCount > 0 && Number.isFinite(heightCm) && heightCm > 0) {
    return heightCm / stripCount;
  }
  return WALL_PANEL_BAND_PITCH_CM;
}

// Bant paneli çerçeve içindeki panel alanına (alt kenar + iç pay … üst kenar − iç pay) kırpılır;
// alan içindeki bantlar değişmez. Yalnız 3B görünümdür; strip state ve BOM bandı etkilemez.
export function fitPanelToFrameOpening(bandCenterY, bandPanelHeight, opening) {
  const bottom = Math.max(bandCenterY - bandPanelHeight / 2, opening.bottomY);
  const top = Math.min(bandCenterY + bandPanelHeight / 2, opening.topY);
  const panelHeight = Math.max(top - bottom, 0.01);
  return { centerY: bottom + panelHeight / 2, panelHeight };
}

export function listInternalSeamHeightsCm({
  stripCount,
  pitchCm,
  minCm = 0,
  maxCm = Number.POSITIVE_INFINITY,
}) {
  const count = Number(stripCount);
  const pitch = Number(pitchCm);
  if (!Number.isInteger(count) || count <= 1 || !Number.isFinite(pitch) || pitch <= 0) {
    return Object.freeze([]);
  }
  const seams = [];
  for (let index = 1; index < count; index += 1) {
    const seam = index * pitch;
    if (seam > minCm && seam < maxCm) seams.push(seam);
  }
  return Object.freeze(seams);
}

export function listFlatPanelModuleSeamHeightsCm(moduleState, occupancyRange = null) {
  const stripCount = Array.isArray(moduleState?.strips) ? moduleState.strips.length : 0;
  if (stripCount <= 1) return Object.freeze([]);
  const pitchCm = resolveModuleBandPitchCm(moduleState);
  const minCm = Number(occupancyRange?.minCm);
  const maxCm = Number(occupancyRange?.maxCm);
  return listInternalSeamHeightsCm({
    stripCount,
    pitchCm,
    minCm: Number.isFinite(minCm) ? minCm : 0,
    maxCm: Number.isFinite(maxCm) ? maxCm : Number.POSITIVE_INFINITY,
  });
}
