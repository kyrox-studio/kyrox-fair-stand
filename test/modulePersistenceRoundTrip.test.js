import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

import { listCatalogItems } from '../src/catalog.js';
import {
  MODULE_STATE_TYPES,
  createModuleStateFromDescriptor,
  normalizeModuleItemState,
} from '../src/designState.js';
import { getItem, listRegisteredItems } from '../src/items.js';
import { applyGlassOverride } from '../src/surfaceStateBinding.js';

const PLACEMENT = Object.freeze({
  xCm: 12,
  yCm: 34,
  zCm: 56,
  rotationZDeg: 90,
  wallId: 'left',
});

function cloneProjectState(value) {
  return JSON.parse(JSON.stringify(value));
}

function restoreEquivalent(state) {
  return normalizeModuleItemState(cloneProjectState(state));
}

function readFabricKeys() {
  const source = readFileSync(new URL('../src/surfaceStateBinding.js', import.meta.url), 'utf8');
  const match = source.match(/const FABRIC_KEYS = Object\.freeze\(\[([\s\S]*?)\]\);/);
  assert.ok(match, 'FABRIC_KEYS kalıcı yüzey alanlarının kaynağı olarak okunamadı.');
  const keys = [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]);
  assert.ok(keys.length > 0, 'FABRIC_KEYS boş olamaz.');
  return keys;
}

function fabricProbe(key) {
  if (key.endsWith('On')) return true;
  if (key.endsWith('Ids')) return [`${key}-probe`];
  if (key.endsWith('Color')) return '#445566';
  return `${key}-probe`;
}

function catalogItemForType(type) {
  for (const entry of listCatalogItems()) {
    const item = getItem(entry.itemKey);
    if (item?.type === type) return item;
  }
  // 0086: varyant ailesinin gizli üyesi (ör. 2 gözlü vitrin) Özellikler panelinden sahneye gelir.
  return listRegisteredItems().find((item) => item.type === type && item.variant && item.isRender !== false) ?? null;
}

function buildPlain(type) {
  if (type === 'illuminated-foam') {
    const state = createModuleStateFromDescriptor(
      { type, widthCm: 180, heightCm: 48, haloColor: '#abcdef' },
      { imageAssetId: 'foam-asset' },
    );
    assert.ok(state, 'illuminated-foam state kurulamadı.');
    return state;
  }

  const item = catalogItemForType(type);
  assert.ok(item, `${type} için katalog temsilcisi yok. Yeni katalog dışı aile ayrıca kurulmalı.`);
  const state = createModuleStateFromDescriptor(
    { itemKey: item.itemKey, type: item.type },
    { itemKey: item.itemKey },
  );
  assert.ok(state, `${type} / ${item.itemKey} state kurulamadı.`);
  return state;
}

function isImageSurface(value) {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && (Object.hasOwn(value, 'imageTransform') || Object.hasOwn(value, 'imageAssetId'));
}

function collectImageSurfaces(value, path = '', found = [], isRoot = true) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectImageSurfaces(item, `${path}[${index}]`, found, false));
    return found;
  }
  if (!value || typeof value !== 'object') return found;
  if (!isRoot && isImageSurface(value)) found.push({ path, surface: value });
  for (const [key, child] of Object.entries(value)) {
    collectImageSurfaces(child, path ? `${path}.${key}` : key, found, false);
  }
  return found;
}

function stampImageSurfaces(state, fabricKeys) {
  for (const { surface } of collectImageSurfaces(state)) {
    applyGlassOverride(surface, true);
    if (Object.hasOwn(surface, 'imageAssetId')) surface.imageAssetId = 'roundtrip-asset';
    if (surface.imageTransform && typeof surface.imageTransform === 'object') {
      surface.imageTransform = {
        ...surface.imageTransform,
        offsetX: 3,
        offsetY: 4,
        rotation: 15,
      };
    }
    for (const key of fabricKeys) surface[key] = fabricProbe(key);
  }
}

function prepare(type, fabricKeys) {
  const state = buildPlain(type);
  state.placement = { ...PLACEMENT };
  if (Object.hasOwn(state, 'shelfLightingOn')) state.shelfLightingOn = true;
  stampImageSurfaces(state, fabricKeys);
  if (state.bodySurface) {
    assert.equal(Object.hasOwn(state.bodySurface, 'imageAssetId'), false);
    assert.equal(Object.hasOwn(state.bodySurface, 'imageTransform'), false);
  }
  return state;
}

