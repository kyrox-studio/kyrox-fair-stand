import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCatalogItem,
} from '../src/catalog.js';
import { applyColorOverride, createShowcaseModuleState, duplicateModuleState, normalizeModuleItemState } from '../src/designState.js';
import { resolveItemBom } from '../src/itemBom.js';
import { getItem, getShowcaseBodyDefinition } from '../src/items.js';

const CASES = [
  { itemKey: 'wall_showcase_100_2_350', type: 'showcase-2', eyeCount: 2, sideItemKey: 'showcase_side_94_6_30', glassQuantity: 1, panelQuantity: 5, singleQuantity: 9 },
  { itemKey: 'wall_showcase_100_3_350', type: 'showcase-3', eyeCount: 3, sideItemKey: 'showcase_side_143_5_30', glassQuantity: 2, panelQuantity: 4, singleQuantity: 7 },
];

function quantities(lines) { return new Map(lines.map((line) => [line.itemKey, line.quantity])); }

test('wall_showcase parents own canonical cluster identity and child roles', () => {
  for (const expected of CASES) {
    const item = getItem(expected.itemKey);
    assert.equal(item.itemKey, expected.itemKey);
    assert.equal(item.type, expected.type);
    assert.equal(item.unit, 'adet');
    assert.deepEqual(item.dimensions, { widthCm: 100 });
    assert.equal(item.eyeCount, expected.eyeCount);
    assert.deepEqual(item.bodyItems, { sideItemKey: expected.sideItemKey, horizontalItemKey: 'showcase_horizontal_87_4_30', glassShelfItemKey: 'glass_shelf' });
    assert.equal(item.composition.mode, 'recipe');
    assert.equal(item.composition.moduleType, undefined);
    assert.ok(Array.isArray(item.composition.items));
    assert.equal(item.composition.items.length > 0, true);
  }
});

test('catalog keeps wall_showcase keys and derives canonical descriptor facts', () => {
  // 0086: Vitrin tek kart (3 göz); 2 göz Özellikler panelinde seçilir.
  assert.equal(getCatalogItem('wall_showcase_100_2_350'), null);
  const descriptor = getCatalogItem('wall_showcase_100_3_350');
  assert.equal(descriptor.itemKey, 'wall_showcase_100_3_350');
  assert.equal(descriptor.label, 'Vitrin');
  assert.equal(descriptor.previewId, getItem('wall_showcase_100_3_350').previewId);
  assert.equal(Object.hasOwn(descriptor, 'type'), false);
  assert.equal(Object.hasOwn(descriptor, 'widthCm'), false);
  assert.equal(Object.hasOwn(descriptor, 'eyeCount'), false);
  assert.equal(getCatalogItem('showcase_2_100'), null);
  assert.equal(getCatalogItem('showcase_3_100'), null);
});

test('recursive wall showcase BASE BOM expands verified physical children', () => {
  for (const expected of CASES) {
    const bom = quantities(resolveItemBom(expected.itemKey));
    assert.equal(bom.get('profile_91'), 4);
    assert.equal(bom.get('upright_346_5'), 2);
    assert.equal(bom.get('panel_98'), expected.panelQuantity);
    assert.equal(bom.get('connector_start'), 4);
    assert.equal(bom.get('connector_single'), expected.singleQuantity);
    assert.equal(bom.get(expected.sideItemKey), 2);
    assert.equal(bom.get('showcase_horizontal_87_4_30'), 2);
    assert.equal(bom.get('glass_shelf'), expected.glassQuantity);
    assert.equal(bom.has('showcase_2_100'), false);
    assert.equal(bom.has('showcase_3_100'), false);
  }
});

test('showcase body resolver owns canonical board geometry/default color', () => {
  for (const expected of CASES) {
    const body = getShowcaseBodyDefinition(expected.itemKey);
    assert.equal(body.sideItem.itemKey, expected.sideItemKey);
    assert.equal(body.horizontalItem.itemKey, 'showcase_horizontal_87_4_30');
    assert.equal(body.glassShelfItem.itemKey, 'glass_shelf');
    assert.equal(body.sideItem.material, 'sunta');
    assert.equal(body.horizontalItem.material, 'sunta');
    assert.equal(body.defaultColor, 0xffffff);
  }
});

test('factory/persistence use wall_showcase identity and one grouped color-only body override', () => {
  for (const expected of CASES) {
    const state = createShowcaseModuleState(expected.type, 100);
    assert.equal(state.itemKey, expected.itemKey);
    assert.equal(state.eyeCount, expected.eyeCount);
    assert.equal(state.bodySurface.color, '#ffffff');
    assert.equal('imageAssetId' in state.bodySurface, false);
    applyColorOverride(state.bodySurface, '#336699');
    assert.equal(state.bodySurface.color, '#336699');
    const duplicate = duplicateModuleState(state);
    assert.equal(duplicate.itemKey, expected.itemKey);
    assert.equal(duplicate.bodySurface.color, '#336699');
    assert.notEqual(duplicate.bodySurface.id, state.bodySurface.id);
  }

  const persisted = { id: 'showcase-persisted', itemKey: 'wall_showcase_100_2_350', type: 'showcase-2', widthCm: 100, strips: [] };
  normalizeModuleItemState(persisted);
  assert.equal(persisted.itemKey, 'wall_showcase_100_2_350');
  assert.equal(persisted.bodySurface.color, '#ffffff');
});

test('renderer reads canonical board facts and one selector targets exactly four body boards', () => {
  const source = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  const start = source.indexOf('function createShowcaseModule(');
  const end = source.indexOf('function createSelectionFrame', start);
  const showcase = source.slice(start, end);
  assert.match(showcase, /getShowcaseBodyDefinition\(moduleState\.itemKey\)/);
  assert.match(showcase, /sideDimensions\.widthCm/);
  assert.match(showcase, /horizontalDimensions\.widthCm/);
  assert.match(showcase, /surfaceRole: 'showcase-body'/);
  assert.match(showcase, /colorTargets: bodyColorTargets/);
  assert.doesNotMatch(showcase, /const showcaseDepth = 0\.30/);
});
