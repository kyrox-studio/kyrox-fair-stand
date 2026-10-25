import { getItem } from './items.js';
import { getModuleDefaultRotationDeg } from './moduleBehavior.js';
import { createModulePlacement, isVerticalModuleRotation } from './modulePlacement.js';

// Sahne kurulurken gelen hazır mobilya takımı. Ürünler katalogdaki mevcut Item'lardır;
// ölçü Item master `dimensions`, açı Item `defaultRotationDeg` alanından okunur
// (katalogdan sahneye bırakılan öğe gibi ön yüzü koridora bakar).
export const AUTO_FURNITURE_ITEM_KEYS = Object.freeze({
  counter: 'desk_banko_100',
  stool: 'furniture_bar_stool_classic',
  tableSet: 'furniture_table_chair_set_eames',
  brochure: 'brochure_stand',
  plant: 'extra_indoor_plant_1',
});

// Stand kenarına ve öğeler arasına bırakılan pay (cm).
const EDGE_GAP_CM = 30;
const ITEM_GAP_CM = 20;
// Tabure bankonun hemen arkasında durur.
const STOOL_GAP_CM = 10;

function requireItem(itemKey) {
  const item = getItem(itemKey);
  if (!item?.dimensions) {
    throw new TypeError(`Missing Item master dimensions for ${itemKey}.`);
  }
  return item;
}

/** Zemindeki ayak izi ölçüsü: 90/270'te genişlik ve derinlik yer değiştirir. */
function resolveFurniture(role) {
  const itemKey = AUTO_FURNITURE_ITEM_KEYS[role];
  const item = requireItem(itemKey);
  const widthCm = Number(item.dimensions.widthCm);
  const depthCm = Number(item.dimensions.depthCm);
  const rotationZDeg = getModuleDefaultRotationDeg({ type: item.type, itemKey });
  const vertical = isVerticalModuleRotation(rotationZDeg);
  return {
    item,
    itemKey,
    widthCm,
    depthCm,
    rotationZDeg,
    spanXCm: vertical ? depthCm : widthCm,
    spanYCm: vertical ? widthCm : depthCm,
  };
}

function footprint(furniture, centerXCm, centerYCm) {
  return {
    minX: centerXCm - furniture.spanXCm / 2,
    maxX: centerXCm + furniture.spanXCm / 2,
    minY: centerYCm - furniture.spanYCm / 2,
    maxY: centerYCm + furniture.spanYCm / 2,
  };
}

function rectsOverlap(a, b, gapCm) {
  return a.minX < b.maxX + gapCm
    && b.minX < a.maxX + gapCm
    && a.minY < b.maxY + gapCm
    && b.minY < a.maxY + gapCm;
}

/** Sahne serbest yerleşimi: yatayda xCm sol kenar + yCm orta çizgi; dikeyde xCm orta çizgi + yCm alt kenar. */
function placementFromCenter(furniture, centerXCm, centerYCm) {
  const vertical = isVerticalModuleRotation(furniture.rotationZDeg);
  return createModulePlacement({
    xCm: vertical ? centerXCm : centerXCm - furniture.widthCm / 2,
    yCm: vertical ? centerYCm - furniture.widthCm / 2 : centerYCm,
    rotationZDeg: furniture.rotationZDeg,
    wallId: 'free',
    itemKey: furniture.itemKey,
  });
}

/**
 * Banko + bar taburesi, Eames masa takımı, broşürlük ve yapay çiçek yerleşimi.
 * Arka duvar y = 0, koridor (açık ön cephe) y = standY. Bir öğe aday noktalarının
 * hiçbirine sığmazsa (küçük stand / depo) atlanır ve `skipped` içinde döner.
 */
export function planAutomaticFurniture({ standXCm, standYCm, depot = null } = {}) {
  const standX = Number(standXCm);
  const standY = Number(standYCm);
  if (!Number.isFinite(standX) || !Number.isFinite(standY) || standX <= 0 || standY <= 0) {
    return { ok: false, message: 'Stand ölçüsü geçersiz.' };
  }

  const occupied = [];
  if (depot?.ok) {
    occupied.push({
      minX: Number(depot.originXCm),
      maxX: Number(depot.originXCm) + Number(depot.widthCm),
      minY: Number(depot.originYCm),
      maxY: Number(depot.originYCm) + Number(depot.depthCm),
    });
  }

  const specs = [];
  const skipped = [];

  function fits(rect, ignore = null) {
    if (rect.minX < EDGE_GAP_CM || rect.minY < EDGE_GAP_CM) return false;
    if (rect.maxX > standX - EDGE_GAP_CM || rect.maxY > standY - EDGE_GAP_CM) return false;
    return !occupied.some((other) => other !== ignore && rectsOverlap(rect, other, ITEM_GAP_CM));
  }

  function place(role, centers, { ignore = null } = {}) {
    const furniture = resolveFurniture(role);
    for (const center of centers) {
      const rect = footprint(furniture, center.xCm, center.yCm);
      if (!fits(rect, ignore)) continue;
      occupied.push(rect);
      specs.push({
        kind: furniture.item.type,
        role,
        itemKey: furniture.itemKey,
        widthCm: furniture.widthCm,
        depthCm: furniture.depthCm,
        placement: placementFromCenter(furniture, center.xCm, center.yCm),
      });
      return rect;
    }
    skipped.push(role);
    return null;
  }

  // 1 m banko: ön cephede solda.
  const counter = resolveFurniture('counter');
  const counterY = standY - EDGE_GAP_CM - counter.spanYCm / 2;
  const counterRect = place('counter', [
    { xCm: EDGE_GAP_CM + counter.spanXCm / 2, yCm: counterY },
    { xCm: standX / 2, yCm: counterY },
  ]);

  // Bar taburesi: bankonun hemen arkasında, ortasında (bankoyla arası STOOL_GAP_CM).
  if (counterRect) {
    const stool = resolveFurniture('stool');
    place('stool', [{
      xCm: (counterRect.minX + counterRect.maxX) / 2,
      yCm: counterRect.minY - STOOL_GAP_CM - stool.spanYCm / 2,
    }], { ignore: counterRect });
  } else {
    skipped.push('stool');
  }

  // Yapay çiçek: ön sağ köşe.
  const plant = resolveFurniture('plant');
  place('plant', [{
    xCm: standX - EDGE_GAP_CM - plant.spanXCm / 2,
    yCm: standY - EDGE_GAP_CM - plant.spanYCm / 2,
  }]);

  // Broşürlük: ön cephe ortası; sığmazsa bankonun sağına kayar.
  const brochure = resolveFurniture('brochure');
  const brochureY = standY - EDGE_GAP_CM - brochure.spanYCm / 2;
  const brochureXs = [standX / 2];
  if (counterRect) brochureXs.push(counterRect.maxX + ITEM_GAP_CM + brochure.spanXCm / 2);
  place('brochure', brochureXs.map((xCm) => ({ xCm, yCm: brochureY })));

  // Eames masa takımı: arka bölge; depo/ön sıra yüzünden sığmazsa sıradaki adaya geçer.
  const table = resolveFurniture('tableSet');
  const tableXs = [
    standX * 0.35,
    standX * 0.65,
    standX / 2,
    EDGE_GAP_CM + table.spanXCm / 2,
    standX - EDGE_GAP_CM - table.spanXCm / 2,
  ];
  const tableYs = [EDGE_GAP_CM + table.spanYCm / 2, standY / 2];
  place('tableSet', tableYs.flatMap((yCm) => tableXs.map((xCm) => ({ xCm, yCm }))));

  return { ok: true, specs, skipped };
}
