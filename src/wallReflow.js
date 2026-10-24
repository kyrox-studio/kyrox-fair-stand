import { createModulePlacement } from './modulePlacement.js';
import { applyItemPlacementZCm } from './items.js';
import { getModuleBehavior } from './moduleBehavior.js';

const EPSILON_CM = 0.001;

function getSegments(standType, standXCm, standYCm) {
  const x = Number(standXCm);
  const y = Number(standYCm);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x <= 0 || y <= 0) return [];

  const definitions = {
    'back-wall': [['back', x]],
    'l-left': [['left', y], ['back', x]],
    'l-right': [['back', x], ['right', y]],
    'u-stand': [['left', y], ['back', x], ['right', y]],
  };

  let offsetCm = 0;
  return (definitions[standType] ?? []).map(([wallId, edgeWidthCm]) => {
    const segment = { wallId, edgeWidthCm, offsetCm };
    offsetCm += edgeWidthCm;
    return segment;
  });
}

export function getContinuousWallSegments(standType, standXCm, standYCm) {
  return getSegments(standType, standXCm, standYCm).map((segment) => ({ ...segment }));
}

export function getContinuousWallCapacityCm(standType, standXCm, standYCm) {
  return getSegments(standType, standXCm, standYCm)
    .reduce((sum, segment) => sum + Number(segment.edgeWidthCm), 0);
}

function placementToPathStart(module, segments, standYCm) {
  const placement = module?.placement;
  const widthCm = Number(module?.widthCm);
  if (!placement || !Number.isFinite(widthCm) || widthCm <= 0) return null;

  const segment = segments.find((candidate) => candidate.wallId === placement.wallId);
  if (!segment) return null;

  let localStartCm;
  if (placement.wallId === 'left') {
    localStartCm = Number(standYCm) - (Number(placement.yCm) + widthCm);
  } else if (placement.wallId === 'back') {
    localStartCm = Number(placement.xCm);
  } else if (placement.wallId === 'right') {
    localStartCm = Number(placement.yCm);
  } else {
    return null;
  }

  if (!Number.isFinite(localStartCm)) return null;
  if (
    localStartCm < -EPSILON_CM
    || localStartCm + widthCm > segment.edgeWidthCm + EPSILON_CM
  ) {
    return null;
  }

  return segment.offsetCm + Math.max(0, localStartCm);
}

function createPlacement(segment, localStartCm, widthCm, standXCm, standYCm) {
  if (segment.wallId === 'left') {
    return createModulePlacement({
      xCm: 0,
      yCm: Number(standYCm) - localStartCm - widthCm,
      zCm: 0,
      rotationZDeg: 90,
      wallId: 'left',
    });
  }

  if (segment.wallId === 'right') {
    return createModulePlacement({
      xCm: Number(standXCm),
      yCm: localStartCm,
      zCm: 0,
      rotationZDeg: 270,
      wallId: 'right',
    });
  }

  return createModulePlacement({
    xCm: localStartCm,
    yCm: 0,
    zCm: 0,
    rotationZDeg: 0,
    wallId: 'back',
  });
}

function findNextPlacement(cursorCm, widthCm, segments, standXCm, standYCm) {
  for (const segment of segments) {
    const segmentStart = segment.offsetCm;
    const segmentEnd = segment.offsetCm + segment.edgeWidthCm;
    if (cursorCm > segmentEnd + EPSILON_CM) continue;

    const localStartCm = Math.max(0, cursorCm - segmentStart);
    if (localStartCm + widthCm <= segment.edgeWidthCm + EPSILON_CM) {
      const pathStartCm = segmentStart + localStartCm;
      return {
        placement: createPlacement(segment, localStartCm, widthCm, standXCm, standYCm),
        pathStartCm,
        nextCursorCm: pathStartCm + widthCm,
      };
    }
  }

  return null;
}

function findPreviousPlacement(cursorEndCm, widthCm, segments, standXCm, standYCm) {
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    const segmentStart = segment.offsetCm;
    const segmentEnd = segment.offsetCm + segment.edgeWidthCm;
    if (cursorEndCm < segmentStart - EPSILON_CM) continue;

    const pathEndCm = Math.min(cursorEndCm, segmentEnd);
    const localEndCm = pathEndCm - segmentStart;
    if (localEndCm + EPSILON_CM < widthCm) continue;

    const localStartCm = localEndCm - widthCm;
    if (localStartCm < -EPSILON_CM) continue;

    const normalizedLocalStartCm = Math.max(0, localStartCm);
    const pathStartCm = segmentStart + normalizedLocalStartCm;
    return {
      placement: createPlacement(
        segment,
        normalizedLocalStartCm,
        widthCm,
        standXCm,
        standYCm,
      ),
      pathStartCm,
      previousCursorCm: pathStartCm,
    };
  }

  return null;
}

