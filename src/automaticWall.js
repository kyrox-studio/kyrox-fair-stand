import { composeStraightWall } from './wall.js';
import { composeDepotAlignedWidths, composeDepotBackWidths } from './autoDepot.js';
import {
  getContinuousWallCapacityCm,
  getContinuousWallSegments,
  planContinuousWallLayout,
} from './wallReflow.js';

export const AUTOMATIC_WALL_LAMP_INTERVAL_CM = 150;
const LAMP_WALL_IDS = new Set(['back', 'left', 'right']);

function wallModuleLocalStartCm(placement, widthCm, standYCm) {
  if (placement.wallId === 'left') return Number(standYCm) - (Number(placement.yCm) + widthCm);
  if (placement.wallId === 'back') return Number(placement.xCm);
  if (placement.wallId === 'right') return Number(placement.yCm);
  return null;
}

function isDepotRearWall(module) {
  if (module?.depotBack === true) return true;
  return module?.autoDepotBack === true && module?.placement?.wallId === 'back';
}

function contiguousWallRuns(modules, standYCm) {
  const byWall = new Map();
  for (const module of modules ?? []) {
    const placement = module?.placement;
    const wallId = placement?.wallId;
    if (!LAMP_WALL_IDS.has(wallId)) continue;
    if (module.type && module.type !== 'flat-panel') continue;
    if (isDepotRearWall(module) || module?.depotSide === true) continue;
    const widthCm = Number(module.widthCm);
    const start = wallModuleLocalStartCm(placement, widthCm, standYCm);
    if (!Number.isFinite(start) || !Number.isFinite(widthCm) || widthCm <= 0) continue;
    const spans = byWall.get(wallId) ?? [];
    spans.push({ start, end: start + widthCm });
    byWall.set(wallId, spans);
  }

  const runs = [];
  for (const [wallId, spans] of byWall) {
    spans.sort((left, right) => left.start - right.start);
    let current = null;
    for (const span of spans) {
      if (!current || span.start > current.end + 0.5) {
        if (current) runs.push(current);
        current = { wallId, start: span.start, end: span.end };
      } else {
        current.end = Math.max(current.end, span.end);
      }
    }
    if (current) runs.push(current);
  }
  return runs;
}

function lampPlacementAtLocalCenter({
  wallId,
  localCenterCm,
  lampWidthCm,
  standXCm,
  standYCm,
}) {
  const localStartCm = localCenterCm - lampWidthCm / 2;
  if (wallId === 'left') {
    return {
      xCm: 0,
      yCm: Number(standYCm) - localStartCm - lampWidthCm,
      zCm: 0,
      rotationZDeg: 90,
      wallId,
    };
  }
  if (wallId === 'right') {
    return {
      xCm: Number(standXCm),
      yCm: localStartCm,
      zCm: 0,
      rotationZDeg: 270,
      wallId,
    };
  }
  return {
    xCm: localStartCm,
    yCm: 0,
    zCm: 0,
    rotationZDeg: 0,
    wallId: 'back',
  };
}

/**
 * Kesintisiz duvar koşusu başına otomatik lamba sayısı (kullanıcı kararı 2026-11-10): her 150 cm
 * için bir lamba, artan kısım yukarı yuvarlanır (400 cm → 3, 100 cm → 1).
 */
export function automaticWallLampCount(runLengthCm, intervalCm = AUTOMATIC_WALL_LAMP_INTERVAL_CM) {
  const lengthCm = Number(runLengthCm);
  const stepCm = Number(intervalCm);
  if (!Number.isFinite(lengthCm) || lengthCm <= 0.5 || !Number.isFinite(stepCm) || stepCm <= 0) return 0;
  return Math.ceil(lengthCm / stepCm - 1e-6);
}

