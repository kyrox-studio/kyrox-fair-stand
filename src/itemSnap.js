import {
  getItem,
  getItemSnapSpec,
  itemProvidesSnapRule,
  resolveItemDefaultZCm,
  resolveItemSnapGeometry,
  resolveSceneDimensions,
} from './items.js';
import { getPlacementInterval } from './modulePlacement.js';
import {
  listFlatPanelModuleSeamHeightsCm,
  listInternalSeamHeightsCm,
  resolveModuleBandPitchCm,
} from './wallPanelBand.js';

function hostHeightCm(host) {
  const item = host?.itemKey ? getItem(host.itemKey) : null;
  const scene = item ? resolveSceneDimensions(item) : {};
  const height = Number(host.heightCm ?? scene.heightCm);
  return Number.isFinite(height) ? height : 0;
}

function providerHeightCm(provider) {
  if (!provider) return 0;
  const scene = resolveSceneDimensions(provider);
  const height = Number(scene.heightCm ?? provider.dimensions?.heightCm);
  return Number.isFinite(height) ? height : 0;
}

function distanceSq(host, xCm, yCm) {
  const dx = Number(host.placement?.xCm ?? 0) - Number(xCm);
  const dy = Number(host.placement?.yCm ?? 0) - Number(yCm);
  return dx * dx + dy * dy;
}

/** Hosts that provide the required snap rule (self or recipe child). */
function listSnapHosts(modules, spec, movingId) {
  const hosts = [];
  for (const module of modules ?? []) {
    if (!module || module.id === movingId) continue;
    const item = module.itemKey ? getItem(module.itemKey) : null;
    if (itemProvidesSnapRule(item, spec)) {
      hosts.push(module);
      continue;
    }
    for (const row of item?.composition?.items ?? []) {
      const child = getItem(row.itemKey);
      if (itemProvidesSnapRule(child, spec)) {
        hosts.push(module);
        break;
      }
    }
  }
  return hosts;
}

function pickNearestHost(hosts, placement) {
  if (!hosts.length) return null;
  const wallId = placement?.wallId;
  const sameWall = wallId && wallId !== 'free'
    ? hosts.filter((host) => !host.placement?.wallId || host.placement.wallId === wallId || host.placement.wallId === 'free')
    : hosts;
  const pool = sameWall.length ? sameWall : hosts;
  const xCm = Number(placement?.xCm ?? 0);
  const yCm = Number(placement?.yCm ?? 0);
  return [...pool].sort((left, right) => distanceSq(left, xCm, yCm) - distanceSq(right, xCm, yCm))[0];
}

/**
 * Provider on host: free leaf (virtual=false) or recipe BOM child (virtual=true).
 * Virtual = sanal hat; mesh instance yok, leaf ölçü / defaultZ ile türetilir.
 */
function resolveProvider(host, spec) {
  const item = host?.itemKey ? getItem(host.itemKey) : null;
  if (itemProvidesSnapRule(item, spec)) {
    const geometry = resolveItemSnapGeometry(item, spec);
    return { provider: item, face: geometry.face ?? spec?.face, edge: geometry.edge ?? spec?.edge, virtual: false };
  }
  for (const row of item?.composition?.items ?? []) {
    const child = getItem(row.itemKey);
    if (itemProvidesSnapRule(child, spec)) {
      const geometry = resolveItemSnapGeometry(child, spec);
      return {
        provider: child,
        face: geometry.face ?? spec?.face,
        edge: geometry.edge ?? spec?.edge,
        virtual: true,
      };
    }
  }
  return { provider: null, face: null, edge: null, virtual: false };
}

/** Host-local panel band seam heights (cm from host bottom). Recipe strips / pitch. */
export function listVirtualShelfRailHeightsCm(host) {
  const fromStrips = listFlatPanelModuleSeamHeightsCm(host);
  if (Array.isArray(host?.strips)) return fromStrips;
  const heightCm = hostHeightCm(host);
  const pitchCm = resolveModuleBandPitchCm(host);
  const stripCount = Math.max(1, Math.floor(heightCm / pitchCm));
  return listInternalSeamHeightsCm({
    stripCount,
    pitchCm,
    minCm: 0,
    maxCm: heightCm,
  });
}

/**
 * top-rail Z (yerden cm): free leaf → host.z + host.h;
 * recipe child → leaf defaultZ + leaf height, host span içindeyse; değilse host tavanı.
 */
