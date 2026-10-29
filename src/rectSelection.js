import { isVerticalModuleRotation } from './modulePlacement.js';

export const PANEL_MODULE_CONNECT_TOLERANCE_CM = 10.5;

/**
 * Panel taşıyan modülün plan düzlemindeki segmenti. Sahnedeki Ctrl seçim
 * düzlemiyle (scene3d getSurfaceSelectionPlaneMeta) aynı placement okumasıdır:
 * arka duvar x ekseni, sol/sağ duvar y ekseni, serbest dizide 90/270° dönüş y ekseni.
 */
export function modulePanelSegment(placement, widthCm) {
  const width = Number(widthCm);
  if (!placement || !Number.isFinite(width) || width <= 0) return null;
  const wallId = placement.wallId ?? null;
  const xCm = Number(placement.xCm);
  const yCm = Number(placement.yCm);
  let axis;
  if (wallId === 'back') axis = 'x';
  else if (wallId === 'left' || wallId === 'right') axis = 'y';
  else if (wallId === 'free') axis = isVerticalModuleRotation(placement.rotationZDeg) ? 'y' : 'x';
  else return null;
  const pathCm = axis === 'x' ? xCm : yCm;
  const crossCm = axis === 'x' ? yCm : xCm;
  if (![pathCm, crossCm].every(Number.isFinite)) return null;
  return { axis, crossCm, startCm: pathCm, endCm: pathCm + width };
}

/**
 * İki modül segmenti fiziksel olarak birbirine değiyor mu: aynı doğrultuda uç uca
 * ya da köşede uçları buluşan dik segmentler.
 */
export function panelModulesConnected(a, b, toleranceCm = PANEL_MODULE_CONNECT_TOLERANCE_CM) {
  const tolerance = Math.max(0, Number(toleranceCm) || 0);
  const near = (left, right) => Math.abs(Number(left) - Number(right)) <= tolerance;
  if (a.axis === b.axis) {
    return near(a.crossCm, b.crossCm)
      && (near(a.endCm, b.startCm) || near(b.endCm, a.startCm));
  }

  const xSegment = a.axis === 'x' ? a : b;
  const ySegment = a.axis === 'y' ? a : b;
  const intersectionX = ySegment.crossCm;
  const intersectionY = xSegment.crossCm;
  const xEndpoint = near(intersectionX, xSegment.startCm)
    || near(intersectionX, xSegment.endCm);
  const yEndpoint = near(intersectionY, ySegment.startCm)
    || near(intersectionY, ySegment.endCm);
  return xEndpoint && yEndpoint;
}

function normalizePoint(point) {
  return {
    moduleIndex: Number(point?.moduleIndex),
    stripIndex: Number(point?.stripIndex),
  };
}

export function createConnectedPanelModulePath(modules, anchorModuleId, targetModuleId, toleranceCm = PANEL_MODULE_CONNECT_TOLERANCE_CM) {
  if (!Array.isArray(modules) || !anchorModuleId || !targetModuleId) {
    return { ok: false, moduleIds: [] };
  }

  const tolerance = Math.max(0, Number(toleranceCm) || 0);
  const byId = new Map();
  modules.forEach((module) => {
    const moduleId = module?.moduleId ?? null;
    const axis = module?.axis;
    const startCm = Number(module?.startCm);
    const endCm = Number(module?.endCm);
    const crossCm = Number(module?.crossCm);
    if (!moduleId || (axis !== 'x' && axis !== 'y')) return;
    if (![startCm, endCm, crossCm].every(Number.isFinite)) return;
    byId.set(moduleId, {
      moduleId,
      axis,
      startCm: Math.min(startCm, endCm),
      endCm: Math.max(startCm, endCm),
      crossCm,
    });
  });

  if (!byId.has(anchorModuleId) || !byId.has(targetModuleId)) {
    return { ok: false, moduleIds: [] };
  }
  if (anchorModuleId === targetModuleId) {
    return { ok: true, moduleIds: [anchorModuleId] };
  }

  const connected = (a, b) => panelModulesConnected(a, b, tolerance);

  const ids = [...byId.keys()];
  const previous = new Map([[anchorModuleId, null]]);
  const queue = [anchorModuleId];

  while (queue.length) {
    const currentId = queue.shift();
    const current = byId.get(currentId);
    for (const candidateId of ids) {
      if (previous.has(candidateId) || candidateId === currentId) continue;
      if (!connected(current, byId.get(candidateId))) continue;
      previous.set(candidateId, currentId);
      if (candidateId === targetModuleId) {
        const moduleIds = [];
        let cursor = targetModuleId;
        while (cursor) {
          moduleIds.push(cursor);
          cursor = previous.get(cursor) ?? null;
        }
        moduleIds.reverse();
        return { ok: true, moduleIds };
      }
      queue.push(candidateId);
    }
  }

  return { ok: false, moduleIds: [] };
}

