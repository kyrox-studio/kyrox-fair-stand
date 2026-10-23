import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearDuplicateLock,
  findLockedModuleMoves,
  guardPlanAgainstLocks,
  isModuleLocked,
  getModulesLockState,
  planSelectionRemoval,
  setModulesLocked,
} from '../src/moduleLock.js';

test('toplu silme kilitli öğe veya grup varken hiçbirini silmez; kimlikleri tekilleştirir', () => {
  const modules = [{ id: 'a' }, { id: 'b', locked: true }, { id: 'c', group: { locked: true } }];
  const original = structuredClone(modules);
  assert.deepEqual(planSelectionRemoval(modules, ['a', 'b', 'c']), { ok: false, moduleIds: ['a', 'b', 'c'], blockedIds: ['b', 'c'] });
  assert.deepEqual(modules, original);
  assert.deepEqual(planSelectionRemoval(modules, ['a', 'a', 'missing']), { ok: true, moduleIds: ['a'], blockedIds: [] });
  assert.equal(planSelectionRemoval(modules, ['missing']).ok, false);
});
import { planContinuousModuleInsert } from '../src/moduleMove.js';

function back(id, xCm, widthCm = 100, extra = {}) {
  return { id, type: 'flat-panel', widthCm, placement: { wallId: 'back', xCm, yCm: 0, zCm: 0, rotationZDeg: 0 }, ...extra };
}

test('isModuleLocked yalnız locked === true için kilitli sayar', () => {
  assert.equal(isModuleLocked({ locked: true }), true);
  assert.equal(isModuleLocked({ locked: 'true' }), false);
  assert.equal(isModuleLocked({}), false);
  assert.equal(isModuleLocked(null), false);
});

test('setModulesLocked kilitler, kilidi açınca alanı siler ve değişeni sayar', () => {
  const modules = [back('a', 0), back('b', 100), back('c', 200)];
  assert.equal(setModulesLocked(modules, ['a', 'b'], true), 2);
  assert.equal(setModulesLocked(modules, ['a'], true), 0, 'zaten kilitli olan sayılmaz');
  assert.deepEqual(modules.map(isModuleLocked), [true, true, false]);
  assert.equal(setModulesLocked(modules, ['a', 'c'], false), 1);
  assert.equal(Object.hasOwn(modules[0], 'locked'), false, 'kilit açılınca alan kalmaz');
  assert.equal(isModuleLocked(modules[1]), true);
});

test('clearDuplicateLock kopyanın kilidini kaldırır', () => {
  const copy = clearDuplicateLock({ id: 'x', locked: true });
  assert.equal(Object.hasOwn(copy, 'locked'), false);
});

test('findLockedModuleMoves yalnız yeri değişen kilitli modülleri döndürür', () => {
  const modules = [back('a', 0, 100, { locked: true }), back('b', 100), back('c', 200, 100, { locked: true })];
  const placements = new Map([
    ['a', { wallId: 'back', xCm: 0, yCm: 0, zCm: 0, rotationZDeg: 360 }], // aynı yer (360 = 0)
    ['b', { wallId: 'back', xCm: 150, yCm: 0 }],
    ['c', { wallId: 'back', xCm: 250, yCm: 0 }],
  ]);
  assert.deepEqual(findLockedModuleMoves(placements, modules).map((m) => m.id), ['c']);
});

test('findLockedModuleMoves duvar etiketi farkını yer değişikliği saymaz', () => {
  const modules = [{ id: 'a', locked: true, placement: { wallId: 'free', xCm: 0, yCm: 0 } }];
  const placements = new Map([['a', { wallId: 'back', xCm: 0, yCm: 0 }]]);
  assert.deepEqual(findLockedModuleMoves(placements, modules), []);
});

test('guardPlanAgainstLocks kilitli modülü oynatan planı reddeder', () => {
  const modules = [back('a', 0, 100, { locked: true })];
  const plan = { ok: true, placements: new Map([['a', { xCm: 50, yCm: 0 }]]) };
  const guarded = guardPlanAgainstLocks(plan, modules);
  assert.equal(guarded.ok, false);
  assert.deepEqual(guarded.lockedModuleIds, ['a']);
  assert.match(guarded.message, /kilitli/);

  const failed = { ok: false, message: 'x' };
  assert.equal(guardPlanAgainstLocks(failed, modules), failed, 'başarısız plan aynen döner');
  const clean = { ok: true, placements: new Map([['a', { ...modules[0].placement }]]) };
  assert.equal(guardPlanAgainstLocks(clean, modules), clean, 'kilitliyi oynatmayan plan aynen döner');
});

test('zincire ekleme kilitli komşuyu kaydıracaksa plan reddedilir, kaydırmıyorsa geçer', () => {
  // a(0-100) b(100-200) c(200-300) arka duvarda. 100'e 50 cm eklemek b ve c'yi sağa kaydırır.
  const placementOf = (x) => ({ wallId: 'back', xCm: x, yCm: 0 });
  const build = (lockedId) => ['a', 'b', 'c'].map((id, i) => ({
    id, widthCm: 100, placement: placementOf(i * 100), ...(id === lockedId ? { locked: true } : {}),
  }));
  const insert = (modules) => planContinuousModuleInsert({
    modules,
    insertedModule: { id: 'new', widthCm: 50, placement: null },
    desiredPlacement: placementOf(100),
    standType: 'back-wall',
    standXCm: 500,
    standYCm: 400,
  });

  const withLockedC = build('c');
  const plan = insert(withLockedC);
  assert.equal(plan.ok, true);
  assert.notEqual(plan.placements.get('c')?.xCm, 200, 'ön koşul: plan c\'yi kaydırıyor');
  const guarded = guardPlanAgainstLocks(plan, withLockedC);
  assert.equal(guarded.ok, false);
  assert.deepEqual(guarded.lockedModuleIds, ['c']);

  const withLockedA = build('a');
  const planA = insert(withLockedA);
  assert.equal(guardPlanAgainstLocks(planA, withLockedA), planA, 'yerinde kalan kilitli a engellemez');
});

test('toplu kilit durumu boş sahne, karma kilit ve grup kilidini doğru sayar', () => {
  assert.deepEqual(getModulesLockState(), { total: 0, locked: 0, allLocked: false, partiallyLocked: false });
  const modules = [{ id: 'a', locked: true }, { id: 'b' }, { id: 'c', group: { locked: true } }];
  assert.deepEqual(getModulesLockState(modules), { total: 3, locked: 2, allLocked: false, partiallyLocked: true });
  setModulesLocked(modules, modules.map(module => module.id), true);
  assert.deepEqual(getModulesLockState(modules), { total: 3, locked: 3, allLocked: true, partiallyLocked: false });
});
