import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  GROUP_TEMPLATE_NO_ROOM_MESSAGE,
  buildGroupTemplatePayload,
  findTemplateOffset,
  instantiateGroupTemplate,
} from '../src/groupTemplates.js';
import { duplicateModuleState } from '../src/designState.js';
import { createGroup, getGroupBounds, setGroupLocked } from '../src/moduleGroups.js';

const STAND = Object.freeze({ standType: 'island', standXCm: 600, standYCm: 500 });

function box(id, xCm, yCm, extra = {}) {
  return {
    id,
    type: 'box-block',
    itemKey: 'box_block',
    widthCm: 100,
    depthCm: 50,
    heightCm: 100,
    placement: { xCm, yCm, zCm: 0, rotationZDeg: 0, wallId: 'free' },
    faces: [{ id: `${id}-face`, color: '#ff0000', imageAssetId: 'asset-1' }],
    ...extra,
  };
}

let counter = 0;
function duplicateModule(moduleState) {
  const copy = JSON.parse(JSON.stringify(moduleState));
  copy.id = `new-${counter += 1}`;
  delete copy.locked;
  delete copy.group;
  return copy;
}

function groupedModules() {
  const modules = [box('a', 300, 200), box('b', 420, 260, { locked: true })];
  const { group } = createGroup(modules, ['a', 'b'], { name: 'Sağ duvar' });
  return { modules, group };
}

test('template payload keeps parts, size, colour and relative layout but no ids, group, lock or images', () => {
  const { modules, group } = groupedModules();
  setGroupLocked(modules, group.id, true);
  const result = buildGroupTemplatePayload(modules, group.id);
  assert.equal(result.ok, true);
  const { payload } = result;
  assert.equal(payload.version, 1);
  assert.equal(payload.members.length, 2);
  for (const member of payload.members) {
    assert.equal(Object.hasOwn(member, 'id'), false);
    assert.equal(Object.hasOwn(member, 'group'), false);
    assert.equal(Object.hasOwn(member, 'locked'), false);
    assert.equal(member.itemKey, 'box_block');
    assert.equal(member.faces[0].color, '#ff0000');
    assert.equal(member.faces[0].imageAssetId, null);
    assert.equal(Object.hasOwn(member.placement, 'wallId'), false);
  }
  // Relative to the group's back-left corner: the gap between parts is kept.
  const [first, second] = payload.members;
  assert.equal(second.placement.xCm - first.placement.xCm, 120);
  assert.equal(second.placement.yCm - first.placement.yCm, 60);
  // The source modules are untouched.
  assert.equal(modules[0].faces[0].imageAssetId, 'asset-1');
});