export function resolveVirtualTopRailZCm(host, provider) {
  const hostZ = Number(host?.placement?.zCm) || 0;
  const hostTop = hostZ + hostHeightCm(host);
  if (!provider) return hostTop;
  // Reçete parçasının (profil) DB yüksekliği 350 cm duvara göredir; türetilmiş duvar
  // yüksekliğinde (wall_100_500 …) hat aynı farkla kayar.
  const hostItem = host?.itemKey ? getItem(host.itemKey) : null;
  const baseItem = hostItem?.wallHeightBaseItemKey ? getItem(hostItem.wallHeightBaseItemKey) : null;
  const heightShiftCm = baseItem
    ? Number(hostItem.sceneDimensions?.heightCm) - Number(baseItem.sceneDimensions?.heightCm)
    : 0;
  const railTop = resolveItemDefaultZCm(provider) + providerHeightCm(provider) + (Number.isFinite(heightShiftCm) ? heightShiftCm : 0);
  if (!Number.isFinite(railTop)) return hostTop;
  const hostBottom = hostZ;
  if (railTop >= hostBottom - 0.5 && railTop <= hostTop + 0.5) return railTop;
  return hostTop;
}

/**
 * shelf-rail / panel band: host-local seam’e en yakın hat → yerden Z.
 * placement.zCm ipucu (yerden); yoksa orta bant.
 */
export function resolveVirtualShelfRailZCm(host, placement) {
  const hostZ = Number(host?.placement?.zCm) || 0;
  const seams = listVirtualShelfRailHeightsCm(host);
  if (!seams.length) return hostZ + hostHeightCm(host);
  const hintLocal = Number.isFinite(Number(placement?.zCm))
    ? Number(placement.zCm) - hostZ
    : hostHeightCm(host) / 2;
  let best = seams[0];
  let bestDist = Math.abs(best - hintLocal);
  for (const seam of seams) {
    const dist = Math.abs(seam - hintLocal);
    if (dist < bestDist) {
      best = seam;
      bestDist = dist;
    }
  }
  return hostZ + best;
}

function isShelfRailMount({ face, edge, spec }) {
  if (spec?.requires === 'shelf-rail') return true;
  return (face === 'front' || face === 'back') && edge === 'top';
}

function isTopRailMount({ face, edge, spec }) {
  if (spec?.requires === 'top-rail') return true;
  return face === 'top' || (face == null && edge === 'top');
}

/**
 * Z from provider face/edge + sanal hat ince ayarı.
 * - shelf-rail / front+top → panel band seam (AABB tavan değil)
 * - top-rail recipe child → profile defaultZ + height
 * - free leaf top → host box top
 */
function mountZCm({ host, provider, face, edge, spec, placement, virtual }) {
  if (isShelfRailMount({ face, edge, spec })) {
    return resolveVirtualShelfRailZCm(host, placement);
  }
  if (virtual && isTopRailMount({ face, edge, spec })) {
    return resolveVirtualTopRailZCm(host, provider);
  }
  const zCm = Number(host.placement?.zCm) || 0;
  const heightCm = hostHeightCm(host);
  if (face === 'top' || (face === 'front' && edge === 'top') || (face === 'back' && edge === 'top')) {
    return zCm + heightCm;
  }
  if (face === 'bottom' || edge === 'bottom') return zCm;
  return zCm + heightCm;
}

/** Snap moving item to nearest host that provides the required rule. Null if no spec/host. */
export function snapPlacementToItemAnchor(moduleState, placement, modules = []) {
  const spec = getItemSnapSpec(moduleState);
  if ((!spec?.requiresRuleId && !spec?.requires) || !placement) return null;
  const host = pickNearestHost(listSnapHosts(modules, spec, moduleState?.id), placement);
  if (!host) return null;

  const { provider, face, edge, virtual } = resolveProvider(host, spec);
  const next = {
    ...placement,
    zCm: mountZCm({ host, provider, face, edge, spec, placement, virtual }),
  };
  if (edge === 'left' || edge === 'right') {
    const widthCm = Number(moduleState.widthCm) || 0;
    const interval = getPlacementInterval(host.placement, host.widthCm);
    if (interval) {
      const startCm = edge === 'left' ? interval.startCm : interval.endCm - widthCm;
      if (interval.axis === 'y') next.yCm = startCm;
      else next.xCm = startCm;
    }
  }
  return next;
}