/** Lamba planına giren duvar koşuları: duvar başına `uzunluk` listesi (koşu değişti mi karşılaştırması için). */
export function automaticWallLampRunLengths(modules, standYCm) {
  const lengths = new Map();
  for (const run of contiguousWallRuns(modules, standYCm)) {
    const list = lengths.get(run.wallId) ?? [];
    list.push(Math.round(run.end - run.start));
    lengths.set(run.wallId, list);
  }
  return lengths;
}

/**
 * Her kesintisiz duvar koşusuna `automaticWallLampCount` kadar lamba; koşu eşit dilimlere bölünür ve
 * lamba her dilimin ortasına gelir, uçta boş kısım kalmaz. Yön duvarın sahneye bakan yönüdür.
 * `wallIds` verilirse yalnız o duvarlar planlanır.
 */
export function planAutomaticWallLampPlacements({
  modules,
  standXCm,
  standYCm,
  lampWidthCm = 50,
  intervalCm = AUTOMATIC_WALL_LAMP_INTERVAL_CM,
  wallIds = null,
} = {}) {
  const widthCm = Number(lampWidthCm);
  const stepCm = Number(intervalCm);
  if (!Number.isFinite(widthCm) || widthCm <= 0 || !Number.isFinite(stepCm) || stepCm <= 0) return [];

  const placements = [];
  for (const run of contiguousWallRuns(modules, standYCm)) {
    if (wallIds && !wallIds.has(run.wallId)) continue;
    const lengthCm = run.end - run.start;
    const count = automaticWallLampCount(lengthCm, stepCm);
    const sliceCm = lengthCm / count;
    for (let index = 0; index < count; index += 1) {
      placements.push(lampPlacementAtLocalCenter({
        wallId: run.wallId,
        localCenterCm: Math.round(run.start + index * sliceCm + sliceCm / 2),
        lampWidthCm: widthCm,
        standXCm,
        standYCm,
      }));
    }
  }
  return placements;
}

function centeredLampOnSpan(modules, lampWidthCm) {
  const placement = modules[0].placement;
  const rotationZDeg = Number(placement.rotationZDeg) || 0;
  const vertical = rotationZDeg % 180 !== 0;
  if (vertical) {
    const start = Math.min(...modules.map((module) => Number(module.placement.yCm)));
    const end = Math.max(...modules.map((module) => Number(module.placement.yCm) + Number(module.widthCm)));
    return {
      xCm: Number(placement.xCm),
      yCm: (start + end) / 2 - lampWidthCm / 2,
      zCm: 0,
      rotationZDeg,
      wallId: placement.wallId,
    };
  }
  const start = Math.min(...modules.map((module) => Number(module.placement.xCm)));
  const end = Math.max(...modules.map((module) => Number(module.placement.xCm) + Number(module.widthCm)));
  return {
    xCm: (start + end) / 2 - lampWidthCm / 2,
    yCm: Number(placement.yCm),
    zCm: 0,
    rotationZDeg,
    wallId: placement.wallId,
  };
}

function isDepotLampPiece(module) {
  if (!module?.placement || module.depotBack) return false;
  const kind = module.kind || module.type;
  const structural = module.depotSide === true
    || kind === 'wall'
    || kind === 'flat-panel'
    || kind === 'door';
  if (!structural) return false;
  return module.depotSide === true || module.autoDepot === true || module.placement.wallId === 'free';
}

