import { getItem, resolveSceneDimensions } from './items.js';
import { modulePanelSegment, panelModulesConnected } from './rectSelection.js';

const REGION_EPSILON = 0.02;

const SECTION_DEFS = Object.freeze([
  Object.freeze({ id: 'image', label: 'Dijital Baskı' }),
  Object.freeze({ id: 'lightbox', label: 'Lightbox Bezi' }),
  Object.freeze({ id: 'mesh', label: 'Mesh - Delikli Branda' }),
  Object.freeze({ id: 'foam', label: 'Işıklı Strafor / Logo' }),
  Object.freeze({ id: 'tulle', label: 'Tül' }),
  Object.freeze({ id: 'metal', label: 'Metal Separatör' }),
]);

function nearly(a, b) {
  return Math.abs(Number(a) - Number(b)) <= REGION_EPSILON;
}

function roundCm(value) {
  return Math.round(Number(value) * 10) / 10;
}

function positiveCm(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function areaM2(widthCm, heightCm) {
  return (widthCm * heightCm) / 10000;
}

function panelSizeCm(surface) {
  const item = surface?.itemKey ? getItem(surface.itemKey) : null;
  const dims = item ? resolveSceneDimensions(item) : null;
  const width = positiveCm(dims?.widthCm) ?? positiveCm(surface?.widthCm);
  const height = positiveCm(dims?.heightCm) ?? positiveCm(surface?.heightCm);
  if (!(width > 0) || !(height > 0)) return null;
  return { width, height };
}

function moduleSegment(module) {
  const item = module?.itemKey ? getItem(module.itemKey) : null;
  const width = positiveCm(module?.widthCm) ?? positiveCm(item ? resolveSceneDimensions(item)?.widthCm : null);
  return modulePanelSegment(module?.placement, width);
}

// Arka yüz bantları ön yüzle aynı modül sırasında ama ayrı bir sütun numarası alanında kümelenir.
const BACK_FACE_INDEX_OFFSET = 1_000_000;

function collectStripFaces(modules) {
  const faces = [];
  modules.forEach((module, moduleIndex) => {
    const segment = moduleSegment(module);
    const front = Array.isArray(module?.strips) ? module.strips : [];
    const back = Array.isArray(module?.backStrips) ? module.backStrips : [];
    // Arka yüz ayrı baskı yüzeyidir: kendi sütun sırasında kümelenir, ön yüzle birleşmez.
    const sides = [[front, moduleIndex], [back, BACK_FACE_INDEX_OFFSET + moduleIndex]];
    sides.forEach(([strips, faceModuleIndex]) => strips.forEach((strip, fallbackIndex) => {
      if (!strip || typeof strip !== 'object') return;
      const size = panelSizeCm(strip);
      if (!size) return;
      const stripIndex = Number.isInteger(strip.stripIndex) ? strip.stripIndex : fallbackIndex;
      faces.push({
        moduleIndex: faceModuleIndex,
        segment,
        stripIndex,
        widthCm: size.width,
        heightCm: size.height,
        imageAssetId: strip.imageAssetId || null,
        transform: strip.imageTransform && typeof strip.imageTransform === 'object'
          ? strip.imageTransform
          : null,
        fabricGroupId: strip.fabricGroupId || null,
        fabricType: strip.fabricType === 'mesh' ? 'mesh' : 'lightbox',
        isMetalSeparator: Boolean(strip.isMetalSeparator) && !strip.isGlass,
        metalSeparatorGroupId: strip.metalSeparatorGroupId || null,
        fabricImageAssetId: strip.fabricImageAssetId || null,
        fabricColor: typeof strip.fabricColor === 'string' ? strip.fabricColor : null,
      });
    }));
  });
  return faces;
}

function assetSubject(assetId) {
  const id = typeof assetId === 'string' ? assetId.trim() : '';
  return id ? { kind: 'asset', id } : null;
}

function colorSubject(color) {
  const value = typeof color === 'string' ? color.trim().toLowerCase() : '';
  return value ? { kind: 'color', id: value } : null;
}

function piece(widthCm, heightCm, subject = null) {
  const width = roundCm(widthCm);
  const height = roundCm(heightCm);
  if (!(width > 0) || !(height > 0)) return null;
  return {
    widthCm: width,
    heightCm: height,
    subjectKind: subject?.kind ?? null,
    subjectId: subject?.id ?? null,
  };
}

function imagePieces(faces) {
  const printed = faces.filter((face) => face.imageAssetId && !face.fabricGroupId);
  const pieces = [];
  const horizontal = [];
  const rect = [];
  for (const face of printed) {
    const mode = face.transform?.mode;
    if (mode === 'horizontal-group') horizontal.push(face);
    else if (mode === 'rect-group') rect.push(face);
    else {
      const single = piece(face.widthCm, face.heightCm, assetSubject(face.imageAssetId));
      if (single) pieces.push(single);
    }
  }
  pieces.push(...clusterHorizontal(horizontal));
  pieces.push(...clusterRect(rect));
  return pieces;
}

function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

function clusterHorizontal(faces) {
  const pieces = [];
  for (const row of groupBy(faces, (face) => `${face.imageAssetId}\u0000${face.transform?.blockId ?? ""}\u0000${face.stripIndex}`).values()) {
    const sorted = [...row].sort((a, b) => a.moduleIndex - b.moduleIndex || a.stripIndex - b.stripIndex);
    let current = [];
    const flush = () => {
      if (!current.length) return;
      const made = piece(
        current.reduce((sum, face) => sum + face.widthCm, 0),
        current[0].heightCm,
        assetSubject(current[0].imageAssetId),
      );
      if (made) pieces.push(made);
      current = [];
    };
    for (const face of sorted) {
      const prev = current.at(-1);
      const continues = prev
        && face.moduleIndex === prev.moduleIndex + 1
        && nearly(face.transform.regionStart, prev.transform.regionStart + prev.transform.regionWidth);
      if (prev && !continues) flush();
      current.push(face);
    }
    flush();
  }
  return pieces;
}

function regionsContinueHorizontally(left, right) {
  return nearly(left.transform.regionStartY, right.transform.regionStartY)
    && nearly(left.transform.regionHeight, right.transform.regionHeight)
    && nearly(right.transform.regionStartX, left.transform.regionStartX + left.transform.regionWidth);
}

function regionsContinueVertically(upper, lower) {
  return nearly(upper.transform.regionStartX, lower.transform.regionStartX)
    && nearly(upper.transform.regionWidth, lower.transform.regionWidth)
    && nearly(lower.transform.regionStartY, upper.transform.regionStartY + upper.transform.regionHeight);
}

function clusterRect(faces) {
  const pieces = [];
  for (const cells of groupBy(faces, (face) => JSON.stringify([face.imageAssetId, face.transform?.blockId ?? null])).values()) {
    const indexByKey = new Map(cells.map((cell, index) => [`${cell.moduleIndex}:${cell.stripIndex}`, index]));
    const parent = cells.map((_, index) => index);
    const find = (index) => {
      let cursor = index;
      while (parent[cursor] !== cursor) cursor = parent[cursor];
      let compress = index;
      while (parent[compress] !== cursor) {
        const next = parent[compress];
        parent[compress] = cursor;
        compress = next;
      }
      return cursor;
    };
    const union = (left, right) => {
      const rootLeft = find(left);
      const rootRight = find(right);
      if (rootLeft !== rootRight) parent[rootRight] = rootLeft;
    };
    cells.forEach((cell, index) => {
      const right = indexByKey.get(`${cell.moduleIndex + 1}:${cell.stripIndex}`);
      if (right != null && regionsContinueHorizontally(cell, cells[right])) union(index, right);
      const lower = indexByKey.get(`${cell.moduleIndex}:${cell.stripIndex + 1}`);
      if (lower != null && regionsContinueVertically(cell, cells[lower])) union(index, lower);
    });
    for (const members of groupBy(cells, (cell) => find(cells.indexOf(cell))).values()) {
      const widths = new Map();
      const heights = new Map();
      for (const member of members) {
        widths.set(member.moduleIndex, member.widthCm);
        heights.set(member.stripIndex, member.heightCm);
      }
      const made = piece(
        [...widths.values()].reduce((sum, width) => sum + width, 0),
        [...heights.values()].reduce((sum, height) => sum + height, 0),
        assetSubject(members[0].imageAssetId),
      );
      if (made) pieces.push(made);
    }
  }
  return pieces;
}

function fabricSubject(cells) {
  for (const cell of cells) {
    const asset = assetSubject(cell.fabricImageAssetId);
    if (asset) return asset;
  }
  for (const cell of cells) {
    const color = colorSubject(cell.fabricColor);
    if (color) return color;
  }
  return null;
}


function pushLooseSurface(records, module, moduleIndex, surface, slot) {
  if (!surface || typeof surface !== 'object') return;
  records.push({ module, moduleIndex, surface, slot });
}

function collectLooseFaces(modules) {
  const cells = [];
  modules.forEach((module, moduleIndex) => {
    const segment = moduleSegment(module);
    const records = [];
    if (module?.faces && typeof module.faces === 'object') {
      for (const [slot, surface] of Object.entries(module.faces)) {
        pushLooseSurface(records, module, moduleIndex, surface, slot);
      }
    }
    pushLooseSurface(records, module, moduleIndex, module?.surface, 'surface');
    pushLooseSurface(records, module, moduleIndex, module?.bodySurface, 'body');
    for (const record of records) {
      const size = panelSizeCm(record.surface);
      if (!size) continue;
      const surface = record.surface;
      cells.push({
        moduleIndex,
        segment,
        slot: record.slot,
        widthCm: size.width,
        heightCm: size.height,
        imageAssetId: surface.imageAssetId || null,
        transform: surface.imageTransform && typeof surface.imageTransform === 'object'
          ? surface.imageTransform
          : null,
        fabricGroupId: surface.fabricGroupId || null,
        fabricType: surface.fabricType === 'mesh' ? 'mesh' : 'lightbox',
        isMetalSeparator: Boolean(surface.isMetalSeparator) && !surface.isGlass,
        metalSeparatorGroupId: surface.metalSeparatorGroupId || null,
        fabricImageAssetId: surface.fabricImageAssetId || null,
        fabricColor: typeof surface.fabricColor === 'string' ? surface.fabricColor : null,
      });
    }
  });
  return cells;
}

function regionBox(cell) {
  const transform = cell.transform;
  if (!transform) return null;
  const x = Number(transform.regionStartX);
  const y = Number(transform.regionStartY);
  const width = Number(transform.regionWidth);
  const height = Number(transform.regionHeight);
  if (![x, y, width, height].every((value) => Number.isFinite(value)) || !(width > 0) || !(height > 0)) {
    return null;
  }
  return { x, y, width, height };
}

function groupedImageMode(cell) {
  const mode = cell.transform?.mode;
  return mode === 'rect-group' || mode === 'horizontal-group' || mode === 'size-group';
}

function regionsAbut(left, right) {
  const leftX2 = left.x + left.width;
  const leftY2 = left.y + left.height;
  const rightX2 = right.x + right.width;
  const rightY2 = right.y + right.height;
  const overlapX = left.x < rightX2 - REGION_EPSILON && right.x < leftX2 - REGION_EPSILON;
  const overlapY = left.y < rightY2 - REGION_EPSILON && right.y < leftY2 - REGION_EPSILON;
  if (overlapX && overlapY) return false;
  const touchX = nearly(leftX2, right.x) || nearly(rightX2, left.x);
  const touchY = nearly(leftY2, right.y) || nearly(rightY2, left.y);
  return (touchX && overlapY) || (touchY && overlapX);
}

function impliedGroupSize(cells) {
  const widths = [];
  const heights = [];
  for (const cell of cells) {
    const box = regionBox(cell);
    const width = box ? cell.widthCm / box.width : cell.widthCm;
    const height = box ? cell.heightCm / box.height : cell.heightCm;
    if (width > 0) widths.push(width);
    if (height > 0) heights.push(height);
  }
  if (!widths.length || !heights.length) return null;
  return { width: Math.max(...widths), height: Math.max(...heights) };
}

function clusterLooseRegions(cells) {
  const parent = cells.map((_, index) => index);
  const find = (index) => {
    let cursor = index;
    while (parent[cursor] !== cursor) cursor = parent[cursor];
    let compress = index;
    while (parent[compress] !== cursor) {
      const next = parent[compress];
      parent[compress] = cursor;
      compress = next;
    }
    return cursor;
  };
  const union = (left, right) => {
    const rootLeft = find(left);
    const rootRight = find(right);
    if (rootLeft !== rootRight) parent[rootRight] = rootLeft;
  };
  cells.forEach((cell, index) => {
    const box = regionBox(cell);
    if (!box) return;
    for (let other = index + 1; other < cells.length; other += 1) {
      const otherBox = regionBox(cells[other]);
      if (otherBox && regionsAbut(box, otherBox)) union(index, other);
    }
  });
  const pieces = [];
  for (const members of groupBy(cells, (cell) => find(cells.indexOf(cell))).values()) {
    const size = impliedGroupSize(members);
    const made = size
      ? piece(size.width, size.height, assetSubject(members[0].imageAssetId))
      : null;
    if (made) pieces.push(made);
  }
  return pieces;
}

function looseImagePieces(cells) {
  const printed = cells.filter((cell) => cell.imageAssetId && !cell.fabricGroupId);
  const pieces = [];
  const grouped = [];
  for (const cell of printed) {
    if (groupedImageMode(cell) && regionBox(cell)) grouped.push(cell);
    else {
      const single = piece(cell.widthCm, cell.heightCm, assetSubject(cell.imageAssetId));
      if (single) pieces.push(single);
    }
  }
  for (const bucket of groupBy(grouped, (cell) => JSON.stringify([cell.imageAssetId, cell.transform?.blockId ?? null])).values()) {
    pieces.push(...clusterLooseRegions(bucket));
  }
  return pieces;
}

function looseFabricPieces(cells, kind) {
  const members = cells.filter((cell) => cell.fabricGroupId && cell.fabricType === kind);
  const pieces = [];
  for (const group of groupBy(members, (cell) => cell.fabricGroupId).values()) {
    const subject = fabricSubject(group);
    const widths = new Set(group.map((cell) => cell.widthCm));
    const heights = new Set(group.map((cell) => cell.heightCm));
    if (widths.size === 1) {
      const made = piece(
        [...widths][0],
        group.reduce((sum, cell) => sum + cell.heightCm, 0),
        subject,
      );
      if (made) pieces.push(made);
    } else if (heights.size === 1) {
      const made = piece(
        group.reduce((sum, cell) => sum + cell.widthCm, 0),
        [...heights][0],
        subject,
      );
      if (made) pieces.push(made);
    } else {
      for (const cell of group) {
        const made = piece(cell.widthCm, cell.heightCm, subject);
        if (made) pieces.push(made);
      }
    }
  }
  return pieces;
}

function fabricPieces(faces, kind) {
  const members = faces.filter((face) => face.fabricGroupId && face.fabricType === kind);
  const pieces = [];
  for (const cells of groupBy(members, (face) => face.fabricGroupId).values()) {
    const widths = new Map();
    const heights = new Map();
    for (const cell of cells) {
      widths.set(cell.moduleIndex, cell.widthCm);
      heights.set(cell.stripIndex, cell.heightCm);
    }
    const made = piece(
      [...widths.values()].reduce((sum, width) => sum + width, 0),
      [...heights.values()].reduce((sum, height) => sum + height, 0),
      fabricSubject(cells),
    );
    if (made) pieces.push(made);
  }
  return pieces;
}

function metalRowKey(cell) {
  return Number.isInteger(cell.stripIndex) ? `s:${cell.stripIndex}` : `slot:${cell.slot ?? ''}`;
}

function isFullMetalRectangle(cells) {
  const coords = new Set(cells.map((cell) => `${cell.moduleIndex}:${metalRowKey(cell)}`));
  if (coords.size !== cells.length) return false;
  const columns = new Set(cells.map((cell) => cell.moduleIndex));
  const rows = new Set(cells.map((cell) => metalRowKey(cell)));
  return coords.size === columns.size * rows.size;
}

function metalColumnsTouch(left, right) {
  if (left.segment && right.segment) return panelModulesConnected(left.segment, right.segment);
  return Math.abs(left.moduleIndex - right.moduleIndex) === 1;
}

function metalCellsTouch(left, right) {
  if (left.moduleIndex === right.moduleIndex) {
    if (!Number.isInteger(left.stripIndex) || !Number.isInteger(right.stripIndex)) return true;
    return Math.abs(left.stripIndex - right.stripIndex) === 1;
  }
  return metalRowKey(left) === metalRowKey(right) && metalColumnsTouch(left, right);
}

// Aynı grup kimliği tek levha demek değildir: modül taşınıp arası açılırsa ya da
// satırlar arasında boşluk varsa grup, fiziksel olarak değen hücrelerin bloklarına bölünür.
function touchingMetalBlocks(cells) {
  const parent = cells.map((_, index) => index);
  const find = (index) => {
    let cursor = index;
    while (parent[cursor] !== cursor) cursor = parent[cursor];
    parent[index] = cursor;
    return cursor;
  };
  cells.forEach((cell, index) => {
    for (let other = index + 1; other < cells.length; other += 1) {
      if (metalCellsTouch(cell, cells[other])) parent[find(other)] = find(index);
    }
  });
  return [...groupBy(cells.map((cell, index) => ({ cell, root: find(index) })), (entry) => entry.root).values()]
    .map((entries) => entries.map((entry) => entry.cell));
}

function metalPieces(faces) {
  const members = faces.filter((face) => face.isMetalSeparator);
  const pieces = [];
  const groups = groupBy(members, (face) => (
    face.metalSeparatorGroupId || `solo:${face.moduleIndex}:${metalRowKey(face)}`
  )).values();
  for (const cells of [...groups].flatMap(touchingMetalBlocks)) {
    if (!isFullMetalRectangle(cells)) {
      for (const cell of cells) {
        const made = piece(cell.widthCm, cell.heightCm);
        if (made) pieces.push(made);
      }
      continue;
    }
    const widths = new Map();
    const heights = new Map();
    for (const cell of cells) {
      widths.set(cell.moduleIndex, cell.widthCm);
      heights.set(metalRowKey(cell), cell.heightCm);
    }
    const made = piece(
      [...widths.values()].reduce((sum, width) => sum + width, 0),
      [...heights.values()].reduce((sum, height) => sum + height, 0),
    );
    if (made) pieces.push(made);
  }
  return pieces;
}

function tullePieces(modules) {
  const pieces = [];
  for (const module of modules) {
    if (module?.type !== 'tulle-fabric' && module?.itemKey !== 'tulle_fabric') continue;
    const made = piece(module.widthCm, module.heightCm);
    if (made) pieces.push(made);
  }
  return pieces;
}

function foamPieces(modules) {
  const pieces = [];
  for (const module of modules) {
    if (module?.type !== 'illuminated-foam' && module?.itemKey !== 'illuminated-foam') continue;
    const made = piece(module.widthCm, module.heightCm, assetSubject(module.imageAssetId));
    if (made) pieces.push(made);
  }
  return pieces;
}

function subjectKey(item) {
  return `${item.subjectKind ?? ''}\u0000${item.subjectId ?? ''}`;
}

function lookupAssetName(assetNames, assetId) {
  if (!assetNames || !assetId) return '';
  const raw = assetNames instanceof Map ? assetNames.get(assetId) : assetNames[assetId];
  return typeof raw === 'string' ? raw.trim() : '';
}

function subjectName(item, assetNames) {
  if (item.subjectKind === 'asset') return lookupAssetName(assetNames, item.subjectId) || 'Görsel';
  if (item.subjectKind === 'color') return item.subjectId;
  return '';
}

function aggregatePieces(pieces, assetNames) {
  const bySize = new Map();
  for (const item of pieces) {
    const key = `${subjectKey(item)}\u0000${item.widthCm}\u0000${item.heightCm}`;
    const current = bySize.get(key) ?? {
      widthCm: item.widthCm,
      heightCm: item.heightCm,
      quantity: 0,
      areaM2: areaM2(item.widthCm, item.heightCm),
      subjectKind: item.subjectKind,
      subjectId: item.subjectId,
      name: subjectName(item, assetNames),
    };
    current.quantity += 1;
    current.totalAreaM2 = current.quantity * current.areaM2;
    bySize.set(key, current);
  }
  return [...bySize.values()]
    .sort((a, b) => (
      String(a.name ?? '').localeCompare(String(b.name ?? ''), 'tr')
      || b.widthCm - a.widthCm
      || b.heightCm - a.heightCm
      || b.quantity - a.quantity
    ))
    .map((line) => Object.freeze({ ...line }));
}

function section(id, label, pieces, assetNames) {
  const lines = aggregatePieces(pieces, assetNames);
  if (!lines.length) return null;
  const totalAreaM2 = lines.reduce((sum, line) => sum + line.totalAreaM2, 0);
  return Object.freeze({
    id,
    label,
    totalAreaM2,
    lines: Object.freeze(lines),
  });
}

/**
 * Print pieces for the production list.
 * Every print face uses the panel item: scene dimensions for a field when set, otherwise item dimensions.
 * A grouped image or fabric block is one piece.
 * Fabric prints are not also counted as panel images.
 */
export function collectPrintAreas(modules = [], assetNames = null) {
  const list = Array.isArray(modules) ? modules : [];
  const faces = collectStripFaces(list);
  const loose = collectLooseFaces(list);
  const built = [
    section('image', 'Dijital Baskı', [...imagePieces(faces), ...looseImagePieces(loose)], assetNames),
    section('lightbox', 'Lightbox Bezi', [...fabricPieces(faces, 'lightbox'), ...looseFabricPieces(loose, 'lightbox')], assetNames),
    section('mesh', 'Mesh - Delikli Branda', [...fabricPieces(faces, 'mesh'), ...looseFabricPieces(loose, 'mesh')], assetNames),
    section('foam', 'Işıklı Strafor / Logo', foamPieces(list), assetNames),
    section('tulle', 'Tül', tullePieces(list), assetNames),
    section('metal', 'Metal Separatör', [...metalPieces(faces), ...metalPieces(loose)], assetNames),
  ].filter(Boolean);
  const order = new Map(SECTION_DEFS.map((entry, index) => [entry.id, index]));
  built.sort((a, b) => order.get(a.id) - order.get(b.id));
  return Object.freeze(built);
}
