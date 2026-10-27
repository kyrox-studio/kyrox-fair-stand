import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

const STALE_TOKENS = [
  'productionParts.js',
  'PRODUCTION_PARTS',
  'getDoorLeafProductionItem',
  'getShelfProductionItem',
  'listProductionParts',
  // 2026-10-27 denetimi: aşağıdakiler koddan kaldırıldı; belgede geçmeleri bayat bilgi demektir.
  'resolveConnectorBom',
  'innerCornerPanelItemKey',
  'WALL_BEHAVIOR',
  'overlayBehavior',
  'freeBehavior',
  'PLASTIC_TRASH_BIN_BEHAVIOR',
  'normalizeCatalogDescriptor',
  'DEFAULT_PANEL_COLOR',
  'Bayat (',
];

function collectMarkdown(relativeDir) {
  const dir = new URL(`../${relativeDir}/`, import.meta.url);
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => ({
      path: `${relativeDir}/${name}`,
      text: readFileSync(new URL(name, dir), 'utf8'),
    }));
}

describe('Item tanım metinleri runtime sahibi ile hizalıdır', () => {
  // current-system/ ve door_100_full_system_audit.md tarihî envanterdir; 2026-10-27'de
  // kyrox-platform/archive/fair-stand/docs-items/ altına taşındı ve bu depoda yoktur.
  const files = [...collectMarkdown('docs/items/definitions'), ...collectMarkdown('docs/items/contract')];

  test('tanım dosyaları eski productionParts sahibini yazmaz', () => {
    const hits = [];
    for (const file of files) {
      for (const token of STALE_TOKENS) {
        if (file.text.includes(token)) hits.push(`${file.path}: ${token}`);
      }
    }
    assert.deepEqual(hits, []);
  });

  test('en az bir tanım dosyası src/items.js ve getItem() yazar', () => {
    const definitions = files.filter((file) => file.path.startsWith('docs/items/definitions/'));
    assert.equal(definitions.some((file) => file.text.includes('src/items.js')), true);
    assert.equal(definitions.some((file) => file.text.includes('getItem()')), true);
  });
});
