import test from 'node:test';
import assert from 'node:assert/strict';

import { createModuleStateFromDescriptor } from '../src/designState.js';
import { getItem } from '../src/items.js';
import { createModulePlacement, stepWallShortStackZCm } from '../src/modulePlacement.js';
import { resolveProjectBom } from '../src/projectBom.js';

// Kullanıcı kararı (2026-11-16): yalnız kısa panellerden oluşan kolonda her plan ucunda tek dikme
// (99 + 49,5 → 148,5; 99 + 99 → 198); kısa panel ↑/↓ 50 cm ızgarada, alttakinin tepesine oturur.
function short(id, itemKey, xCm, zCm) {
  const state = createModuleStateFromDescriptor({ itemKey, type: getItem(itemKey).type });
  state.id = id;
  state.placement = createModulePlacement({ xCm, yCm: 0, zCm, rotationZDeg: 0, wallId: 'free' });
  return state;
}

function uprights(modules) {
  return Object.fromEntries(resolveProjectBom(modules).lines
    .filter((line) => line.itemKey.startsWith('upright_'))
    .map((line) => [line.itemKey, line.quantity]));
}

test('kısa panel kolonu her uçta tek dikme sayılır', () => {
  assert.deepEqual(
    uprights([short('a', 'wall_100_short_2', 0, 0), short('b', 'wall_100_short_1', 0, 100)]),
    { upright_148_5: 2 },
  );
  assert.deepEqual(
    uprights([short('a', 'wall_100_short_2', 0, 0), short('b', 'wall_100_short_2', 0, 100)]),
    { upright_198: 2 },
  );
  assert.deepEqual(
    uprights([short('a', 'wall_100_short_1', 0, 0), short('b', 'wall_100_short_1', 0, 50)]),
    { upright_99: 2 },
  );
  assert.deepEqual(
    uprights([
      short('a', 'wall_100_short_2', 0, 0),
      short('b', 'wall_100_short_2', 0, 100),
      short('c', 'wall_100_short_1', 0, 200),
    ]),
    { upright_247_5: 2 },
  );
});

test('yan yana iki kolonun ortak ucu açıklık içinde ara profildir (148,5 → 140,5)', () => {
  const modules = [
    short('a', 'wall_100_short_2', 0, 0),
    short('b', 'wall_100_short_1', 0, 100),
    short('c', 'wall_100_short_2', 100, 0),
    short('d', 'wall_100_short_1', 100, 100),
  ];
  // Alt ray (a, c) ve üst ray (b, d) kesintisiz: ortak uç taşıyıcı değil (2026-11-16).
  assert.deepEqual(uprights(modules), { upright_148_5: 2 });
  const profile140 = resolveProjectBom(modules).lines.find((line) => line.itemKey === 'profile_140_5');
  assert.equal(profile140?.quantity, 1);
});

test('bitişik olmayan (binen) kısa paneller birleşmez', () => {
  assert.deepEqual(
    uprights([short('a', 'wall_100_short_2', 0, 0), short('b', 'wall_100_short_1', 0, 90)]),
    { upright_99: 2, upright_49_5: 2 },
  );
});

test('kısa panel ↑/↓ 50 cm ızgarada iner, alttakine binmez', () => {
  const lower = short('a', 'wall_100_short_2', 0, 0);
  const upper = short('b', 'wall_100_short_1', 0, 90);
  const modules = [lower, upper];
  // Eski binen konum (90) ilk adımda ızgaraya oturur.
  assert.equal(stepWallShortStackZCm({ moduleState: upper, modules, direction: 'up', standHeightCm: 500 }), 100);
  // 90'dan aşağı: 50 ve 0 alttakine biner; gidilecek yer yok.
  assert.equal(stepWallShortStackZCm({ moduleState: upper, modules, direction: 'down', standHeightCm: 500 }), 90);
  upper.placement.zCm = 200;
  assert.equal(stepWallShortStackZCm({ moduleState: upper, modules, direction: 'down', standHeightCm: 500 }), 150);
  upper.placement.zCm = 150;
  assert.equal(stepWallShortStackZCm({ moduleState: upper, modules, direction: 'down', standHeightCm: 500 }), 100);
  upper.placement.zCm = 100;
  assert.equal(stepWallShortStackZCm({ moduleState: upper, modules, direction: 'down', standHeightCm: 500 }), 100);
  // Başka hatta duran panel engel değildir.
  const elsewhere = short('c', 'wall_100_short_2', 300, 0);
  assert.equal(stepWallShortStackZCm({ moduleState: elsewhere, modules: [...modules, elsewhere], direction: 'up', standHeightCm: 500 }), 50);
});

