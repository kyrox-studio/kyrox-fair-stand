import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCatalogItem,
  listCatalogGroups,
} from '../src/catalog.js';
import { resolveItemKey } from '../src/items.js';
import { createModuleStateFromDescriptor } from '../src/designState.js';
import {
  allowsThinWallEndpointContact,
  canModulesOverlapByBehavior,
  getModuleBehavior,
  getModuleDefaultRotationDeg,
  getModuleRotationStepDeg,
} from '../src/moduleBehavior.js';
import { resolveModuleContract } from '../src/moduleContracts.js';
import { AUTO_DEPOT_SIZES, planAutomaticDepot } from '../src/autoDepot.js';

const KEY = 'plastic_trash_bin';
const MODEL_FILE = 'plastic_trash_bin.glb';

function footprint(spec) {
  const xMin = Number(spec.placement.xCm);
  const xMax = xMin + Number(spec.widthCm);
  const yCenter = Number(spec.placement.yCm);
  const halfDepth = Number(spec.depthCm) / 2;
  return {
    xMin,
    xMax,
    yMin: yCenter - halfDepth,
    yMax: yCenter + halfDepth,
  };
}

function overlaps(a, b) {
  return a.xMin < b.xMax
    && a.xMax > b.xMin
    && a.yMin < b.yMax
    && a.yMax > b.yMin;
}

test('plastic trash bin is a canonical 40x40x60 fixed-model catalog module', () => {
  const descriptor = getCatalogItem(KEY);
  assert.ok(descriptor);
  assert.equal(descriptor.label, 'Çöp Kutusu');
  assert.equal(descriptor.previewId, 16);
  assert.equal(Object.hasOwn(descriptor, 'type'), false);
  assert.equal(Object.hasOwn(descriptor, 'widthCm'), false);
  assert.equal(Object.hasOwn(descriptor, 'modelFile'), false);
  assert.equal(existsSync(new URL(`../public/models/${MODEL_FILE}`, import.meta.url)), true);

  const extraGroup = listCatalogGroups().find((group) => group.label === 'Extra');
  assert.ok(extraGroup?.keys.includes(KEY));
  assert.equal(
    listCatalogGroups().flatMap((group) => group.keys).filter((key) => key === KEY).length,
    1,
  );

  assert.equal(resolveItemKey({
    type: 'plastic-trash-bin',
    widthCm: 40,
    depthCm: 40,
    modelFile: MODEL_FILE,
  }), null);
  assert.equal(resolveItemKey({ itemKey: KEY }), KEY);
});

test('trash bin state and behavior preserve fridge-style movement without overlap exceptions', () => {
  const descriptor = getCatalogItem(KEY);
  const state = createModuleStateFromDescriptor(descriptor, { itemKey: KEY });
  assert.ok(state);
  assert.equal(state.itemKey, KEY);
  assert.equal(state.type, 'plastic-trash-bin');
  assert.deepEqual([state.widthCm, state.depthCm, state.heightCm], [40, 40, 60]);
  assert.equal(state.modelFile, MODEL_FILE);
  assert.equal(state.preserveModelScale, false);

  const behavior = getModuleBehavior(state);
  assert.equal(behavior.placement, 'free');
  assert.equal(behavior.moveSnapCm, 10);
  assert.equal(getModuleRotationStepDeg(state), 15);
  assert.equal(getModuleDefaultRotationDeg(state), 0);
  assert.equal(behavior.collision, 'none');
  assert.equal(behavior.magneticSnap, 'none');
  assert.deepEqual(behavior.overlapWithTypes, []);
  assert.equal(allowsThinWallEndpointContact(state), false);

  assert.equal(canModulesOverlapByBehavior(state, { type: 'mini-fridge' }), false);
  assert.equal(canModulesOverlapByBehavior(state, { type: 'kettle' }), false);
  assert.equal(canModulesOverlapByBehavior(state, { type: 'coat-rack' }), false);
});

test('trash catalog preview uses a dedicated bin silhouette instead of panel strips', () => {
  const source = readFileSync(new URL('../src/catalogPreviewRenderer.js', import.meta.url), 'utf8');
  const fixture = readFileSync(new URL('./fixtures/catalogPreviewKinds.mjs', import.meta.url), 'utf8');
  assert.match(fixture, /id: 16/);
  assert.match(fixture, /module-drag-trash-bin/);
  assert.match(fixture, /module-drag-trash-bin-handle/);
  assert.doesNotMatch(source, /if \(module\.type === 'plastic-trash-bin'\)/);
});

test('trash bin has an explicit fixed-model contract and self BOM', () => {
  const contract = resolveModuleContract(KEY);
  assert.ok(contract);
  assert.equal(contract.itemKey, KEY);
  assert.equal(contract.profile, 'free-model-fixed');
  assert.equal(contract.appearance.color, 'fixed');
  assert.equal(contract.renderer.mode, 'model');
  assert.equal(contract.behavior.moveSnapCm, 10);
  assert.equal(contract.behavior.magneticSnap, 'none');
  assert.equal(contract.bom.mode, 'self');
  assert.equal(contract.bom.source, 'src/itemBom.js');
});

test('automatic depot adds the trash bin inside every supported depot without floor-fixture overlap', () => {
  for (const [sizeKey, size] of Object.entries(AUTO_DEPOT_SIZES)) {
    const plan = planAutomaticDepot({
      standType: 'island',
      standXCm: 500,
      standYCm: 500,
      sizeKey,
      includeContents: true,
    });
    assert.equal(plan.ok, true, sizeKey);

    const trash = plan.specs.find((spec) => spec.itemKey === KEY);
    const fridge = plan.specs.find((spec) => spec.kind === 'mini-fridge');
    const rack = plan.specs.find((spec) => spec.kind === 'coat-rack');
    assert.ok(trash, `${sizeKey}: trash bin missing`);
    assert.ok(fridge, `${sizeKey}: fridge missing`);
    assert.ok(rack, `${sizeKey}: rack missing`);
    assert.equal(trash.kind, 'plastic-trash-bin');
    assert.equal(trash.modelFile, MODEL_FILE);
    assert.deepEqual([trash.widthCm, trash.depthCm, trash.heightCm], [40, 40, 60]);

    const trashBox = footprint(trash);
    const fridgeBox = footprint(fridge);
    const rackBox = footprint(rack);
    const depot = {
      xMin: plan.originXCm,
      xMax: plan.originXCm + Number(size.widthCm),
      yMin: plan.originYCm,
      yMax: plan.originYCm + Number(size.depthCm),
    };

    assert.ok(trashBox.xMin >= depot.xMin && trashBox.xMax <= depot.xMax, `${sizeKey}: trash x bounds`);
    assert.ok(trashBox.yMin >= depot.yMin && trashBox.yMax <= depot.yMax, `${sizeKey}: trash y bounds`);
    assert.equal(overlaps(trashBox, fridgeBox), false, `${sizeKey}: trash/fridge overlap`);
    assert.equal(overlaps(trashBox, rackBox), false, `${sizeKey}: trash/rack overlap`);
    assert.equal(overlaps(fridgeBox, rackBox), false, `${sizeKey}: fridge/rack overlap`);
  }
});