function collectLeaves(value, path = '', leaves = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectLeaves(item, `${path}[${index}]`, leaves));
    return leaves;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      collectLeaves(child, path ? `${path}.${key}` : key, leaves);
    }
    return leaves;
  }
  leaves.push({ path, value });
  return leaves;
}

function pathParts(path) {
  const parts = [];
  for (const match of path.matchAll(/([^.[\]]+)|\[(\d+)\]/g)) {
    parts.push(match[1] !== undefined ? match[1] : Number(match[2]));
  }
  return parts;
}

function getPath(root, path) {
  let cursor = root;
  for (const part of pathParts(path)) {
    if (cursor == null) return undefined;
    cursor = cursor[part];
  }
  return cursor;
}

function setPath(root, path, value) {
  const parts = pathParts(path);
  let cursor = root;
  for (let index = 0; index < parts.length - 1; index += 1) cursor = cursor[parts[index]];
  cursor[parts.at(-1)] = value;
}

function deletePath(root, path) {
  const parts = pathParts(path);
  let cursor = root;
  for (let index = 0; index < parts.length - 1; index += 1) cursor = cursor[parts[index]];
  delete cursor[parts.at(-1)];
}

function isIdentityPath(path) {
  const tail = path.split('.').pop().replace(/\[\d+\]/g, '');
  return tail === 'id' || tail === 'itemKey' || path === 'type';
}

function probeValue(value) {
  if (typeof value === 'boolean') return !value;
  if (typeof value === 'number') return value + 17;
  if (typeof value === 'string') {
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
      return value.toLowerCase() === '#123456' ? '#654321' : '#123456';
    }
    return `${value}-probe`;
  }
  if (value === null) return 'probe-asset';
  throw new TypeError(`Desteklenmeyen yaprak tipi: ${typeof value}`);
}

function classify(state) {
  const userOwned = new Map();
  const derived = new Set();
  for (const leaf of collectLeaves(state)) {
    if (!leaf.path || isIdentityPath(leaf.path)) continue;
    const probe = probeValue(leaf.value);
    const mutated = cloneProjectState(state);
    setPath(mutated, leaf.path, probe);
    const restored = restoreEquivalent(mutated);
    if (Object.is(getPath(restored, leaf.path), probe)) userOwned.set(leaf.path, probe);
    else derived.add(leaf.path);
  }
  return { userOwned, derived };
}

function assertStampedSurfacesSurvive(type, state, fabricKeys, userOwned) {
  for (const { path } of collectImageSurfaces(state)) {
    const glassPath = `${path}.isGlass`;
    assert.equal(userOwned.has(glassPath), true, `${type} ${glassPath} kayıttan sonra korunmalı.`);
    if (Object.hasOwn(getPath(state, path), 'imageAssetId')) {
      assert.equal(userOwned.has(`${path}.imageAssetId`), true, `${type} ${path}.imageAssetId`);
    }
    for (const key of ['offsetX', 'offsetY', 'rotation']) {
      const transformPath = `${path}.imageTransform.${key}`;
      if (getPath(state, transformPath) !== undefined) {
        assert.equal(userOwned.has(transformPath), true, `${type} ${transformPath}`);
      }
    }
    for (const key of fabricKeys) {
      const keyPath = `${path}.${key}`;
      const owned = userOwned.has(keyPath)
        || [...userOwned.keys()].some((candidate) => candidate.startsWith(`${keyPath}[`));
      assert.equal(owned, true, `${type} ${keyPath} kayıttan sonra korunmalı.`);
    }
  }
}

function assertMissingFieldsUseCanonical(type, prepared, canonical) {
  for (const leaf of collectLeaves(prepared)) {
    if (!leaf.path || isIdentityPath(leaf.path) || leaf.path.includes('[')) continue;
    const removed = cloneProjectState(prepared);
    deletePath(removed, leaf.path);
    const restored = restoreEquivalent(removed);
    if (getPath(restored, leaf.path) === undefined) continue;
    assert.deepEqual(
      getPath(restored, leaf.path),
      getPath(canonical, leaf.path),
      `${type} eksik ${leaf.path} kanonik taze değere dönmeli.`,
    );
  }
}

