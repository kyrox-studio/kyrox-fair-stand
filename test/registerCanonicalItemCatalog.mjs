import { readFileSync } from 'node:fs';
import { initializeBoothTypes } from '../src/boothTypes.js';
import { initializeCatalogCategories, initializeCatalogPreviews } from '../src/catalog.js';
import { initializeItemRegistry, initializeItemTypeRegistry, initializeSnapRuleRegistry } from '../src/items.js';
import { initializeRuntimeSettings } from '../src/runtimeSettings.js';
import { initializeStandDimensions } from '../src/standDimensions.js';
import { mapCatalogSeedToBootstrap } from './mapCatalogSeed.mjs';

const seed = JSON.parse(readFileSync(new URL('./fixtures/itemCatalogSeed.json', import.meta.url), 'utf8'));
const snapshot = mapCatalogSeedToBootstrap(seed);

export function loadCanonicalItemCatalog() {
  initializeStandDimensions(snapshot.standDimensions);
  initializeRuntimeSettings(snapshot.settings);
  initializeBoothTypes(snapshot.boothTypes);
  initializeCatalogCategories(snapshot.categories);
  initializeCatalogPreviews(snapshot.previewKinds);
  initializeSnapRuleRegistry(snapshot.rules ?? []);
  initializeItemTypeRegistry(snapshot.itemTypes ?? []);
  initializeItemRegistry(snapshot.items);
}

loadCanonicalItemCatalog();