function oppositeSide(side) {
  return side === 'left' ? 'right' : 'left';
}

function normalizeCallerSideForChain(side, targetWallId) {
  // Context menü / main.js mevcut akışında yan duvarlarda teknik yön bir kez
  // ters çevrilmiş olarak geliyor. Sürekli duvar zincirinin tek doğrusal
  // sol -> sağ mantığını korumak için burada yan duvar dönüşünü geri alıyoruz.
  if (targetWallId === 'left' || targetWallId === 'right') return oppositeSide(side);
  return side;
}

function planForwardInsertion({
  insertedModules,
  activeModules,
  firstExistingIndex,
  cursorCm,
  segments,
  standXCm,
  standYCm,
}) {
  const placements = new Map();
  let currentCursorCm = cursorCm;

  for (const module of insertedModules) {
    const widthCm = Number(module?.widthCm);
    if (!module?.id || !Number.isFinite(widthCm) || widthCm <= 0) {
      return { ok: false, message: 'Geçersiz modül genişliği bulundu.' };
    }

    const next = findNextPlacement(
      currentCursorCm,
      widthCm,
      segments,
      standXCm,
      standYCm,
    );
    if (!next) {
      return {
        ok: false,
        message: 'Aktif duvar zincirinde modüllerin tamamı için yeterli alan yok.',
      };
    }

    placements.set(module.id, applyItemPlacementZCm(module, next.placement));
    currentCursorCm = next.nextCursorCm;
  }

  for (let index = firstExistingIndex; index < activeModules.length; index += 1) {
    const entry = activeModules[index];
    const widthCm = Number(entry.module.widthCm);

    if (entry.pathStartCm + EPSILON_CM >= currentCursorCm) break;

    const next = findNextPlacement(
      currentCursorCm,
      widthCm,
      segments,
      standXCm,
      standYCm,
    );
    if (!next) {
      return {
        ok: false,
        message: 'Aktif duvar zincirinde modüllerin tamamı için yeterli alan yok.',
      };
    }

    placements.set(entry.module.id, applyItemPlacementZCm(entry.module, next.placement));
    currentCursorCm = next.nextCursorCm;
  }

  return { ok: true, placements };
}

function tryPlanBackwardInsertion({
  insertedModules,
  activeModules,
  targetIndex,
  cursorEndCm,
  segments,
  standXCm,
  standYCm,
}) {
  const placements = new Map();
  let currentCursorEndCm = cursorEndCm;

  // Zincirdeki sıra soldan sağa korunur. Bu yüzden hedefin hemen solundaki
  // son eklenecek modülden başlayarak geriye doğru yerleştiriyoruz.
  for (let index = insertedModules.length - 1; index >= 0; index -= 1) {
    const module = insertedModules[index];
    const widthCm = Number(module?.widthCm);
    if (!module?.id || !Number.isFinite(widthCm) || widthCm <= 0) {
      return { ok: false, invalid: true, message: 'Geçersiz modül genişliği bulundu.' };
    }

    const previous = findPreviousPlacement(
      currentCursorEndCm,
      widthCm,
      segments,
      standXCm,
      standYCm,
    );
    if (!previous) return { ok: false };

    placements.set(module.id, applyItemPlacementZCm(module, previous.placement));
    currentCursorEndCm = previous.previousCursorCm;
  }

  // Yeni modüller soldaki mevcut modüllere çarpıyorsa yalnızca çarpışma
  // zincirini sola iteriz. Hedef ve sağındaki modüller yerinde kalır.
  for (let index = targetIndex - 1; index >= 0; index -= 1) {
    const entry = activeModules[index];
    const widthCm = Number(entry.module.widthCm);
    const entryEndCm = entry.pathStartCm + widthCm;

    if (entryEndCm <= currentCursorEndCm + EPSILON_CM) break;

    const previous = findPreviousPlacement(
      currentCursorEndCm,
      widthCm,
      segments,
      standXCm,
      standYCm,
    );
    if (!previous) return { ok: false };

    placements.set(entry.module.id, applyItemPlacementZCm(entry.module, previous.placement));
    currentCursorEndCm = previous.previousCursorCm;
  }

  return { ok: true, placements };
}