export function createPanelRangeSelection(items, anchorPoint, targetPoint) {
  if (!Array.isArray(items) || !items.length) {
    return { ok: false, message: 'Seçilebilir panel bulunamadı.' };
  }

  const anchor = normalizePoint(anchorPoint);
  const target = normalizePoint(targetPoint);

  if (
    !Number.isInteger(anchor.moduleIndex)
    || !Number.isInteger(anchor.stripIndex)
    || !Number.isInteger(target.moduleIndex)
    || !Number.isInteger(target.stripIndex)
  ) {
    return { ok: false, message: 'Seçim başlangıç veya bitiş noktası geçersiz.' };
  }

  const selectableModuleIndices = [...new Set(
    items
      .map((item) => Number(item?.moduleIndex))
      .filter(Number.isInteger),
  )].sort((a, b) => a - b);
  const anchorColumn = selectableModuleIndices.indexOf(anchor.moduleIndex);
  const targetColumn = selectableModuleIndices.indexOf(target.moduleIndex);
  if (anchorColumn < 0 || targetColumn < 0) {
    return { ok: false, message: 'Seçim başlangıç veya bitiş paneli bulunamadı.' };
  }

  const minColumn = Math.min(anchorColumn, targetColumn);
  const maxColumn = Math.max(anchorColumn, targetColumn);
  const selectedModuleIndices = selectableModuleIndices.slice(minColumn, maxColumn + 1);
  const selectedModuleSet = new Set(selectedModuleIndices);
  const minStripIndex = Math.min(anchor.stripIndex, target.stripIndex);
  const maxStripIndex = Math.max(anchor.stripIndex, target.stripIndex);
  const columnOrder = new Map(selectedModuleIndices.map((moduleIndex, index) => [moduleIndex, index]));

  // Ctrl/Cmd çoklu seçimde kural modül tipi değil panel varlığıdır. Aralıkta
  // kapı/vitrin açıklığı gibi panel olmayan hücreler bulunabilir; bunlar seçimi
  // bozmaz, yalnızca gerçekten var olan panel yüzeyleri seçilir.
  const entries = items
    .filter((item) => (
      selectedModuleSet.has(Number(item?.moduleIndex))
      && Number(item?.stripIndex) >= minStripIndex
      && Number(item?.stripIndex) <= maxStripIndex
    ))
    .sort((a, b) => (
      Number(a.stripIndex) - Number(b.stripIndex)
      || columnOrder.get(Number(a.moduleIndex)) - columnOrder.get(Number(b.moduleIndex))
    ));

  if (!entries.length) {
    return { ok: false, message: 'Seçim aralığında panel bulunamadı.' };
  }

  return {
    ok: true,
    entries,
    panelCount: entries.length,
    columnCount: selectedModuleIndices.length,
    rowCount: maxStripIndex - minStripIndex + 1,
    bounds: {
      minModuleIndex: selectedModuleIndices[0],
      maxModuleIndex: selectedModuleIndices.at(-1),
      minStripIndex,
      maxStripIndex,
    },
  };
}

export function createRectSelection(items, anchorPoint, targetPoint) {
  if (!Array.isArray(items) || !items.length) {
    return { ok: false, message: 'Seçilebilir panel bulunamadı.' };
  }

  const anchor = normalizePoint(anchorPoint);
  const target = normalizePoint(targetPoint);

  if (
    !Number.isInteger(anchor.moduleIndex)
    || !Number.isInteger(anchor.stripIndex)
    || !Number.isInteger(target.moduleIndex)
    || !Number.isInteger(target.stripIndex)
  ) {
    return { ok: false, message: 'Seçim başlangıç veya bitiş noktası geçersiz.' };
  }

  const selectableModuleIndices = [...new Set(
    items
      .map((item) => Number(item?.moduleIndex))
      .filter(Number.isInteger),
  )].sort((a, b) => a - b);
  const anchorColumn = selectableModuleIndices.indexOf(anchor.moduleIndex);
  const targetColumn = selectableModuleIndices.indexOf(target.moduleIndex);
  if (anchorColumn < 0 || targetColumn < 0) {
    return { ok: false, message: 'Seçim başlangıç veya bitiş paneli bulunamadı.' };
  }

  const minColumn = Math.min(anchorColumn, targetColumn);
  const maxColumn = Math.max(anchorColumn, targetColumn);
  const selectedModuleIndices = selectableModuleIndices.slice(minColumn, maxColumn + 1);
  const selectedModuleSet = new Set(selectedModuleIndices);
  const minModuleIndex = selectedModuleIndices[0];
  const maxModuleIndex = selectedModuleIndices.at(-1);
  const minStripIndex = Math.min(anchor.stripIndex, target.stripIndex);
  const maxStripIndex = Math.max(anchor.stripIndex, target.stripIndex);

  const columnCount = selectedModuleIndices.length;
  const rowCount = maxStripIndex - minStripIndex + 1;
  const expectedCount = columnCount * rowCount;
  const columnOrder = new Map(selectedModuleIndices.map((moduleIndex, index) => [moduleIndex, index]));

  const entries = items
    .filter((item) => (
      selectedModuleSet.has(item.moduleIndex)
      && item.stripIndex >= minStripIndex
      && item.stripIndex <= maxStripIndex
    ))
    .sort((a, b) => (
      a.stripIndex - b.stripIndex
      || columnOrder.get(a.moduleIndex) - columnOrder.get(b.moduleIndex)
    ));

  const coordinateCount = new Set(
    entries.map((item) => `${item.moduleIndex}:${item.stripIndex}`),
  ).size;

  if (entries.length !== expectedCount || coordinateCount !== expectedCount) {
    return {
      ok: false,
      message: 'Seçim alanında eksik panel var; yalnızca tam dikdörtgen bloklar seçilebilir.',
    };
  }

  return {
    ok: true,
    entries,
    panelCount: expectedCount,
    columnCount,
    rowCount,
    bounds: {
      minModuleIndex,
      maxModuleIndex,
      minStripIndex,
      maxStripIndex,
    },
  };
}

