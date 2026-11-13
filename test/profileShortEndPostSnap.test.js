import test from 'node:test';
import assert from 'node:assert/strict';

import './registerCanonicalItemCatalog.mjs';
import { createModuleStateFromCatalogKey } from '../src/designState.js';
import {
  getModuleFootprintBoundsCm,
  snapPlacementToModules,
  validatePlacementAgainstModules,
} from '../src/modulePlacement.js';
import { planGroupTranslate } from '../src/moduleGroups.js';
import { resolveWallCornerEnds } from '../src/wallCornerJoints.js';

// 2026-11-12: short'a dik gelen profil short ucundaki dikmenin üstüne biner; ucu short'un dış
// yüzüyle hizalı, ekseni dikmenin ekseninde. Profil ile baza aynı derinlikte (50) olduğundan
// profil bazayla birebir hizalanır. Eskiden profil short'un eksen ucuna bağlanıp bazadan 5 cm
// taşıyordu; bu yüzden grup stand kenarına 5 cm kala duruyordu (kullanıcı projesi 9c4c62af).

const cm = (value) => Math.round(value * 100) / 100 + 0;
const UPRIGHT_SCENE = { widthCm: 10, depthCm: 10 };
const STAND = { standType: 'back-wall', standXCm: 700, standYCm: 800 };

// Sahnedeki 49,5 profil 50 × 10 × 10 (DB sahne ölçüsü); test kataloğunda sahne kaydı yok.
function profileState() {
  return { type: 'profile', itemKey: 'profile_49_5', widthCm: 50, depthCm: 10, heightCm: 10 };
}

function placed(id, itemKey, placement, overrides = {}) {
  const moduleState = itemKey === 'profile_49_5' ? profileState() : createModuleStateFromCatalogKey(itemKey);
  Object.assign(moduleState, overrides);
  moduleState.id = id;
  moduleState.placement = { zCm: 0, wallId: 'free', ...placement };
  return moduleState;
}

// Kullanıcının "sol" grubu: baza (x 10–60), arka köşelerinde dikmeler, dikmelerin üstünde short'lar.
function frame(baseXCm = 35) {
  const dx = baseXCm - 35;
  return [
    placed('base', 'base_200', { xCm: 35 + dx, yCm: 220, rotationZDeg: 270 }),
    placed('u1', 'upright_346_5', { xCm: 50 + dx, yCm: 415, rotationZDeg: 0 }, UPRIGHT_SCENE),
    placed('u2', 'upright_346_5', { xCm: 50 + dx, yCm: 225, rotationZDeg: 0 }, UPRIGHT_SCENE),
    placed('s1', 'wall_200_short_1', { xCm: 55 + dx, yCm: 220, zCm: 300, rotationZDeg: 270 }),
    placed('s2', 'wall_200_short_2', { xCm: 55 + dx, yCm: 220, zCm: 210, rotationZDeg: 270 }),
  ];
}

function snapProfile(modules, pointerXCm, pointerYCm) {
  const profile = profileState();
  const result = snapPlacementToModules({
    moduleId: 'p',
    moduleType: profile.type,
    itemKey: profile.itemKey,
    heightCm: profile.heightCm,
    widthCm: profile.widthCm,
    depthCm: profile.depthCm,
    pointerXCm,
    pointerYCm,
    rotationZDeg: 0,
    zCm: 340,
    modules,
    ...STAND,
  });
  assert.ok(result, `imleç (${pointerXCm}, ${pointerYCm}): yaslanma yok`);
  return { profile, result, bounds: getModuleFootprintBoundsCm({ ...profile, placement: result.placement }) };
}

