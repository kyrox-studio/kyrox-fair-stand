import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listCatalogItems,
} from '../src/catalog.js';
import { resolveModuleContract } from '../src/moduleContracts.js';

const DOC_URL = new URL('../SYSTEM_MODULE_CATALOG.md', import.meta.url);

function readBoldCount(source, label) {
  const match = source.match(new RegExp(`${label}: \\*\\*(\\d+)\\*\\*`));
  assert.ok(match, `Missing documented count: ${label}`);
  return Number(match[1]);
}

function readCatalogKeySnapshot(source) {
  const match = source.match(/<!-- catalog-keys:start -->([\s\S]*?)<!-- catalog-keys:end -->/);
  assert.ok(match, 'Missing catalog key snapshot markers');

  return [...match[1].matchAll(/^- `([^`]+)`$/gm)].map((entry) => entry[1]);
}

test('SYSTEM_MODULE_CATALOG key snapshot matches runtime catalog exactly', async () => {
  const source = await readFile(DOC_URL, 'utf8');
  assert.deepEqual(readCatalogKeySnapshot(source), [...listCatalogItems().map((item) => item.itemKey)]);
});

test('SYSTEM_MODULE_CATALOG summary counts match module contracts', async () => {
  const source = await readFile(DOC_URL, 'utf8');
  const contracts = listCatalogItems().map((item) => item.itemKey).map((key) => resolveModuleContract(key));
  const recipeCount = contracts.filter((contract) => contract?.bom?.mode === 'recipe').length;
  const selfCount = contracts.filter((contract) => contract?.bom?.mode === 'self').length;
  const decisionRequiredCount = contracts.filter((contract) => contract?.bom?.mode === 'decision-required').length;

  assert.equal(readBoldCount(source, 'Catalog entries'), listCatalogItems().map((item) => item.itemKey).length);
  assert.equal(readBoldCount(source, 'BOM mode `recipe`'), recipeCount);
  assert.equal(readBoldCount(source, 'BOM mode `self`'), selfCount);
  assert.equal(readBoldCount(source, 'BOM mode `decision-required`'), decisionRequiredCount);

  const illuminatedFoam = resolveModuleContract('illuminated-foam');
  assert.ok(illuminatedFoam);
  assert.equal(illuminatedFoam.bom.mode, 'decision-required');
  assert.equal(readBoldCount(source, 'Explicit contract runtime module'), 1);
  assert.equal(readBoldCount(source, 'Explicit contract module BOM mode `decision-required`'), 1);
});
