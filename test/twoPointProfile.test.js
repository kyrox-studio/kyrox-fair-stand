import test from 'node:test';
import assert from 'node:assert/strict';

import { createModuleStateFromDescriptor } from '../src/designState.js';
import { listProfileLengthItems } from '../src/profileLength.js';
import {
  alignProfileBodyAnchor,
  findNearestProfileAnchor,
  findProfileAnchorAt,
  listProfileAnchorPoints,
  resolveFreeEndProfile,
  resolveTwoPointProfile,
  resolveTwoPointProfileZCm,
} from '../src/twoPointProfile.js';

function wall(id, xCm, yCm, rotationZDeg = 0) {
  return {
    id,
    itemKey: 'wall_200_350',
    type: 'flat-panel',
    widthCm: 200,
    heightCm: 350,
    placement: { xCm, yCm, zCm: 0, rotationZDeg, wallId: 'free' },
  };
}

test('anchors: upright center, profile ends and wall end posts; furniture gives none', () => {
  const upright = createModuleStateFromDescriptor({ itemKey: 'upright_346_5', type: 'upright' });
  upright.placement = { xCm: 400, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'free' };
  const profile = createModuleStateFromDescriptor({ itemKey: 'profile_190', type: 'profile' });
  profile.placement = { xCm: 0, yCm: 100, zCm: 0, rotationZDeg: 0, wallId: 'free' };
  const points = listProfileAnchorPoints([wall('w1', 0, 0), upright, profile]);
  const ends = points.filter((point) => point.kind === 'profile-end');
  assert.equal(ends.length, 2);
  assert.deepEqual(ends.map((point) => Math.round(point.xCm)), [0, profile.widthCm]);
  assert.ok(ends.every((point) => Math.abs(point.yCm - 100) < 5));
  const posts = points.filter((point) => point.kind === 'upright');
  assert.equal(posts.length, 1);
  assert.ok(Math.abs(posts[0].xCm - (400 + upright.widthCm / 2)) < 0.01);
  const wallPosts = points.filter((point) => point.kind === 'wall-post');
  assert.deepEqual(wallPosts.map((point) => [point.xCm, point.yCm]), [[0, 0], [200, 0]]);
  assert.equal(wallPosts[0].topZCm, 350);
  const counter = createModuleStateFromDescriptor({ itemKey: 'desk_banko_100', type: 'counter' });
  if (counter) {
    counter.placement = { xCm: 0, yCm: 300, zCm: 0, rotationZDeg: 0, wallId: 'free' };
    assert.equal(listProfileAnchorPoints([counter]).length, 0);
  }
});

test('nearest anchor stays inside the pick radius', () => {
  const points = [{ xCm: 0, yCm: 0 }, { xCm: 200, yCm: 0 }];
  assert.equal(findNearestProfileAnchor(points, 190, 10)?.xCm, 200);
  assert.equal(findNearestProfileAnchor(points, 100, 0), null);
});

test('exact span picks the matching profile, centered on the line', () => {
  const result = resolveTwoPointProfile({ xCm: 0, yCm: 50 }, { xCm: 200, yCm: 50 }, listProfileLengthItems());
  assert.equal(result.ok, true);
  assert.equal(result.itemKey, 'profile_190');
  assert.equal(result.lengthCm, 200);
  assert.equal(result.centerXCm, 100);
  assert.equal(result.centerYCm, 50);
  assert.equal(result.rotationZDeg, 0);
});

test('unmatched span picks the nearest single length; vertical span rotates 90', () => {
  const items = listProfileLengthItems();
  const result = resolveTwoPointProfile({ xCm: 30, yCm: 0 }, { xCm: 30, yCm: 220 }, items);
  assert.equal(result.ok, true);
  assert.equal(result.lengthCm, 200);
  assert.equal(result.rotationZDeg, 90);
  assert.equal(result.centerYCm, 110);
  // Tam ortada kalınca kısa boy (taşma yok).
  const tie = resolveTwoPointProfile({ xCm: 0, yCm: 0 }, { xCm: 175, yCm: 0 }, items);
  assert.equal(tie.lengthCm, 150);
});

test('diagonal or identical points are rejected with a reason', () => {
  const items = listProfileLengthItems();
  assert.equal(resolveTwoPointProfile({ xCm: 0, yCm: 0 }, { xCm: 100, yCm: 100 }, items).ok, false);
  assert.equal(resolveTwoPointProfile({ xCm: 0, yCm: 0 }, { xCm: 0, yCm: 0 }, items).ok, false);
});

test('profile top follows the first picked end (post top or profile top)', () => {
  assert.equal(resolveTwoPointProfileZCm({ topZCm: 99 }, { topZCm: 350 }, 8), 91);
  assert.equal(resolveTwoPointProfileZCm({}, { topZCm: 350 }, 8), 342);
  assert.equal(resolveTwoPointProfileZCm({}, {}, 8), null);
});

test('ends a few cm off the same line still pair; the profile takes the first end line', () => {
  const items = listProfileLengthItems();
  const result = resolveTwoPointProfile({ xCm: 492, yCm: 388 }, { xCm: 0, yCm: 400 }, items);
  assert.equal(result.ok, true);
  assert.equal(result.rotationZDeg, 0);
  assert.equal(result.centerYCm, 388);
  assert.equal(result.distanceCm, 492);
  assert.equal(resolveTwoPointProfile({ xCm: 0, yCm: 0 }, { xCm: 200, yCm: 40 }, items).ok, false);
});