test('short ucunda dikme varsa o dikmedir: profil ortalanır, dikmenin yüzünde durur', () => {
  // Kullanıcı kararı 2026-11-12 ("dikme her yerde dikme"): short'un ucundaki bağımsız dikmede de
  // profil dikmenin içine girmez. 49,5 profil (sahnede 50) dikmenin ön yüzünden (x 50) öne uzanır.
  const modules = frame();
  for (const [px, py, minY] of [[30, 420, 410], [35, 415, 410], [30, 220, 220], [35, 225, 220]]) {
    const { result, bounds } = snapProfile(modules, px, py);
    assert.equal(result.snapKind, 'upright-face', `imleç (${px}, ${py})`);
    assert.equal(cm(bounds.maxXCm), 50, 'profil dikmenin ön yüzünde durur');
    assert.equal(cm(bounds.minXCm), 0);
    assert.equal(cm(bounds.minYCm), minY, 'profil dikmenin ekseninde');
    assert.equal(result.placement.zCm, 340);
  }
});

test('short ucunda dikme yoksa profil short ucunu örter (köşe kuralı)', () => {
  const modules = frame().filter((moduleState) => moduleState.type !== 'upright');
  const baseBounds = getModuleFootprintBoundsCm(modules[0]);
  const { result, bounds } = snapProfile(modules, 35, 415);
  assert.equal(result.snapKind, 'short-end-post');
  assert.equal(cm(bounds.minXCm), cm(baseBounds.minXCm));
  assert.equal(cm(bounds.maxXCm), cm(baseBounds.maxXCm));
});

test('short ucundaki kesit karesinde profil çakışma sayılmaz; short gövdesinin ortası çakışmadır', () => {
  const modules = frame();
  const profile = profileState();
  const validate = (yCm) => validatePlacementAgainstModules({
    moduleId: 'p',
    moduleType: profile.type,
    itemKey: profile.itemKey,
    heightCm: profile.heightCm,
    widthCm: profile.widthCm,
    depthCm: profile.depthCm,
    placement: { xCm: 10, yCm, zCm: 340, rotationZDeg: 0, wallId: 'free' },
    modules,
    ...STAND,
  });
  assert.equal(validate(415).ok, true);
  assert.equal(validate(225).ok, true);
  assert.equal(validate(315).ok, false);
});

test('hizalı profilli grup stand kenarına sıfır taşınır', () => {
  const modules = frame();
  const group = { id: 'g', name: 'sol', locked: false };
  const profiles = [415, 225].map((yCm, index) => placed(`p${index}`, 'profile_49_5', {
    xCm: 10, yCm, zCm: 340, rotationZDeg: 0,
  }));
  const all = [...modules, ...profiles];
  all.forEach((moduleState) => { moduleState.group = { ...group }; });
  const plan = planGroupTranslate(all, 'g', -10, 0, STAND);
  assert.equal(plan.ok, true, plan.message);
  assert.equal(cm(getModuleFootprintBoundsCm({ ...all[0], placement: plan.placements.get('base') }).minXCm), 0);
  assert.equal(cm(getModuleFootprintBoundsCm({ ...profiles[0], placement: plan.placements.get('p0') }).minXCm), 0);
});

test('çizim: short ucundaki dikme short uç dikmesinin yerini alır, profil short iç yüzünde biter', () => {
  const profiles = [415, 225].map((yCm, index) => placed(`p${index}`, 'profile_49_5', {
    xCm: 10, yCm, zCm: 340, rotationZDeg: 0,
  }));
  const modules = [...frame(), ...profiles];
  const ends = resolveWallCornerEnds(modules);
  const sorted = (id) => [...(ends.get(id) ?? [])].sort((a, b) => a.localXSign - b.localXSign);
  for (const id of ['s1', 's2']) {
    assert.deepEqual(sorted(id), [
      { localXSign: -1, postWidthCm: 10 },
      { localXSign: 1, postWidthCm: 10 },
    ], id);
  }
  // Profil +x yönünde short'a (x 50–60) ulaşır: o uçta short derinliği (10) kadar kısa çizilir.
  assert.deepEqual(sorted('p0'), [{ localXSign: 1, trimCm: 10 }]);
  assert.deepEqual(sorted('p1'), [{ localXSign: 1, trimCm: 10 }]);
  // Dikme short'un yüksekliğine ulaşmıyorsa short kendi dikmesini çizer.
  const low = frame();
  low[1].heightCm = 100;
  low[2].heightCm = 100;
  assert.equal(resolveWallCornerEnds(low).get('s1'), undefined);
});