function tryPlanBackwardEdgeInsertion({
  insertedModules,
  activeModules,
  targetIndex,
  cursorEndCm,
  segments,
  standXCm,
  standYCm,
}) {
  const placements = new Map();
  let currentCursorEndCm = cursorEndCm;

  // Açık zincir ucunda yeni modül fiziksel uçta kalır. Son modülden başlayarak
  // yalnızca çarpışan mevcut zinciri içeri / geriye doğru iteriz.
  for (let index = insertedModules.length - 1; index >= 0; index -= 1) {
    const module = insertedModules[index];
    const widthCm = Number(module?.widthCm);
    if (!module?.id || !Number.isFinite(widthCm) || widthCm <= 0) {
      return { ok: false, invalid: true, message: 'Geçersiz modül genişliği bulundu.' };
    }

    const previous = findPreviousPlacement(
      currentCursorEndCm,
      widthCm,
      segments,
      standXCm,
      standYCm,
    );
    if (!previous) return { ok: false };

    placements.set(module.id, applyItemPlacementZCm(module, previous.placement));
    currentCursorEndCm = previous.previousCursorCm;
  }

  for (let index = targetIndex; index >= 0; index -= 1) {
    const entry = activeModules[index];
    const widthCm = Number(entry.module.widthCm);
    const entryEndCm = entry.pathStartCm + widthCm;

    if (entryEndCm <= currentCursorEndCm + EPSILON_CM) break;

    const previous = findPreviousPlacement(
      currentCursorEndCm,
      widthCm,
      segments,
      standXCm,
      standYCm,
    );
    if (!previous) return { ok: false };

    placements.set(entry.module.id, applyItemPlacementZCm(entry.module, previous.placement));
    currentCursorEndCm = previous.previousCursorCm;
  }

  return { ok: true, placements };
}

export function planContinuousWallLayout({
  modules = [],
  standType,
  standXCm,
  standYCm,
} = {}) {
  const segments = getSegments(standType, standXCm, standYCm);
  if (!segments.length) {
    return { ok: false, message: 'Bu stand tipinde sürekli duvar yerleşimi kullanılamaz.' };
  }

  const placements = new Map();
  let cursorCm = 0;

  for (const module of modules) {
    const widthCm = Number(module?.widthCm);
    if (!module?.id || !Number.isFinite(widthCm) || widthCm <= 0) {
      return { ok: false, message: 'Geçersiz modül genişliği bulundu.' };
    }

    const next = findNextPlacement(cursorCm, widthCm, segments, standXCm, standYCm);
    if (!next) {
      return {
        ok: false,
        message: 'Aktif duvar zincirinde modüllerin tamamı için yeterli alan yok.',
      };
    }

    placements.set(module.id, applyItemPlacementZCm(module, next.placement));
    cursorCm = next.nextCursorCm;
  }

  return {
    ok: true,
    placements,
    usedCm: cursorCm,
    capacityCm: segments.reduce((sum, segment) => sum + segment.edgeWidthCm, 0),
  };
}

