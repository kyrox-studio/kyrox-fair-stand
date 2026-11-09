import { initializeBoothTypes } from './boothTypes.js';
import { initializeCatalogCategories, initializeCatalogPreviews } from './catalog.js';
import { isFairStandDemo } from './demoMode.js';
import { getFairStandHostWindow } from './hostDocument.js';
import { initializeItemRegistry, initializeItemTypeRegistry, initializeSnapRuleRegistry } from './items.js';
import { initializeRuntimeSettings } from './runtimeSettings.js';
import { initializeStandDimensions } from './standDimensions.js';

export const DEMO_CATALOG_BOOTSTRAP_URL = '/api/v1/fair-stand/demo/catalog/bootstrap';

function catalogBootstrapUrl() {
  // Demo, süzülmüş katalogu kendi ucundan alır; Core başlığı gönderilmez (ADR-0012).
  if (isFairStandDemo()) return DEMO_CATALOG_BOOTSTRAP_URL;
  return import.meta.env.VITE_FAIR_STAND_CATALOG_URL || '/api/v1/fair-stand/catalog/bootstrap';
}

function catalogBootstrapHeaders() {
  if (isFairStandDemo()) return {};
  const hostWindow = getFairStandHostWindow();
  const headers = hostWindow?.__FAIR_STAND_CATALOG_HEADERS__ || globalThis.__FAIR_STAND_CATALOG_HEADERS__;
  return headers && typeof headers === 'object' ? headers : {};
}

export async function bootstrapFairStandCatalog() {
  const response = await fetch(catalogBootstrapUrl(), {
    headers: catalogBootstrapHeaders(),
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`Fair Stand Item catalog bootstrap failed (${response.status}).`);
  }
  const payload = await response.json();
  if (
    !payload
    || !Array.isArray(payload.items)
    || !Array.isArray(payload.categories)
    || !Array.isArray(payload.boothTypes)
    || !Array.isArray(payload.previewKinds)
    || !payload.standDimensions
    || !payload.settings
  ) {
    throw new TypeError('Fair Stand Item catalog bootstrap payload is invalid.');
  }
  initializeStandDimensions(payload.standDimensions);
  initializeRuntimeSettings(payload.settings);
  initializeBoothTypes(payload.boothTypes);
  initializeCatalogCategories(payload.categories);
  initializeCatalogPreviews(payload.previewKinds);
  initializeSnapRuleRegistry(Array.isArray(payload.rules) ? payload.rules : []);
  initializeItemTypeRegistry(Array.isArray(payload.itemTypes) ? payload.itemTypes : []);
  initializeItemRegistry(payload.items);
  return payload.revision ?? null;
}