// Kullanıcı kararı 2026-11-12: bütün profil–profil L köşeleri dış yüzden hizalanır; çerçeve bazanın
// içinde kalır (eskiden 190 ön profil 49,5'lerin eksen ucuna bağlanıp bazadan 5 cm taşıyordu).
function frontProfileState() {
  return { type: 'profile', itemKey: 'profile_190', widthCm: 200, depthCm: 10, heightCm: 10 };
}

function snapFront(modules, pointerXCm, pointerYCm) {
  const front = frontProfileState();
  const result = snapPlacementToModules({
    moduleId: 'q',
    moduleType: front.type,
    itemKey: front.itemKey,
    heightCm: front.heightCm,
    widthCm: front.widthCm,
    depthCm: front.depthCm,
    pointerXCm,
    pointerYCm,
    rotationZDeg: 270,
    zCm: 340,
    modules,
    ...STAND,
  });
  assert.ok(result, `imleç (${pointerXCm}, ${pointerYCm}): yaslanma yok`);
  return { result, bounds: getModuleFootprintBoundsCm({ ...front, placement: result.placement }) };
}

function sideProfiles() {
  return [415, 225].map((yCm, index) => placed(`p${index}`, 'profile_49_5', {
    xCm: 10, yCm, zCm: 340, rotationZDeg: 0,
  }));
}

test('profil–profil L köşesi dış yüzden hizalı: ön profil bazanın içinde, 49,5 uçlarını örter', () => {
  const modules = [...frame(), ...sideProfiles()];
  const baseBounds = getModuleFootprintBoundsCm(modules[0]);
  for (const [px, py] of [[10, 320], [15, 320], [18, 330], [12, 310]]) {
    const { result, bounds } = snapFront(modules, px, py);
    assert.equal(result.snapKind, 'profile-flush-corner', `imleç (${px}, ${py})`);
    assert.equal(cm(bounds.minXCm), cm(baseBounds.minXCm), 'ön profil bazanın ön yüzünde');
    assert.equal(cm(bounds.maxXCm), cm(baseBounds.minXCm) + 10);
    assert.equal(cm(bounds.minYCm), cm(baseBounds.minYCm));
    assert.equal(cm(bounds.maxYCm), cm(baseBounds.maxYCm));
  }
});

test('ön profil varken 49,5 profil de dış yüzden hizalı oturur', () => {
  const front = placed('q', 'profile_190', { xCm: 15, yCm: 220, zCm: 340, rotationZDeg: 270 });
  front.type = 'profile';
  Object.assign(front, frontProfileState(), { id: 'q', placement: front.placement });
  const modules = [...frame(), front];
  const { result, bounds } = snapProfile(modules, 35, 222);
  assert.ok(['profile-flush-corner', 'short-end-post'].includes(result.snapKind), result.snapKind);
  assert.equal(cm(bounds.minXCm), 10);
  assert.equal(cm(bounds.maxXCm), 60);
  assert.equal(cm(bounds.minYCm), 220);
});

test('çizim: L köşede kareyi uzun profil tutar, 49,5 iki ucunda da kısa çizilir', () => {
  const front = { ...frontProfileState(), id: 'q', placement: { xCm: 15, yCm: 220, zCm: 340, rotationZDeg: 270, wallId: 'free' } };
  const modules = [...frame(), ...sideProfiles(), front];
  const ends = resolveWallCornerEnds(modules);
  const sorted = (id) => [...(ends.get(id) ?? [])].sort((a, b) => a.localXSign - b.localXSign);
  for (const id of ['p0', 'p1']) {
    assert.deepEqual(sorted(id), [
      { localXSign: -1, trimCm: 10 },
      { localXSign: 1, trimCm: 10 },
    ], id);
  }
  assert.equal(ends.get('q'), undefined, 'uzun profil tam boy çizilir');
  // Farklı yükseklikteki profil köşe sayılmaz.
  const low = { ...front, placement: { ...front.placement, zCm: 200 } };
  assert.equal(resolveWallCornerEnds([...frame(), ...sideProfiles(), low]).get('p0')?.length, 1);
});

