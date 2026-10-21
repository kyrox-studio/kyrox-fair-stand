import { getCommercialItemForType, getFloorItem, getFurnitureClusterQuantity, getFurnitureItemForType, getItem } from './items.js';

export const DEFAULT_SELECTION_HINT = 'Bir panel seç; Ctrl/Cmd + tık ile panelleri çoklu seç.';

function result(message, {
  foamModuleId = null,
  foamControlsVisible = false,
  foamColor = '#ffffff',
} = {}) {
  return { message, foamModuleId, foamControlsVisible, foamColor };
}

export function describeSurfaceSelection(surfaces, modules = []) {
  if (!surfaces?.length) return result(DEFAULT_SELECTION_HINT);

  if (surfaces.length === 1) {
    const surface = surfaces[0];
    const { moduleIndex, widthCm, stripNumber, moduleType } = surface.userData;

    if (moduleType === 'counter') {
      const faceLabel = surface.userData.surfaceRole === 'front'
        ? 'ön'
        : (surface.userData.surfaceRole === 'left'
          ? 'sol yan'
          : (surface.userData.surfaceRole === 'return' ? 'L dönüş' : 'sağ yan'));
      const counterLabel = surface.userData.counterShape === 'L'
        ? ('Köşe Banko ' + widthCm + '×' + (Number(surface.userData.depthCm) || widthCm))
        : ('Banko ' + widthCm + ' cm');
      return result('Modül ' + (moduleIndex + 1) + ' · ' + counterLabel + ' · ' + faceLabel + ' cephe · renk + görsel uygulanabilir.');
    }

    if (moduleType === 'base-wall') {
      const role = surface.userData.surfaceRole;
      const label = role === 'front'
        ? 'baza ön panel'
        : (role === 'left'
          ? 'baza sol yan panel'
          : (role === 'right' ? 'baza sağ yan panel' : `alttan ${stripNumber}. duvar paneli`));
      return result('Modül ' + (moduleIndex + 1) + ' · Panel Bazalı ' + widthCm + ' cm · ' + label + ' · renk + görsel uygulanabilir.');
    }

    if (moduleType === 'base') {
      const faceLabel = surface.userData.surfaceRole === 'front'
        ? 'ön'
        : (surface.userData.surfaceRole === 'left' ? 'sol yan' : 'sağ yan');
      return result('Modül ' + (moduleIndex + 1) + ' · Baza ' + widthCm + ' cm · ' + faceLabel + ' panel · renk + görsel uygulanabilir.');
    }

    if (moduleType === 'separator') {
      return result(`Modül ${moduleIndex + 1} · Separatör ${widthCm} cm · yalnızca renk uygulanabilir.`);
    }

    if (moduleType === 'door') {
      return result(surface.userData.surfaceRole === 'door'
        ? `Modül ${moduleIndex + 1} · Kapı ${widthCm} cm · kapı yüzeyi · renk + görsel uygulanabilir.`
        : `Modül ${moduleIndex + 1} · Kapı ${widthCm} cm · üst ${stripNumber}. panel · renk + görsel uygulanabilir.`);
    }

    if (moduleType === 'showcase-3' || moduleType === 'showcase-2') {
      const eyeCount = moduleType === 'showcase-3' ? 3 : 2;
      if (surface.userData.surfaceRole === 'showcase-body') {
        return result(`Modül ${moduleIndex + 1} · ${eyeCount} Gözlü Vitrin ${widthCm} cm · vitrin gövdesi · 4 sunta birlikte renklendirilir.`);
      }
      return result(`Modül ${moduleIndex + 1} · ${eyeCount} Gözlü Vitrin ${widthCm} cm · alttan ${stripNumber}. panel · renk + görsel uygulanabilir.`);
    }

    if (moduleType === 'shelf') {
      return result('Modül ' + (moduleIndex + 1) + ' · Raf ' + widthCm + ' cm.');
    }

    if (moduleType === 'sofa-set-classic') {
      const item = getFurnitureItemForType('sofa-set-classic');
      const doubleItem = getItem('furniture_sofa_double_classic');
      const singleItem = getItem('furniture_sofa_single_classic');
      const doubleQty = getFurnitureClusterQuantity(item, doubleItem.itemKey);
      const singleQty = getFurnitureClusterQuantity(item, singleItem.itemKey);
      return result('Modül ' + (moduleIndex + 1) + ' · ' + item.name + ' · ' + doubleQty + ' ' + doubleItem.name + ' · ' + singleQty + ' ' + singleItem.name + ' · koltuk gövde rengi değiştirilebilir · sehpa sabittir.');
    }

    if (moduleType === 'sofa-single-classic' || moduleType === 'sofa-double-classic') {
      const item = getFurnitureItemForType(moduleType);
      return result('Modül ' + (moduleIndex + 1) + ' · ' + item.name + ' · koltuk gövde rengi değiştirilebilir.');
    }

    if (moduleType === 'coffee-table-classic') {
      const item = getFurnitureItemForType('coffee-table-classic');
      return result('Modül ' + (moduleIndex + 1) + ' · ' + item.name + ' · sehpa sabittir.');
    }

    if (moduleType === 'table-chair-set-eames') {
      return result('Modül ' + (moduleIndex + 1) + ' · Eames Masa Sandalye Takımı · 4 Eames sandalye · sandalye gövde rengi değiştirilebilir · cam masa sabittir.');
    }

    if (moduleType === 'chair') {
      const item = getFurnitureItemForType('chair');
      return result('Modül ' + (moduleIndex + 1) + ' · ' + item.name + ' · sandalye gövde rengi değiştirilebilir.');
    }

    if (moduleType === 'table-glass') {
      const item = getItem(modules[moduleIndex]?.itemKey) ?? getFurnitureItemForType('table-glass');
      return result('Modül ' + (moduleIndex + 1) + ' · ' + item.name + ' · cam masa sabittir.');
    }

    if (moduleType === 'bar-stool') {
      return result('Modül ' + (moduleIndex + 1) + ' · Bar Taburesi · GLB model.');
    }

    if (moduleType === 'indoor-plant-1' && modules[moduleIndex]?.surface) {
      return result('Modül ' + (moduleIndex + 1) + ' · Uzun Saksı ' + (Number(modules[moduleIndex]?.widthCm) || '') + ' · saksı gövdesi · renk uygulanabilir.');
    }

    const commercialItem = getCommercialItemForType(moduleType);
    if (commercialItem) {
      const state = modules[moduleIndex] ?? {};
      const dims = commercialItem.dimensions;
      return result(`Modül ${moduleIndex + 1} · ${commercialItem.name} · ${state.widthCm ?? dims.widthCm} × ${state.depthCm ?? dims.depthCm} × ${state.heightCm ?? dims.heightCm} cm · GLB model.`);
    }

    if (moduleType === 'illuminated-foam') {
      const foamState = modules[moduleIndex];
      const foamColor = foamState?.haloColor || '#ffffff';
      return result(
        `Modül ${moduleIndex + 1} · Işıklı Strafor · ${Number(foamState?.widthCm) || 0} × ${Number(foamState?.heightCm) || 0} cm · ${Number(foamState?.depthCm) || 3.5} cm kalınlık · ışık ${foamColor}.`,
        {
          foamModuleId: foamState?.id ?? null,
          foamControlsVisible: true,
          foamColor,
        },
      );
    }

    if (moduleType === 'tv') {
      const tvState = modules[moduleIndex];
      const tvItem = getItem(tvState?.itemKey);
      const widthCm = Number(tvState?.widthCm);
      const heightCm = Number(tvState?.heightCm);
      const label = tvItem?.name ?? 'TV';
      return result(`Modül ${moduleIndex + 1} · ${label} · ${widthCm} × ${heightCm} cm ekran.`);
    }

    if (moduleType === 'led-floodlight') {
      const lightItem = getItem('led_floodlight');
      return result(`Modül ${moduleIndex + 1} · ${lightItem.name} · ${lightItem.dimensions.mountHeightCm} cm üst profile bağlı aydınlatma.`);
    }

    return result(`Modül ${moduleIndex + 1} · ${widthCm} cm · alttan ${stripNumber}. panel · Ctrl/Cmd + tık ile çoklu seç.`);
  }

  const allCounterPanels = surfaces.every(
    (surface) => surface.userData.moduleType === 'counter',
  );
  if (allCounterPanels) {
    const widthCm = surfaces[0]?.userData.widthCm ?? '';
    return result(`Banko ${widthCm} cm · ${surfaces.length} panel seçili · renk + görsel toplu uygulanabilir.`);
  }

  const selectedFabricGroupIds = new Set(
    surfaces.map((surface) => surface.userData.surfaceState?.fabricGroupId).filter(Boolean),
  );
  if (selectedFabricGroupIds.size === 1
    && surfaces.every((surface) => surface.userData.surfaceState?.fabricGroupId)) {
    const fabricType = surfaces[0]?.userData.surfaceState?.fabricType === 'mesh'
      ? 'mesh'
      : 'lightbox';
    return result(fabricType === 'mesh'
      ? 'Tek parça Mesh (Delikli) Branda seçili · renk + görsel uygulanabilir.'
      : 'Tek parça Lightbox Kumaş seçili · renk + görsel uygulanabilir.');
  }

  return result(`${surfaces.length} panel seçili · Lightbox Kumaş / Mesh Branda için eksiksiz dikdörtgen panel grubunu seç.`);
}

export function describeFloorSelection({ selected, floorType, paintable } = {}) {
  if (!selected) return null;
  const label = getFloorItem(floorType)?.name ?? 'Zemin';
  return paintable
    ? label + ' zemini seçili · mevcut Aktif renk ile boyanabilir.'
    : label + ' zemini seçili · bu zemin tipi boyanamaz.';
}

export function describeFloorAreaSelection({ selected, floorType, paintable } = {}) {
  if (!selected) return null;
  const label = getFloorItem(floorType)?.name ?? 'Zemin';
  return paintable
    ? label + ' zemin alanı seçili · mevcut Aktif renk ile boyanabilir.'
    : label + ' zemin alanı seçili · bu zemin tipi boyanamaz.';
}