/** Depo duvarlarında, arka yüz hariç, her yüzde bir lamba. Üst profil snap'i çağıran taraf yapar. */
export function planAutomaticDepotLampPlacements({ modules, lampWidthCm = 50 } = {}) {
  const widthCm = Number(lampWidthCm);
  if (!Number.isFinite(widthCm) || widthCm <= 0) return [];

  const faces = new Map();
  for (const module of modules ?? []) {
    if (!isDepotLampPiece(module)) continue;
    const pieceWidth = Number(module.widthCm);
    if (!Number.isFinite(pieceWidth) || pieceWidth <= 0) continue;
    const placement = module.placement;
    const rotationZDeg = Number(placement.rotationZDeg) || 0;
    const vertical = rotationZDeg % 180 !== 0;
    const key = vertical
      ? `v:${placement.xCm}:${rotationZDeg}`
      : `h:${placement.yCm}`;
    const face = faces.get(key) ?? [];
    face.push(module);
    faces.set(key, face);
  }

  const horizontalKeys = [...faces.keys()].filter((key) => key.startsWith('h:'));
  if (horizontalKeys.length > 1) {
    const rearKey = horizontalKeys.sort((left, right) => Number(left.slice(2)) - Number(right.slice(2)))[0];
    faces.delete(rearKey);
  }

  return [...faces.values()]
    .map((face) => centeredLampOnSpan(face, widthCm))
    .sort((left, right) => left.rotationZDeg - right.rotationZDeg
      || left.xCm - right.xCm
      || left.yCm - right.yCm);
}

export function getAutomaticWallCapacityCm({ standType, standXCm, standYCm } = {}) {
  return getContinuousWallCapacityCm(standType, standXCm, standYCm);
}

export function composeAutomaticStandWall({
  wallWidthCm,
  standType,
  standXCm,
  standYCm,
} = {}) {
  const validation = composeStraightWall(Number(wallWidthCm));
  if (!validation.ok) return validation;

  const requestedCm = Number(wallWidthCm);
  const capacityCm = getContinuousWallCapacityCm(standType, standXCm, standYCm);
  const segments = getContinuousWallSegments(standType, standXCm, standYCm);

  if (!segments.length || capacityCm <= 0) {
    return {
      ok: false,
      capacityCm,
      requestedCm,
      message: 'Bu stand tipinde otomatik duvar oluşturulacak aktif kenar yok.',
    };
  }

  if (requestedCm > capacityCm) {
    return {
      ok: false,
      capacityCm,
      requestedCm,
      message: `Toplam aktif duvar sınırı ${capacityCm} cm; ${requestedCm} cm oluşturulamaz.`,
    };
  }

  const widths = [];
  let remainingCm = requestedCm;

  for (const segment of segments) {
    if (remainingCm <= 0) break;
    const fillCm = Math.min(remainingCm, Number(segment.edgeWidthCm));
    if (fillCm <= 0) continue;

    const segmentWall = composeStraightWall(fillCm);
    if (!segmentWall.ok) return segmentWall;
    widths.push(...segmentWall.modules);
    remainingCm -= fillCm;
  }

  if (remainingCm > 0) {
    return {
      ok: false,
      capacityCm,
      requestedCm,
      message: 'İstenen duvar uzunluğu aktif stand kenarlarına yerleştirilemedi.',
    };
  }

  const planningModules = widths.map((widthCm, index) => ({
    id: `automatic-wall-${index}`,
    widthCm,
  }));
  const layout = planContinuousWallLayout({
    modules: planningModules,
    standType,
    standXCm,
    standYCm,
  });
  if (!layout.ok) return { ...layout, capacityCm, requestedCm };

  return {
    ok: true,
    capacityCm,
    requestedCm,
    widths,
    placements: planningModules.map((module) => ({ ...layout.placements.get(module.id) })),
  };
}

