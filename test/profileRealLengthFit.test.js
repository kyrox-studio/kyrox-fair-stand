import test from 'node:test';
import assert from 'node:assert/strict';

import './registerCanonicalItemCatalog.mjs';
import { createModuleStateFromCatalogKey } from '../src/designState.js';
import {
  getModuleFootprintBoundsCm,
  getProfileSceneSlackCm,
  snapPlacementToModules,
  validatePlacementAgainstModules,
} from '../src/modulePlacement.js';

// Kullanıcı kararı (2026-11-13, proje 452d4cc1): profil gerçek boyundaki boşluğa sığar. Sahne ölçüsü
// eksenden eksene ızgaradır (Profil 190 sahnede 200, Profil 388 sahnede 400); iki uç arası yüzden yüze
// gerçek boy kadarsa profil oraya ortalı oturur, sahne fazlası iki uca eşit girer. Uç: dikme, duvarın
// uç dikmesi ya da dik duran profil ("dikme ya da profil – profil – profil"). Eskiden 190'lık araya
// 200'lük sahne profili sığmıyor, "Başka bir modülle çakışıyor" çıkıyordu.

const STAND = { standType: 'back-wall', standXCm: 700, standYCm: 800 };
const Z = 340;
const cm = (value) => Math.round(value * 100) / 100 + 0;
// Sahne ölçüleri gerçek DB'deki gibi (dikme 10 × 10, profil kesiti 10 × 10).
const SCENE = { upright: { widthCm: 10, depthCm: 10 }, profile_190: 200, profile_388: 400 };

function upright(id, xCm, yCm) {
  const state = createModuleStateFromCatalogKey('upright_346_5');
  Object.assign(state, SCENE.upright, { id, placement: { xCm, yCm, zCm: 0, wallId: 'free', rotationZDeg: 0 } });
  return state;
}

function profile(id, itemKey, placement) {
  return {
    id, type: 'profile', itemKey, widthCm: SCENE[itemKey], depthCm: 10, heightCm: 10,
    placement: { zCm: Z, wallId: 'free', ...placement },
  };
}

function wall(id, xCm, yCm) {
  const state = createModuleStateFromCatalogKey('wall_200_350');
  Object.assign(state, { id, placement: { xCm, yCm, zCm: 0, wallId: 'free', rotationZDeg: 0 } });
  return state;
}

function snap(itemKey, modules, pointerXCm, pointerYCm, rotationZDeg = 0) {
  const result = snapPlacementToModules({
    moduleId: 'moving', moduleType: 'profile', itemKey, heightCm: 10, widthCm: SCENE[itemKey], depthCm: 10,
    pointerXCm, pointerYCm, rotationZDeg, zCm: Z, modules, ...STAND,
  });
  assert.ok(result, `imleç (${pointerXCm}, ${pointerYCm}): yaslanma yok`);
  const bounds = getModuleFootprintBoundsCm({ widthCm: SCENE[itemKey], depthCm: 10, placement: result.placement });
  return { result, bounds: [bounds.minXCm, bounds.maxXCm, bounds.minYCm, bounds.maxYCm].map(cm) };
}

function validate(itemKey, placement, modules) {
  return validatePlacementAgainstModules({
    moduleId: 'moving', moduleType: 'profile', itemKey, heightCm: 10, widthCm: SCENE[itemKey], depthCm: 10,
    placement: { zCm: Z, wallId: 'free', rotationZDeg: 0, ...placement }, modules, ...STAND,
  });
}

test('sahne fazlası: Profil 190 → 10, Profil 388 → 12', () => {
  assert.equal(getProfileSceneSlackCm(profile('a', 'profile_190', { xCm: 0, yCm: 0 })), 10);
  assert.equal(getProfileSceneSlackCm(profile('b', 'profile_388', { xCm: 0, yCm: 0 })), 12);
});

test('duvar ucu ile dikme arası (eksenden eksene) 190: Profil 190 iki düğümü örterek oturur (kullanıcı projesi)', () => {
  // Duvar x 260–460 (uç dikmesi 450–460, ekseni 455), dikme x 640–650 (ekseni 645): eksenden eksene 190.
  const modules = [wall('w', 260, 600), upright('u', 640, 600)];
  for (const [px, py] of [[550, 600], [545, 605], [555, 596]]) {
    const { result, bounds } = snap('profile_190', modules, px, py);
    assert.equal(result.snapKind, 'post-gap', `imleç (${px}, ${py})`);
    assert.deepEqual(bounds, [450, 650, 595, 605], 'duvar ucunun ve dikmenin karesini örter');
  }
  assert.equal(validate('profile_190', { xCm: 450, yCm: 600 }, modules).ok, true);
});

test('iki dikme arası (eksenden eksene) 388: Profil 388 sığar', () => {
  const modules = [upright('a', 100, 300), upright('b', 488, 300)];
  const { result, bounds } = snap('profile_388', modules, 299, 300);
  assert.equal(result.snapKind, 'post-gap');
  assert.deepEqual(bounds, [99, 499, 295, 305]);
});

