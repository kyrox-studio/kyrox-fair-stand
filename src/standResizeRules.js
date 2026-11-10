// Yeniden boyutlandırma motorunun stand tipine (`boothType`) özel kural katmanı.
// Motor (`standResize.js`) hangi öğenin nasıl değişeceğini buradaki kurallardan sorar;
// sistem bilgisi (hangi ürün hangi yükseklikte neye döner) yalnız burada durur.
// Bugün yalnız Maksima kuralı vardır; Paket ve Özel Tasarım kararları çıkınca eklenir.

import { WALL_LINE_HEIGHTS_CM, getItem, listRegisteredItems, resolveWallItemKeyForHeight } from './items.js';

// Dikmenin gerçek boyu = duvar hattı yüksekliği × 0,99 (247,5 / 297 / 346,5 / 396 / 445,5 / 495).
const UPRIGHT_LINE_RATIO = 0.99;

function uprightLineHeightCm(item) {
  const realHeight = Number(item?.dimensions?.heightCm);
  if (item?.type !== 'upright' || !Number.isFinite(realHeight)) return null;
  const line = Math.round(realHeight / UPRIGHT_LINE_RATIO);
  return Math.abs(line * UPRIGHT_LINE_RATIO - realHeight) < 0.01 ? line : null;
}

function findUprightItemKeyForLine(lineHeightCm) {
  return listRegisteredItems()
    .find((item) => uprightLineHeightCm(item) === lineHeightCm)
    ?.itemKey ?? null;
}

const MAXIMA_RULES = Object.freeze({
  boothType: 'maxima',
  wallHeightsCm: WALL_LINE_HEIGHTS_CM,
  /** Duvar ailesi ürünü (düz duvar, kapı, vitrin, separatör, depo duvarı) yeni yükseklikteki karşılığı. */
  resolveWallItemKey(itemKey, toHeightCm) {
    return resolveWallItemKeyForHeight(itemKey, toHeightCm);
  },
  /**
   * Dikme: duvar tepesine ulaşan veya tepeyi geçen dikme duvar tepesine göre yerini korur
   * (boyu fark kadar değişir). Duvardan kısa dikme yerinde kalır. Uygun boy yoksa değişmez.
   */
  resolveUprightItemKey(itemKey, fromHeightCm, toHeightCm) {
    const line = uprightLineHeightCm(getItem(itemKey));
    if (line == null || line < Number(fromHeightCm)) return itemKey;
    return findUprightItemKeyForLine(line + (Number(toHeightCm) - Number(fromHeightCm))) ?? itemKey;
  },
});

const RULES_BY_BOOTH_TYPE = Object.freeze({
  maxima: MAXIMA_RULES,
});

/** Stand tipinin yeniden boyutlandırma kuralları; tanımsız tipte null. */
export function getStandResizeRules(boothType) {
  return RULES_BY_BOOTH_TYPE[boothType] ?? null;
}