export function planContinuousWallInsertion({
  modules = [],
  insertedModules = [],
  targetModuleId,
  side,
  standType,
  standXCm,
  standYCm,
} = {}) {
  if (side !== 'left' && side !== 'right') {
    return { ok: false, message: 'Geçerli bir ekleme yönü gerekli.' };
  }

  const segments = getSegments(standType, standXCm, standYCm);
  if (!segments.length) {
    return { ok: false, message: 'Bu stand tipinde sürekli duvar yerleşimi kullanılamaz.' };
  }

  if (!insertedModules.length) {
    return { ok: false, message: 'Eklenecek modül bulunamadı.' };
  }

  const activeWallIds = new Set(segments.map((segment) => segment.wallId));
  const activeModules = modules
    .filter((module) => (
      getModuleBehavior(module).placement === 'wall'
      && activeWallIds.has(module?.placement?.wallId)
    ))
    .map((module, originalIndex) => ({
      module,
      originalIndex,
      pathStartCm: placementToPathStart(module, segments, standYCm),
    }));

  if (activeModules.some((entry) => entry.pathStartCm === null)) {
    return { ok: false, message: 'Mevcut modüllerden birinin duvar yerleşimi okunamadı.' };
  }

  activeModules.sort((a, b) => (
    a.pathStartCm - b.pathStartCm || a.originalIndex - b.originalIndex
  ));

  const targetIndex = activeModules.findIndex((entry) => entry.module.id === targetModuleId);
  if (targetIndex < 0) {
    return { ok: false, message: 'Hedef modül aktif duvar zincirinde bulunamadı.' };
  }

  const targetEntry = activeModules[targetIndex];
  const targetWidthCm = Number(targetEntry.module.widthCm);
  const normalizedSide = normalizeCallerSideForChain(
    side,
    targetEntry.module?.placement?.wallId,
  );
  const insertionIndex = normalizedSide === 'left' ? targetIndex : targetIndex + 1;
  const chain = activeModules.map((entry) => entry.module);
  chain.splice(insertionIndex, 0, ...insertedModules);

  let insertionPlan;

  if (normalizedSide === 'right') {
    insertionPlan = planForwardInsertion({
      insertedModules,
      activeModules,
      firstExistingIndex: targetIndex + 1,
      cursorCm: targetEntry.pathStartCm + targetWidthCm,
      segments,
      standXCm,
      standYCm,
    });

    // Hedef zincirin fiziksel sonundaysa dışarı taşmak yerine yeni modülü
    // açık uçta sabit tutup hedef ve yalnızca çarpışan önceki zinciri içeri it.
    const capacityCm = segments.reduce((sum, segment) => sum + segment.edgeWidthCm, 0);
    const targetEndCm = targetEntry.pathStartCm + targetWidthCm;
    const isOpenChainEnd = targetIndex === activeModules.length - 1
      && targetEndCm >= capacityCm - EPSILON_CM;

    if (!insertionPlan.ok && isOpenChainEnd) {
      insertionPlan = tryPlanBackwardEdgeInsertion({
        insertedModules,
        activeModules,
        targetIndex,
        cursorEndCm: targetEndCm,
        segments,
        standXCm,
        standYCm,
      });
    }
  } else {
    // Önce hedefin gerçekten solundaki mevcut boşluğu kullanmayı dene.
    insertionPlan = tryPlanBackwardInsertion({
      insertedModules,
      activeModules,
      targetIndex,
      cursorEndCm: targetEntry.pathStartCm,
      segments,
      standXCm,
      standYCm,
    });

    if (insertionPlan.invalid) return insertionPlan;

    // Sol sınırda boşluk yoksa eski düz-duvar davranışını koru: yeni modülü
    // hedefin başlangıcına koyup hedef ve yalnızca çakışan devam zincirini sağa it.
    if (!insertionPlan.ok) {
      insertionPlan = planForwardInsertion({
        insertedModules,
        activeModules,
        firstExistingIndex: targetIndex,
        cursorCm: targetEntry.pathStartCm,
        segments,
        standXCm,
        standYCm,
      });
    }
  }

  if (!insertionPlan.ok) return insertionPlan;

  const orderedModuleIds = chain.map((module) => module.id);
  const activeIdSet = new Set(orderedModuleIds);
  const inactiveModuleIds = modules
    .filter((module) => !activeIdSet.has(module.id))
    .map((module) => module.id);

  return {
    ok: true,
    orderedModuleIds: [...orderedModuleIds, ...inactiveModuleIds],
    placements: insertionPlan.placements,
  };
}

/**
 * Varyant değişimi: zincirdeki modül yeni genişlikle aynı başlangıçta kalır, çakışan sonraki
 * modüller ileri itilir. Sonda yer yoksa modül eski bitişine hizalanır ve önceki zincir geri
 * itilir. Modül zincirde değilse { ok: false, notInChain: true }.
 */
export function planContinuousWallReplacement({
  modules = [],
  replacement,
  standType,
  standXCm,
  standYCm,
} = {}) {
  const segments = getSegments(standType, standXCm, standYCm);
  if (!segments.length || !replacement?.id) return { ok: false, notInChain: true };

  const activeWallIds = new Set(segments.map((segment) => segment.wallId));
  const activeModules = modules
    .filter((module) => (
      getModuleBehavior(module).placement === 'wall'
      && activeWallIds.has(module?.placement?.wallId)
    ))
    .map((module, originalIndex) => ({
      module,
      originalIndex,
      pathStartCm: placementToPathStart(module, segments, standYCm),
    }));
  if (activeModules.some((entry) => entry.pathStartCm === null)) {
    return { ok: false, message: 'Mevcut modüllerden birinin duvar yerleşimi okunamadı.' };
  }
  activeModules.sort((a, b) => (
    a.pathStartCm - b.pathStartCm || a.originalIndex - b.originalIndex
  ));

  const targetIndex = activeModules.findIndex((entry) => entry.module.id === replacement.id);
  if (targetIndex < 0) return { ok: false, notInChain: true };
  const target = activeModules[targetIndex];
  const others = activeModules.filter((_entry, index) => index !== targetIndex);
  const options = { insertedModules: [replacement], activeModules: others, segments, standXCm, standYCm };

  let plan = planForwardInsertion({
    ...options,
    firstExistingIndex: targetIndex,
    cursorCm: target.pathStartCm,
  });
  if (!plan.ok) {
    plan = tryPlanBackwardInsertion({
      ...options,
      targetIndex,
      cursorEndCm: target.pathStartCm + Number(target.module.widthCm),
    });
  }
  if (!plan.ok) {
    return { ok: false, message: 'Bu varyant için duvar zincirinde yeterli yer yok.' };
  }
  return { ok: true, placements: plan.placements };
}