export function composeAutomaticBackWallWithDepot({
  standXCm,
  depotOriginXCm,
  depotWidthCm,
  sizeKey,
} = {}) {
  const standX = Number(standXCm);
  const depotX = Number(depotOriginXCm);
  const depotWidth = Number(depotWidthCm);
  if (![standX, depotX, depotWidth].every(Number.isFinite) || standX <= 0 || depotWidth <= 0) {
    return { ok: false, message: 'Depo sırt duvarı ölçüleri geçersiz.' };
  }
  if (depotX < 0 || depotX + depotWidth > standX) {
    return { ok: false, message: 'Depo sırt duvarı stand sınırını aşıyor.' };
  }

  const modules = [];
  const addChunk = (wallWidthCm, startXCm, depotBack = false) => {
    if (wallWidthCm <= 0) return true;
    if (depotBack) {
      const aligned = sizeKey
        ? composeDepotBackWidths(sizeKey)
        : composeDepotAlignedWidths(wallWidthCm);
      if (!aligned.ok) return false;
      const total = aligned.modules.reduce((sum, width) => sum + width, 0);
      if (total !== depotWidth) return false;
      let cursor = startXCm;
      for (const widthCm of aligned.modules) {
        modules.push({
          widthCm,
          placement: { xCm: cursor, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' },
          depotBack: true,
        });
        cursor += widthCm;
      }
      return true;
    }
    const composed = composeStraightWall(wallWidthCm);
    if (!composed.ok) return false;
    let cursor = startXCm;
    for (const widthCm of composed.modules) {
      modules.push({ widthCm, placement: { xCm: cursor, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' }, depotBack: false });
      cursor += widthCm;
    }
    return true;
  };

  const beforeCm = depotX;
  const afterStartCm = depotX + depotWidth;
  const afterCm = standX - afterStartCm;
  if (!addChunk(beforeCm, 0)) return { ok: false, message: 'Depo öncesi sırt duvarı oluşturulamadı.' };
  if (!addChunk(depotWidth, depotX, true)) return { ok: false, message: 'Depo sırt paneli oluşturulamadı.' };
  if (!addChunk(afterCm, afterStartCm)) return { ok: false, message: 'Depo sonrası sırt duvarı oluşturulamadı.' };

  return { ok: true, modules };
}

/**
 * L-stand paylaşılan yan duvar: depo derinliği kadar dilim, kalan composeStraightWall.
 * wallId 'left' (rot 90) veya 'right' (rot 270). Depo köşede originY=0 varsayımı.
 */
export function composeAutomaticSideWallWithDepot({
  standType,
  standXCm,
  standYCm,
  depotDepthCm,
} = {}) {
  const standX = Number(standXCm);
  const standY = Number(standYCm);
  const depotDepth = Number(depotDepthCm);
  const wallId = standType === 'l-left' ? 'left' : standType === 'l-right' ? 'right' : null;
  if (!wallId) return { ok: false, message: 'Yan depo duvarı yalnız L stand için.' };
  if (![standX, standY, depotDepth].every(Number.isFinite) || standY <= 0 || depotDepth <= 0) {
    return { ok: false, message: 'Depo yan duvarı ölçüleri geçersiz.' };
  }
  if (depotDepth > standY) {
    return { ok: false, message: 'Depo derinliği yan duvarı aşıyor.' };
  }

  const aligned = composeDepotAlignedWidths(depotDepth);
  if (!aligned.ok) return { ok: false, message: 'Depo yan paneli oluşturulamadı.' };

  const modules = [];
  let yCursor = 0;
  for (const widthCm of aligned.modules) {
    modules.push({
      widthCm,
      placement: {
        xCm: wallId === 'left' ? 0 : standX,
        yCm: yCursor,
        zCm: 0,
        rotationZDeg: wallId === 'left' ? 90 : 270,
        wallId,
      },
      depotSide: true,
    });
    yCursor += widthCm;
  }

  const afterCm = standY - yCursor;
  if (afterCm > 0) {
    const composed = composeStraightWall(afterCm);
    if (!composed.ok) return { ok: false, message: 'Depo sonrası yan duvar oluşturulamadı.' };
    for (const widthCm of composed.modules) {
      modules.push({
        widthCm,
        placement: {
          xCm: wallId === 'left' ? 0 : standX,
          yCm: yCursor,
          zCm: 0,
          rotationZDeg: wallId === 'left' ? 90 : 270,
          wallId,
        },
        depotSide: false,
      });
      yCursor += widthCm;
    }
  }

  return { ok: true, modules, wallId };
}