function assertFamily(type, fabricKeys) {
  const prepared = prepare(type, fabricKeys);
  const canonical = restoreEquivalent(buildPlain(type));
  const baseline = restoreEquivalent(prepared);

  assert.equal(baseline.id, prepared.id, `${type} id`);
  assert.equal(baseline.type, type, `${type} type`);
  assert.equal(baseline.itemKey, canonical.itemKey, `${type} itemKey`);
  assert.deepEqual(baseline.placement, prepared.placement, `${type} placement`);

  if (Object.hasOwn(prepared, 'shelfLightingOn')) {
    assert.equal(baseline.shelfLightingOn, true, `${type} shelfLightingOn`);
  }

  for (const key of ['modelFile', 'modelRotationYDeg', 'visualRotationYDeg', 'preserveModelScale', 'haloColor', 'wallGapCm']) {
    if (!Object.hasOwn(prepared, key)) continue;
    assert.deepEqual(getPath(baseline, key), prepared[key], `${type} ${key}`);
  }

  const classification = classify(prepared);
  if (type === 'tv') {
    assert.equal(classification.derived.has('videoWallRows'), true, 'tv videoWallRows katalogdan türetilir.');
    assert.equal(classification.derived.has('videoWallCols'), true, 'tv videoWallCols katalogdan türetilir.');
  }
  if (Object.hasOwn(prepared, 'shelfLightingOn')) {
    assert.equal(classification.userOwned.has('shelfLightingOn'), true, `${type} shelfLightingOn`);
  }
  for (const key of ['modelFile', 'modelRotationYDeg', 'visualRotationYDeg', 'preserveModelScale']) {
    if (!Object.hasOwn(prepared, key)) continue;
    assert.equal(classification.userOwned.has(key), true, `${type} ${key}`);
  }
  if (type === 'illuminated-foam') {
    for (const key of ['haloColor', 'imageAssetId', 'wallGapCm', 'widthCm', 'heightCm']) {
      assert.equal(classification.userOwned.has(key), true, `${type} ${key}`);
    }
  }
  for (const key of ['placement.wallId', 'placement.rotationZDeg', 'placement.zCm']) {
    assert.equal(classification.userOwned.has(key), true, `${type} ${key}`);
  }

  assertStampedSurfacesSurvive(type, prepared, fabricKeys, classification.userOwned);

  const customized = cloneProjectState(prepared);
  for (const [path, probe] of classification.userOwned) setPath(customized, path, probe);
  const restored = restoreEquivalent(customized);
  const derivedBaseline = restoreEquivalent(prepared);

  for (const [path, probe] of classification.userOwned) {
    assert.deepEqual(getPath(restored, path), probe, `${type} kullanıcı alanı ${path}`);
  }
  const boxFaceSizeSource = {
    'faces.front.widthCm': 'widthCm',
    'faces.front.heightCm': 'heightCm',
    'faces.back.widthCm': 'widthCm',
    'faces.back.heightCm': 'heightCm',
    'faces.left.widthCm': 'depthCm',
    'faces.left.heightCm': 'heightCm',
    'faces.right.widthCm': 'depthCm',
    'faces.right.heightCm': 'heightCm',
    // Üst yüz yataydır: en × derinlik.
    'faces.top.widthCm': 'widthCm',
    'faces.top.heightCm': 'depthCm',
  };
  for (const path of classification.derived) {
    if (type === 'box-block' && boxFaceSizeSource[path]) {
      assert.equal(
        getPath(restored, path),
        getPath(restored, boxFaceSizeSource[path]),
        `${type} yüz ölçüsü ${path} modül ölçüsünü izlemeli`,
      );
      continue;
    }
    assert.deepEqual(
      getPath(restored, path),
      getPath(derivedBaseline, path),
      `${type} türetilen alan ${path}`,
    );
  }

  assertMissingFieldsUseCanonical(type, prepared, canonical);
}

test('F-022 her modül state ailesi anlamsal kayıt gidiş-dönüşünü korur', () => {
  const fabricKeys = readFabricKeys();
  const covered = [];
  for (const type of MODULE_STATE_TYPES) {
    assertFamily(type, fabricKeys);
    covered.push(type);
  }
  assert.deepEqual([...covered].sort(), [...MODULE_STATE_TYPES].sort());
});
