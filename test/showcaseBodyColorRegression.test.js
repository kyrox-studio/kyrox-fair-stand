import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  applyColorOverride,
  createShowcaseModuleState,
  duplicateModuleState,
} from '../src/designState.js';
import { describeSurfaceSelection } from '../src/selectionFeedback.js';
import { getShowcaseBodyDefinition } from '../src/items.js';
import { getItemSurfaceCapabilities } from '../src/itemCapabilities.js';

const CASES = [
  { type: 'showcase-2', itemKey: 'wall_showcase_100_2_350', eyeCount: 2 },
  { type: 'showcase-3', itemKey: 'wall_showcase_100_3_350', eyeCount: 3 },
];

test('wall showcase body stays one grouped user-assignable color surface', () => {
  for (const expected of CASES) {
    const state = createShowcaseModuleState(expected.type, 100);

    assert.equal(state.itemKey, expected.itemKey);
    assert.equal(state.eyeCount, expected.eyeCount);
    assert.equal(state.bodySurface.color, '#ffffff');
    assert.equal(state.bodySurfaces, undefined);
    const body = getShowcaseBodyDefinition(expected.itemKey);
    assert.equal(getItemSurfaceCapabilities(body.sideItem).color, true);
    assert.equal(getItemSurfaceCapabilities(body.horizontalItem).color, true);
    assert.equal(getItemSurfaceCapabilities(body.sideItem).image, false);

    applyColorOverride(state.bodySurface, '#336699');
    assert.equal(state.bodySurface.color, '#336699');

    const duplicate = duplicateModuleState(state);
    assert.equal(duplicate.bodySurface.color, '#336699');
    assert.notEqual(duplicate.bodySurface.id, state.bodySurface.id);

    const feedback = describeSurfaceSelection([{
      userData: {
        moduleIndex: 0,
        widthCm: 100,
        moduleType: expected.type,
        surfaceRole: 'showcase-body',
      },
    }], [state]);
    assert.match(feedback.message, /vitrin gövdesi · 4 sunta birlikte renklendirilir/);
  }
});

test('wall showcase renderer exposes one color-only body selector for all four body boards', () => {
  const source = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  const start = source.indexOf('function createShowcaseModule(');
  const end = source.indexOf('function createSelectionFrame', start);
  const showcase = source.slice(start, end);

  assert.match(showcase, /const bodyColorTargets = \[\];/);
  assert.match(showcase, /for \(const side of \[-1, 1\]\)/);
  assert.match(showcase, /for \(const y of \[bodyBottom \+ horizontalThickness \/ 2, bodyTop - horizontalThickness \/ 2\]\)/);
  assert.match(showcase, /bodyColorTargets\.push\(sidePanel\)/);
  assert.match(showcase, /bodyColorTargets\.push\(cap\)/);
  assert.match(showcase, /surfaceRole: 'showcase-body'/);
  assert.match(showcase, /\.\.\.surfaceCapabilityUserData\(bodyDefinition\.sideItem\), moduleIndex/);
  assert.match(showcase, /\.\.\.bindRendererSurfaceState\(moduleState\.bodySurface\)/);
  assert.match(showcase, /colorTargets: bodyColorTargets/);
  assert.doesNotMatch(showcase, /bodySurfaces/);
});

test('wall showcase renderer does not add non-BOM white front-detail meshes', () => {
  const source = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  const start = source.indexOf('function createShowcaseModule(');
  const end = source.indexOf('function createSelectionFrame', start);
  const showcase = source.slice(start, end);

  assert.doesNotMatch(showcase, /showcaseDetailMaterial/);
  assert.doesNotMatch(showcase, /frontPostGeometry/);
  assert.doesNotMatch(showcase, /frontEdgeGeometry/);
  assert.doesNotMatch(showcase, /shelfFrontGeometry/);
  assert.doesNotMatch(showcase, /const shelfFront =/);

  // Kanonik fiziksel geometri duruyor olmalı.
  assert.match(showcase, /sidePanelGeometry/);
  assert.match(showcase, /capGeometry/);
  assert.match(showcase, /const shelfGeometry = new THREE\.BoxGeometry/);
  assert.match(showcase, /shelf\.userData\.itemKey = glassShelfItem\.itemKey/);
});
