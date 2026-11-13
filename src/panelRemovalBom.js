/**
 * Yüz aparatı ve kaldırılan bant paneli üretim listesinde (kullanıcı kararları 2026-11-12).
 *
 * Ön yüz panelleri ve aparatı duvar reçetesinden sayılır. Arka yüz (backStrips) ön yüzle aynı
 * kurallarla sayılır: reçetenin tekli ve başlangıç aparatı arka yüz için de yazılır (eklem
 * kuralları `relationshipBom.js`'de arka yüze de uygulanır).
 *
 * Kaldırılan her bant (ön ya da arka) için:
 * - o bandın paneli (köşe / cam dönüşümünden sonraki kimliğiyle) 1 düşer,
 * - panelin iki yanı için birer aparat düşer: yan köşe aparatı ödüyorsa köşe aparatı, değilse tekli,
 * - en alt bant (stripIndex 0) kalkarsa o yüzün 2 başlangıç aparatı düşer.
 * Hiçbir kalem sıfırın altına inmez.
 */
import { applyModuleConnectorCharge } from './relationshipBom.js';

const SIDES_PER_PANEL = 2;

export function isRemovedPanelSurface(surface) {
  return surface?.removed === true;
}

function recipeQuantity(recipeLines, itemKey) {
  return Number(recipeLines.find((line) => line.itemKey === itemKey)?.quantity) || 0;
}

function subtractPanel(lines, itemKey) {
  if (!itemKey) return lines;
  let done = false;
  return lines
    .map((line) => {
      if (done || line.itemKey !== itemKey || !(Number(line.quantity) > 0)) return line;
      done = true;
      return { ...line, quantity: Number(line.quantity) - 1 };
    })
    .filter((line) => Number(line.quantity) > 0);
}

/** Bir yüzün kalan aparatı: reçete tekli / başlangıç eksi kaldırılan bantlar (yüz başına, ≥ 0). */
function faceConnectors(recipeLines, removedSurfaces) {
  const singles = recipeQuantity(recipeLines, 'connector_single');
  const starts = recipeQuantity(recipeLines, 'connector_start');
  const bottomRemoved = removedSurfaces.some((surface) => surface?.stripIndex === 0);
  return {
    single: Math.max(0, singles - SIDES_PER_PANEL * removedSurfaces.length),
    start: bottomRemoved ? 0 : starts,
  };
}

/**
 * Ön yüz: modül satırlarından kaldırılan ön panelleri ve yan aparatlarını düşer (köşe tarafı
 * sonradan `removedPanelCornerCharges` ile tekliden köşe aparatına geçer).
 * @param {Array} lines modül satırları (köşe paneli dönüşümünden sonra)
 * @param {Array} recipeLines duvarın reçete satırları
 * @param {Array} removedSurfaces kaldırılan ön bant yüzeyleri (itemKey dönüşüm sonrası)
 */
export function applyRemovedFrontPanels(lines = [], recipeLines = [], removedSurfaces = []) {
  if (!removedSurfaces.length) return lines;
  let next = lines.map((line) => ({ ...line }));
  for (const surface of removedSurfaces) next = subtractPanel(next, surface?.itemKey);
  const kept = faceConnectors(recipeLines, removedSurfaces);
  return applyModuleConnectorCharge(next, {
    single: kept.single - recipeQuantity(recipeLines, 'connector_single'),
    start: kept.start - recipeQuantity(recipeLines, 'connector_start'),
  });
}

/** Arka yüz aparatı: ön yüzle aynı reçete aparatı, kaldırılan arka bantlar düşülmüş olarak. */
export function applyBackFaceConnectors(lines = [], recipeLines = [], removedBackSurfaces = []) {
  const kept = faceConnectors(recipeLines, removedBackSurfaces);
  return applyModuleConnectorCharge(lines, { single: kept.single, start: kept.start });
}

/**
 * Köşe aparatı ödeyen yanlar: kaldırılan panel o yanda tekli değil köşe aparatı düşer.
 * Yüz başına köşe yükü yan başına derz sayısı (bant − 1) kadardır; ödeyen yan sayısı buradan çıkar.
 * @returns {Array<{ moduleId: string, single: number, corner: number }>}
 */
export function removedPanelCornerCharges(moduleEntries = [], charges = [], modules = []) {
  const chargeByModule = new Map((charges ?? []).map((charge) => [charge.moduleId, charge]));
  const result = [];
  moduleEntries.forEach((entry, index) => {
    if (entry?.status !== 'ok') return;
    const charge = chargeByModule.get(entry.moduleId);
    if (!charge) return;
    const bands = Array.isArray(modules[index]?.strips) ? modules[index].strips.length : 0;
    const seams = Math.max(1, bands - 1);
    let shift = 0;
    for (const [removed, faceCorner] of [
      [Number(entry.removedFrontPanels) || 0, Number(charge.frontCorner) || 0],
      [Number(entry.removedBackPanels) || 0, Number(charge.backCorner) || 0],
    ]) {
      if (!removed || faceCorner <= 0) continue;
      const payingSides = Math.min(SIDES_PER_PANEL, Math.round(faceCorner / seams));
      shift += Math.min(faceCorner, payingSides * removed);
    }
    if (shift) result.push({ moduleId: entry.moduleId, single: shift, corner: -shift });
  });
  return result;
}
