/**
 * Renderer mesh'i kalıcı yüzey durumunun kopyasını tutar.
 * Kalıcı yazı yalnız bu bağın persistent nesnesi (designState / kayıt ağacı) üzerinedir.
 */

const FABRIC_KEYS = Object.freeze([
  'fabricGroupId',
  'fabricColor',
  'fabricImageAssetId',
  'fabricImageFit',
  'fabricImageWidthCm',
  'fabricImageHeightCm',
  'fabricLightingOn',
  'fabricType',
  'fabricOwnerSurfaceIds',
  'fabricOwnerModuleIds',
]);

export function cloneSurfaceStateForRenderer(canonical) {
  if (!canonical || typeof canonical !== 'object') return null;
  return structuredClone(canonical);
}

export function bindRendererSurfaceState(canonical) {
  if (!canonical || typeof canonical !== 'object') {
    return {
      surfaceState: null,
      persistentSurfaceState: null,
    };
  }
  return {
    persistentSurfaceState: canonical,
    surfaceState: cloneSurfaceStateForRenderer(canonical),
  };
}

export function syncRendererSurfaceState(rendererCopy, persistent) {
  if (!rendererCopy || !persistent || typeof rendererCopy !== 'object' || typeof persistent !== 'object') {
    return rendererCopy ?? null;
  }
  Object.keys(rendererCopy).forEach((key) => {
    if (!(key in persistent)) delete rendererCopy[key];
  });
  Object.entries(persistent).forEach(([key, value]) => {
    rendererCopy[key] = value != null && typeof value === 'object'
      ? structuredClone(value)
      : value;
  });
  return rendererCopy;
}

export function applyGlassOverride(surfaceState, isGlass) {
  if (!surfaceState) return null;
  surfaceState.isGlass = Boolean(isGlass);
  if (surfaceState.isGlass) {
    surfaceState.isMetalSeparator = false;
    delete surfaceState.metalSeparatorGroupId;
  }
  return surfaceState;
}

export function applyMetalSeparatorOverride(surfaceState, enabled) {
  if (!surfaceState) return null;
  surfaceState.isMetalSeparator = Boolean(enabled);
  if (surfaceState.isMetalSeparator) surfaceState.isGlass = false;
  else delete surfaceState.metalSeparatorGroupId;
  return surfaceState;
}

export function clearFabricFields(surfaceState) {
  if (!surfaceState) return null;
  FABRIC_KEYS.forEach((key) => {
    delete surfaceState[key];
  });
  return surfaceState;
}

// Kopya grubu kendi yüzey/blok kimliklerini taşır; dosya varlığı ortak kalabilir.
export function remapCopiedSurfaceGroups(originals, copies, makeId = prefix => `${prefix}-${globalThis.crypto.randomUUID()}`) {
  const surfaces = module => [
    ...(module.strips ?? []), ...(module.backStrips ?? []),
    ...(module.renderParts?.tops ?? []), ...Object.values(module.faces ?? {}),
    module.bodySurface, module.surface,
  ].filter(Boolean);
  const pairs = originals.flatMap((module, index) => {
    const source = surfaces(module);
    return surfaces(copies[index]).map((copy, surfaceIndex) => ({ source: source[surfaceIndex], copy }));
  });
  const moduleIds = new Map(originals.map((module, index) => [module.id, copies[index].id]));
  const surfaceIds = new Map(pairs.map(({ source, copy }) => [source.id, copy.id]));
  const ids = new Map();
  const renamed = (kind, id) => {
    const key = `${kind}:${id}`;
    if (!ids.has(key)) ids.set(key, makeId(kind));
    return ids.get(key);
  };
  const fabrics = new Map();
  pairs.forEach(({ source, copy }) => {
    if (source.imageAssetId && copy.imageTransform) {
      const transform = source.imageTransform ?? {};
      const grouped = ['rect-group', 'horizontal-group', 'size-group'].includes(transform.mode);
      const legacyKey = grouped
        ? JSON.stringify([source.imageAssetId, transform.mode, transform.groupAspect, transform.groupWidthCm, transform.groupHeightCm])
        : source.id;
      copy.imageTransform.blockId = renamed('image-block', transform.blockId ?? legacyKey);
    }
    if (source.metalSeparatorGroupId) copy.metalSeparatorGroupId = renamed('metal', source.metalSeparatorGroupId);
    if (source.fabricGroupId) {
      copy.fabricGroupId = renamed('fabric', source.fabricGroupId);
      if (!fabrics.has(source.fabricGroupId)) fabrics.set(source.fabricGroupId, []);
      fabrics.get(source.fabricGroupId).push(copy);
      copy.fabricOwnerSurfaceIds = (source.fabricOwnerSurfaceIds ?? [])
        .map(id => surfaceIds.get(id)).filter(Boolean);
      copy.fabricOwnerModuleIds = (source.fabricOwnerModuleIds ?? [])
        .map(id => moduleIds.get(id)).filter(Boolean);
    }
  });
  fabrics.forEach(group => {
    const owners = [...new Set(group.map(surface => surface.id))];
    group.forEach(surface => { surface.fabricOwnerSurfaceIds = [...owners]; });
  });
}