test('sahne: üst üste kısa paneller tek kolon çizilir (ray ve dikme bilgisi)', async () => {
  const { resolveWallCornerEnds } = await import('../src/wallCornerJoints.js');
  const lower = short('a', 'wall_100_short_2', 0, 0);
  const upper = short('b', 'wall_100_short_1', 0, 100);
  const top = short('c', 'wall_100_short_1', 0, 150);
  const ends = resolveWallCornerEnds([lower, upper, top]);
  const stackOf = (id) => (ends.get(id) ?? []).find((end) => end.stack);
  assert.deepEqual({ ...stackOf('a') }, { stack: true, below: false, above: true, uprightTopCm: 200, chainId: 'a', bandOffset: 0 });
  assert.deepEqual({ ...stackOf('b') }, { stack: true, below: true, above: true, uprightTopCm: null, chainId: 'a', bandOffset: 2 });
  assert.deepEqual({ ...stackOf('c') }, { stack: true, below: true, above: false, uprightTopCm: null, chainId: 'a', bandOffset: 3 });

  // Binen ya da farklı genişlikteki kısa panel kolon sayılmaz.
  const overlapping = resolveWallCornerEnds([lower, short('d', 'wall_100_short_1', 0, 90)]);
  assert.equal((overlapping.get('a') ?? []).some((end) => end.stack), false);
  const narrower = resolveWallCornerEnds([lower, short('e', 'wall_50_short_1', 0, 100)]);
  assert.equal((narrower.get('a') ?? []).some((end) => end.stack), false);
});

test('bırakınca / açılışta kısa panel ±25 cm içindeki tepeye oturur', async () => {
  const { seatWallShortZCm, seatWallShortStacks } = await import('../src/modulePlacement.js');
  const lower = short('a', 'wall_100_short_2', 0, 0);
  const near = (zCm) => seatWallShortZCm({ moduleState: short('b', 'wall_100_short_1', 0, zCm), modules: [lower], standHeightCm: 500 });
  assert.equal(near(90), 100); // biniyor → tepeye
  assert.equal(near(120), 100); // 20 cm boşluk → tepeye
  assert.equal(near(100), 100);
  assert.equal(near(140), 140); // 40 cm uzakta → dokunulmaz
  // Başka hatta / genişlik örtüşmüyorsa dokunulmaz.
  const elsewhere = short('c', 'wall_100_short_1', 300, 90);
  assert.equal(seatWallShortZCm({ moduleState: elsewhere, modules: [lower], standHeightCm: 500 }), 90);

  // Açılış onarımı: alttan üste sırayla oturur (90 → 100, 160 → 150).
  const stack = [lower, short('d', 'wall_100_short_1', 0, 90), short('e', 'wall_100_short_1', 0, 160)];
  assert.equal(seatWallShortStacks(stack), 2);
  assert.deepEqual(stack.map((m) => m.placement.zCm), [0, 100, 150]);
});

test('sahne: yan yana kısa panellerin rayı listedeki açıklık profiliyle tek parça çizilir', async () => {
  const { resolveWallCornerEnds } = await import('../src/wallCornerJoints.js');
  const { detectShortProfileRuns } = await import('../src/relationshipBom.js');
  const left = short('l', 'wall_200_short_1', 0, 300);
  const right = short('r', 'wall_200_short_1', 200, 300);
  const runs = detectShortProfileRuns([left, right]);
  assert.equal(runs.length, 2);
  assert.deepEqual(runs.map((run) => run.rail).sort(), ['bottom', 'top']);
  assert.deepEqual([...runs[0].moduleIds], ['l', 'r']);
  const ends = resolveWallCornerEnds([left, right]);
  const railRuns = (id) => (ends.get(id) ?? []).filter((end) => end.railRun);
  assert.equal(railRuns('l').length, 2);
  assert.ok(railRuns('l').every((end) => end.owner && end.toCm - end.fromCm === 400));
  assert.ok(railRuns('r').every((end) => !end.owner));
});