// Kullanıcı kararı 2026-11-12: profil dikmeye ortalı yapışır, dikmenin içine girmez, yüzünde durur.
function snapLong(modules, pointerXCm, pointerYCm, rotationZDeg) {
  const long = { type: 'profile', itemKey: 'profile_190', widthCm: 200, depthCm: 10, heightCm: 10 };
  const result = snapPlacementToModules({
    moduleId: 'z',
    moduleType: long.type,
    itemKey: long.itemKey,
    heightCm: long.heightCm,
    widthCm: long.widthCm,
    depthCm: long.depthCm,
    pointerXCm,
    pointerYCm,
    rotationZDeg,
    zCm: 340,
    modules,
    ...STAND,
  });
  assert.ok(result, `imleç (${pointerXCm}, ${pointerYCm})`);
  return { result, bounds: getModuleFootprintBoundsCm({ ...long, placement: result.placement }) };
}

test('profil tek dikmeye iki yönden de ortalı yapışır ve dikmenin yüzünde durur', () => {
  const upright = placed('u', 'upright_346_5', { xCm: 300, yCm: 400, rotationZDeg: 0 }, UPRIGHT_SCENE);
  // Dikme x 300–310, y 395–405.
  const along = snapLong([upright], 305, 300, 270);
  assert.equal(along.result.snapKind, 'upright-face');
  assert.deepEqual([cm(along.bounds.minXCm), cm(along.bounds.maxXCm), cm(along.bounds.maxYCm)], [300, 310, 395]);
  const across = snapLong([upright], 200, 405, 0);
  assert.equal(across.result.snapKind, 'upright-face');
  assert.deepEqual([cm(across.bounds.minYCm), cm(across.bounds.maxYCm), cm(across.bounds.maxXCm)], [395, 405, 300]);
});

test('short hattında gelen profil dikmenin karesine girmez, dikmenin yüzünde biter', () => {
  const modules = [...frame(), ...sideProfiles()];
  const { bounds } = snapLong(modules, 55, 120, 270);
  assert.equal(cm(bounds.minXCm), 50, 'short ile aynı eksende');
  assert.equal(cm(bounds.maxYCm), 220, 'dikmenin yüzünde (220) biter');
});

test('dikme her yerde dikme: tek dikmeye ve duvar uç dikmesine dört yönden ortalı, yüzde durur', () => {
  const upright = placed('u', 'upright_346_5', { xCm: 350, yCm: 400, rotationZDeg: 0 }, UPRIGHT_SCENE);
  // Dikme x 350–360, y 395–405.
  const cases = [
    [355, 300, 270, [350, 360, 195, 395]], // önden
    [355, 500, 270, [350, 360, 405, 605]], // arkadan
    [250, 400, 0, [150, 350, 395, 405]], // soldan
    [460, 400, 0, [360, 560, 395, 405]], // sağdan
  ];
  for (const [px, py, rotation, expected] of cases) {
    const { result, bounds } = snapLong([upright], px, py, rotation);
    assert.equal(result.snapKind, 'upright-face', `imleç (${px}, ${py})`);
    assert.deepEqual([bounds.minXCm, bounds.maxXCm, bounds.minYCm, bounds.maxYCm].map(cm), expected);
  }
  const wall = placed('w', 'wall_200_350', { xCm: 250, yCm: 400, rotationZDeg: 0 });
  // Duvar x 250–450, y 395–405; uç dikmeleri 250–260 ve 440–450.
  const wallCases = [
    [255, 300, 270, [250, 260, 195, 395]],
    [255, 500, 270, [250, 260, 405, 605]],
    [150, 400, 0, [50, 250, 395, 405]],
    [445, 300, 270, [440, 450, 195, 395]],
    [550, 400, 0, [450, 650, 395, 405]],
  ];
  for (const [px, py, rotation, expected] of wallCases) {
    const { result, bounds } = snapLong([wall], px, py, rotation);
    assert.equal(result.snapKind, 'upright-face', `duvar, imleç (${px}, ${py})`);
    assert.deepEqual([bounds.minXCm, bounds.maxXCm, bounds.minYCm, bounds.maxYCm].map(cm), expected);
  }
});