test('template keeps colour, glass and metal separator; drops lightbox/mesh fabric and images', () => {
  const modules = [
    {
      id: 'wall',
      type: 'flat-panel',
      itemKey: 'wall_100',
      widthCm: 100,
      heightCm: 350,
      placement: { xCm: 0, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' },
      strips: [
        {
          id: 's0',
          stripIndex: 0,
          color: '#112233',
          isGlass: true,
          imageAssetId: 'img-1',
          fabricGroupId: 'fab-1',
          fabricType: 'lightbox',
          fabricImageAssetId: 'fab-img',
          fabricLightingOn: true,
        },
        {
          id: 's1',
          stripIndex: 1,
          color: '#445566',
          isMetalSeparator: true,
          metalSeparatorGroupId: 'metal-a',
          imageAssetId: null,
          fabricGroupId: 'fab-mesh',
          fabricType: 'mesh',
        },
      ],
    },
    box('logo', 120, 40),
  ];
  const { group } = createGroup(modules, ['wall', 'logo']);
  const { payload } = buildGroupTemplatePayload(modules, group.id);
  const [glassStrip, metalStrip] = payload.members.find((member) => member.type === 'flat-panel').strips;

  assert.equal(glassStrip.color, '#112233');
  assert.equal(glassStrip.isGlass, true);
  assert.equal(glassStrip.imageAssetId, null);
  assert.equal(Object.hasOwn(glassStrip, 'fabricGroupId'), false);
  assert.equal(Object.hasOwn(glassStrip, 'fabricType'), false);
  assert.equal(Object.hasOwn(glassStrip, 'fabricImageAssetId'), false);
  assert.equal(Object.hasOwn(glassStrip, 'fabricLightingOn'), false);

  assert.equal(metalStrip.color, '#445566');
  assert.equal(metalStrip.isMetalSeparator, true);
  assert.equal(metalStrip.metalSeparatorGroupId, 'metal-a');
  assert.equal(Object.hasOwn(metalStrip, 'fabricGroupId'), false);
  assert.equal(Object.hasOwn(metalStrip, 'fabricType'), false);

  // Kaynak sahnedeki kumaş/görsel bozulmaz.
  assert.equal(modules[0].strips[0].fabricGroupId, 'fab-1');
  assert.equal(modules[0].strips[0].imageAssetId, 'img-1');

  const placed = instantiateGroupTemplate(payload, {
    name: 'Camlı duvar',
    stand: STAND,
    duplicateModule: duplicateModuleState,
  });
  assert.equal(placed.ok, true);
  const placedWall = placed.clones.find((clone) => clone.type === 'flat-panel');
  assert.equal(placedWall.strips[0].isGlass, true);
  assert.equal(placedWall.strips[0].color, '#112233');
  assert.equal(placedWall.strips[1].isMetalSeparator, true);
  assert.equal(placedWall.strips[1].color, '#445566');
  // Metal grup kimliği kopyada yenilenir (BOM / bağ paylaşılmasın).
  assert.match(placedWall.strips[1].metalSeparatorGroupId, /^metal-/);
  assert.notEqual(placedWall.strips[1].metalSeparatorGroupId, 'metal-a');
  assert.equal(Object.hasOwn(placedWall.strips[0], 'fabricGroupId'), false);
});

test('a group needs at least two parts to become a template', () => {
  const modules = [box('a', 100, 100)];
  assert.equal(buildGroupTemplatePayload(modules, 'missing').ok, false);
});

test('placing a template creates new unlocked modules in a new group, centred in the stand', () => {
  const { modules, group } = groupedModules();
  const { payload } = buildGroupTemplatePayload(modules, group.id);
  const placed = instantiateGroupTemplate(payload, { name: 'Sağ duvar', stand: STAND, duplicateModule });
  assert.equal(placed.ok, true);
  assert.equal(placed.clones.length, 2);
  assert.deepEqual(placed.skipped, []);
  assert.ok(placed.clones.every((clone) => clone.group.id === placed.group.id && clone.group.name === 'Sağ duvar'));
  assert.ok(placed.clones.every((clone) => clone.group.locked === false && clone.locked === undefined));
  assert.ok(placed.clones.every((clone) => !['a', 'b'].includes(clone.id)));
  // Layout kept.
  assert.equal(placed.clones[1].placement.xCm - placed.clones[0].placement.xCm, 120);
  assert.equal(placed.clones[1].placement.yCm - placed.clones[0].placement.yCm, 60);
  // Inside the stand, near the middle.
  const bounds = getGroupBounds(placed.clones);
  assert.ok(bounds.minX >= 0 && bounds.maxX <= 600 && bounds.minY >= 0 && bounds.maxY <= 500);
  assert.ok(Math.abs((bounds.minX + bounds.maxX) / 2 - 300) <= 10);
});

test('parts whose item is no longer in the catalog are skipped and reported', () => {
  const modules = [box('a', 100, 100), box('b', 220, 100), box('c', 340, 100, { itemKey: 'gone_item' })];
  const { group } = createGroup(modules, ['a', 'b', 'c']);
  const { payload } = buildGroupTemplatePayload(modules, group.id);
  const placed = instantiateGroupTemplate(payload, {
    name: 'x',
    stand: STAND,
    duplicateModule,
    hasItem: (itemKey) => itemKey !== 'gone_item',
  });
  assert.equal(placed.ok, true);
  assert.equal(placed.clones.length, 2);
  assert.deepEqual(placed.skipped, ['gone_item']);

  const onlyOne = instantiateGroupTemplate(payload, { name: 'x', stand: STAND, duplicateModule, hasItem: (key) => key === 'none' });
  assert.equal(onlyOne.ok, false);
});

test('a template larger than the stand is refused', () => {
  const big = [box('a', 0, 0, { widthCm: 500 }), box('b', 500, 0, { widthCm: 400 })];
  const { group } = createGroup(big, ['a', 'b']);
  const { payload } = buildGroupTemplatePayload(big, group.id);
  const placed = instantiateGroupTemplate(payload, { name: 'x', stand: STAND, duplicateModule });
  assert.equal(placed.ok, false);
  assert.equal(placed.message, GROUP_TEMPLATE_NO_ROOM_MESSAGE);
  assert.equal(findTemplateOffset([], STAND), null);
});

test('template API client uses the group-templates route with session headers only', () => {
  const source = readFileSync(new URL('../src/groupTemplateRemote.js', import.meta.url), 'utf8');
  assert.match(source, /export const GROUP_TEMPLATES_API_BASE = '\/api\/v1\/fair-stand\/group-templates';/);
  assert.match(source, /__FAIR_STAND_CATALOG_HEADERS__/);
  assert.doesNotMatch(source, /organizationId/);
});