test('sahne: açıklık içindeki ortak uç ara profil olarak çizilir, dış uçlar dikme kalır', async () => {
  const { resolveWallCornerEnds } = await import('../src/wallCornerJoints.js');
  const left = short('l', 'wall_200_short_1', 0, 300);
  const right = short('r', 'wall_200_short_1', 200, 300);
  const infills = [...resolveWallCornerEnds([left, right]).values()].flat().filter((end) => end.infill);
  // Ortak uç tek kez ara profildir (Profil 41,5); listedeki parçayla aynı kalem.
  assert.equal(infills.length, 1);
  assert.deepEqual([...infills[0].pieces], ['profile_41_5']);
  assert.ok([-1, 1].includes(infills[0].localXSign));
  // Tek panelde açıklık yok: ara profil de yok.
  const single = [...resolveWallCornerEnds([left]).values()].flat().filter((end) => end.infill);
  assert.equal(single.length, 0);
});

test('sahne: açıklık rayı yan duvarın dikmesine değer; kesintisiz rayın içinden dikme geçmez', async () => {
  const { resolveWallCornerEnds } = await import('../src/wallCornerJoints.js');
  const { createModuleStateFromCatalogKey } = await import('../src/designState.js');
  const wall = createModuleStateFromCatalogKey('wall_150_350');
  wall.id = 'wall';
  wall.placement = createModulePlacement({ xCm: 0, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'free' });
  // Winset (2026-11-18): tam boy duvarın yanında iki kısa panel, rayı ilk kısa panel çizer.
  const left = short('l', 'wall_150_short_1', 150, 300);
  const right = short('r', 'wall_200_short_1', 300, 300);
  const ends = resolveWallCornerEnds([wall, left, right]);
  const runs = (ends.get('l') ?? []).filter((end) => end.railRun && end.owner);
  assert.equal(runs.length, 2);
  // Duvar tarafındaki uçta kısa panelin dikmesi yok: ray 8 cm içeride değil, duvarın dikmesinde biter.
  for (const run of runs) {
    const wallSide = run.fromCm < 0 ? run.fromInsetCm : run.toInsetCm;
    assert.notEqual(wallSide, null);
    assert.ok(wallSide < 8, `ray ucu boşluğu ${wallSide}`);
  }
});

test('köşede 346,5 dikmesinin üstüne binen kısa panel: liste 396, sahne dikmeyi kısa panelin tepesine uzatır', async () => {
  const { resolveWallCornerEnds } = await import('../src/wallCornerJoints.js');
  const { createModuleStateFromCatalogKey } = await import('../src/designState.js');
  // Winset (2026-11-18): sağ duvar (x=500, y 200→400) ve önde üst üste iki 200'lük kısa panel; üstteki
  // (350–400) sağ duvarın köşe dikmesinin hemen üstündedir.
  const side = createModuleStateFromCatalogKey('wall_200_350');
  side.id = 'side';
  side.placement = createModulePlacement({ xCm: 500, yCm: 200, zCm: 0, rotationZDeg: 270, wallId: 'free' });
  const lower = short('lower', 'wall_200_short_1', 300, 300);
  const upper = short('upper', 'wall_200_short_1', 300, 350);
  lower.placement.yCm = 400;
  upper.placement.yCm = 400;
  const result = uprights([side, lower, upper]);
  assert.equal(result.upright_396, 1);
  const ends = resolveWallCornerEnds([side, lower, upper]);
  const post = (ends.get('side') ?? []).find((end) => end.stackPost);
  assert.ok(post, 'köşe dikmesi uzar');
  assert.equal(post.topCm, 400);
  // Üstteki kısa panelin rayı köşe dikmesinde biter (kendi dikmesi yok).
  assert.ok((ends.get('upper') ?? []).some((end) => end.postWidthCm != null));
});
