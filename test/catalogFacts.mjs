// Test kataloğunun (DB'den `scripts/export-test-catalog.py`) sayıları. Kalem sayısı testleri sabit sayı yerine
// bunları kullanır: DB'ye Item eklenince / gizlenince testler veriyle birlikte değişir (2026-11-20).
import { readFileSync } from 'node:fs';

const seed = JSON.parse(readFileSync(new URL('./fixtures/itemCatalogSeed.json', import.meta.url), 'utf8'));

export const CATALOG_ITEM_COUNT = seed.items.length;
export const CATALOG_VISIBLE_COUNT = seed.items.filter((item) => item.catalog_visible === true).length;
export const CATALOG_HIDDEN_COUNT = CATALOG_ITEM_COUNT - CATALOG_VISIBLE_COUNT;
export const CATALOG_ITEM_KEYS = Object.freeze(seed.items.map((item) => item.item_key));