// Kullanıcı isteği 2026-11-13: dikme → profil, profil → dikme, profil → profil ve profil → karşı duvar
// (gövdenin her noktasına T). Gövde ucu öbür ucun dik izdüşümüne oturur.
function profileAt(id, xCm, yCm, rotationZDeg = 0, itemKey = 'profile_190') {
  const profile = createModuleStateFromDescriptor({ itemKey, type: 'profile' });
  profile.id = id;
  profile.placement = { xCm, yCm, zCm: 340, rotationZDeg, wallId: 'free' };
  return profile;
}

function uprightAt(id, centerXCm, centerYCm) {
  const upright = createModuleStateFromDescriptor({ itemKey: 'upright_346_5', type: 'upright' });
  upright.id = id;
  upright.placement = { xCm: centerXCm - upright.widthCm / 2, yCm: centerYCm, zCm: 0, rotationZDeg: 0, wallId: 'free' };
  return upright;
}

test('upright to the middle of a profile: the profile end sits on the projection, straight line', () => {
  const upright = uprightAt('u', 100, 0);
  const profile = profileAt('p', 0, 300);
  const start = findProfileAnchorAt([upright, profile], 101, 2);
  assert.equal(start.kind, 'upright');
  const end = findProfileAnchorAt([upright, profile], 140, 296, start);
  assert.equal(end.kind, 'profile-body');
  assert.equal(end.moduleId, 'p');
  assert.equal(Math.round(end.xCm), Math.round(start.xCm));
  const resolved = resolveTwoPointProfile(start, end, listProfileLengthItems());
  assert.equal(resolved.ok, true, resolved.message);
  assert.equal(resolved.rotationZDeg, 90);
});

test('profile to profile: first end snaps to 10 cm on the body, second end is its projection', () => {
  const front = profileAt('front', 0, 0);
  const back = profileAt('back', 0, 300);
  const start = findProfileAnchorAt([front, back], 52, 3);
  assert.equal(start.kind, 'profile-body');
  assert.equal(start.moduleId, 'front');
  assert.equal(start.xCm % 10, 0);
  const end = findProfileAnchorAt([front, back], 90, 298, start);
  assert.equal(end.moduleId, 'back');
  assert.equal(end.xCm, start.xCm);
  assert.equal(resolveTwoPointProfile(start, end, listProfileLengthItems()).ok, true);
});

test('profile to the top rail of the opposite wall', () => {
  const profile = profileAt('front', 0, 0);
  const backWall = wall('w', 0, 400);
  const start = findProfileAnchorAt([profile, backWall], 100, 2);
  const end = findProfileAnchorAt([profile, backWall], 120, 398, start);
  assert.equal(end.kind, 'profile-body');
  assert.equal(end.moduleId, 'w');
  assert.equal(end.topZCm, 350);
  assert.equal(end.xCm, start.xCm);
});

test('a first end on a profile body re-aligns to the second end', () => {
  const profile = profileAt('p', 0, 0);
  const start = findProfileAnchorAt([profile], 60, 1);
  const upright = uprightAt('u', 130, 300);
  const end = findProfileAnchorAt([profile, upright], 130, 300, start);
  const aligned = alignProfileBodyAnchor(start, end);
  assert.equal(Math.round(aligned.xCm), Math.round(end.xCm));
  assert.equal(resolveTwoPointProfile(aligned, end, listProfileLengthItems()).ok, true);
  // Uç noktası yakınsa gövde yerine uç seçilir.
  assert.equal(findProfileAnchorAt([profile], 1, 1).kind, 'profile-end');
});

// Kullanıcı isteği 2026-11-13: ilk uçtan sonra boşluğa tıklanınca profil bir ucu boşta konur.
test('free end from an upright: starts at the upright face, nearest length toward the cursor', () => {
  const items = listProfileLengthItems();
  const start = { xCm: 100, yCm: 0, kind: 'upright', topZCm: 350 };
  const result = resolveFreeEndProfile(start, { xCm: 104, yCm: 210 }, items);
  assert.equal(result.ok, true, result.message);
  assert.equal(result.rotationZDeg, 90);
  assert.equal(result.centerXCm, 100);
  // Yüz 5 cm'de; profil yüzden başlar, boş uç yüz + boy.
  assert.equal(result.centerYCm, 5 + result.lengthCm / 2);
  assert.equal(result.endYCm, 5 + result.lengthCm);
  const nearest = Math.min(...items.map((item) => Math.abs(Number(item.sceneDimensions?.widthCm ?? item.dimensions?.widthCm) - 205)));
  assert.equal(Math.abs(result.lengthCm - 205), nearest);
  // Ters yön.
  const back = resolveFreeEndProfile(start, { xCm: 90, yCm: -150 }, items);
  assert.equal(back.ok, true);
  assert.ok(back.endYCm < 0);
});

test('free end continuing a profile in line starts at the profile end; same point is rejected', () => {
  const items = listProfileLengthItems();
  const end = { xCm: 200, yCm: 100, kind: 'profile-end', axis: 'x', topZCm: 350 };
  const inLine = resolveFreeEndProfile(end, { xCm: 400, yCm: 106 }, items);
  assert.equal(inLine.ok, true);
  assert.equal(inLine.rotationZDeg, 0);
  assert.equal(inLine.centerXCm, 200 + inLine.lengthCm / 2);
  // Profil ucundan dik çıkınca yüzden (yarı kesit) başlar.
  const across = resolveFreeEndProfile(end, { xCm: 205, yCm: 300 }, items);
  assert.equal(across.centerYCm, 105 + across.lengthCm / 2);
  assert.equal(resolveFreeEndProfile(end, { xCm: 200.5, yCm: 100 }, items).ok, false);
});