test('profil – profil – profil: iki dik profil arası (eksenden eksene) 190 ise Profil 190 sığar', () => {
  // İki dik profil (x 100–110 ve 290–300), eksenleri 105 ve 295.
  const modules = [
    profile('l', 'profile_190', { xCm: 105, yCm: 400, rotationZDeg: 90 }),
    profile('r', 'profile_190', { xCm: 295, yCm: 400, rotationZDeg: 90 }),
  ];
  // Hat imlece en yakın 10 cm adımda (dik profilin gövde ekseninden, T adımıyla aynı).
  const { result, bounds } = snap('profile_190', modules, 200, 505);
  assert.equal(result.snapKind, 'post-gap');
  assert.deepEqual(bounds, [100, 300, 500, 510]);
});

test('dikme – profil: dikme ile dik profil arası (eksenden eksene) 190 ise Profil 190 sığar', () => {
  const modules = [upright('u', 100, 300), profile('r', 'profile_190', { xCm: 295, yCm: 200, rotationZDeg: 90 })];
  const { result, bounds } = snap('profile_190', modules, 200, 300);
  assert.equal(result.snapKind, 'post-gap');
  assert.deepEqual(bounds, [100, 300, 295, 305]);
});

test('uca karesinden fazla giren profil hâlâ çakışır', () => {
  const modules = [wall('w', 260, 600), upright('u', 640, 600)];
  // Duvarın uç dikmesine 15 cm giriyor (kare 10).
  assert.equal(validate('profile_190', { xCm: 445, yCm: 600 }, modules).ok, false);
  // Duvarla aynı hatta değil (5 cm kaymış): uç muafiyeti yok.
  assert.equal(validate('profile_190', { xCm: 450, yCm: 605 }, modules).ok, false);
});

test('aralık gerçek boya uymuyorsa girmez: eksenleri 180 aralıklı iki uca Profil 190 girmez (kullanıcı kararı)', () => {
  // Duvar x 270–470 (uç ekseni 465), dikme x 640–650 (ekseni 645): eksenden eksene 180.
  const modules = [wall('w', 270, 600), upright('u', 640, 600)];
  const result = snapPlacementToModules({
    moduleId: 'moving', moduleType: 'profile', itemKey: 'profile_190', heightCm: 10, widthCm: 200, depthCm: 10,
    pointerXCm: 555, pointerYCm: 600, rotationZDeg: 0, zCm: Z, modules, ...STAND,
  });
  assert.notEqual(result?.snapKind, 'post-gap');
  assert.equal(validate('profile_190', { xCm: 455, yCm: 600 }, modules).ok, false);
});

test('aynı hattaki iki profil düğüm karesini birlikte örter (T düğümü); ortadan geçen profil çakışır', () => {
  // Duvar uçlarından sarkan dik profiller (x 260–270 ve 450–460, y 605–655); ön hat y 645–655.
  const stubs = [
    profile('s1', 'profile_190', { xCm: 265, yCm: 605, rotationZDeg: 90 }),
    profile('s2', 'profile_190', { xCm: 455, yCm: 605, rotationZDeg: 90 }),
  ];
  stubs.forEach((stub) => { stub.widthCm = 50; });
  const right = profile('r', 'profile_190', { xCm: 450, yCm: 650 });
  const modules = [...stubs, right];
  // Ortadaki profil 260–460: sağdaki profille 450–460 düğüm karesini paylaşır.
  assert.equal(validate('profile_190', { xCm: 260, yCm: 650 }, modules).ok, true);
  // Düğüm yoksa (dik profil kaldırılmış) paylaşım yok: çakışır.
  assert.equal(validate('profile_190', { xCm: 260, yCm: 650 }, [stubs[0], right]).ok, false);
  // Sağdaki profilin içine 20 cm giren profil çakışır.
  assert.equal(validate('profile_190', { xCm: 270, yCm: 650 }, modules).ok, false);
});

test('yüzden yüze sahne boyu kadar aralığa da girer: iki çıkıntı arası yüzden yüze 200, Profil 190 (kullanıcı kararı)', () => {
  // Sol çerçeve çıkıntısı x 50–60, duvar ucundaki çıkıntı x 260–270 (eksenleri 55 ve 265: 210).
  const modules = [
    { ...profile('a', 'profile_190', { xCm: 55, yCm: 615, rotationZDeg: 90 }), widthCm: 50 },
    { ...profile('b', 'profile_190', { xCm: 265, yCm: 615, rotationZDeg: 90 }), widthCm: 50 },
  ];
  const { result, bounds } = snap('profile_190', modules, 160, 660);
  assert.equal(result.snapKind, 'post-gap');
  assert.deepEqual(bounds, [60, 260, 655, 665], 'iki çıkıntının iç yüzleri arasına, uç hattına');
});

test('duvar gövdesi de uçtur: arka duvar ile dikme arası eksenden eksene 400, Profil 388 duvar yüzünden dikmeyi örter (kullanıcı projesi)', () => {
  // Arka duvar y -5–5 (ekseni 0), dikme x 50–60 y 395–405 (ekseni 400).
  const modules = [wall('w', 0, 0), upright('u', 50, 400)];
  const result = snapPlacementToModules({
    moduleId: 'moving', moduleType: 'profile', itemKey: 'profile_388', heightCm: 10, widthCm: 400, depthCm: 10,
    pointerXCm: 55, pointerYCm: 205, rotationZDeg: 90, zCm: Z, modules, ...STAND,
  });
  assert.equal(result?.snapKind, 'post-gap');
  const b = getModuleFootprintBoundsCm({ widthCm: 400, depthCm: 10, placement: result.placement });
  assert.deepEqual([b.minXCm, b.maxXCm, b.minYCm, b.maxYCm].map(cm), [50, 60, 5, 405]);
});
