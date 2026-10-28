import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assemblyPartKey,
  addPartToLockGroup,
  applyPoseDelta,
  createAssemblyLock,
  createAssemblyLockGroup,
  lockContainsPart,
  lockGroupFromParts,
  removePartFromLockGroup,
  poseDelta,
} from '../src/itemAdminAssemblyLock.js';

test('assemblyPartKey joins child and instance', () => {
  assert.equal(assemblyPartKey('upright_99', 0), 'upright_99#0');
});


test('createAssemblyLock rejects same part', () => {
  const part = { childItemKey: 'a', instanceIndex: 0 };
  const pose = {
    xCm: 0, yCm: 0, zCm: 0, rotationXDeg: 0, rotationYDeg: 0, rotationZDeg: 0,
  };
  assert.equal(createAssemblyLock(part, part, pose, pose), null);
});

test('createAssemblyLock stores host follower members and relative', () => {
  const lock = createAssemblyLock(
    { childItemKey: 'upright_99', instanceIndex: 0 },
    { childItemKey: 'profile_41_5', instanceIndex: 0 },
    { xCm: 5, yCm: 0, zCm: 0, rotationXDeg: 0, rotationYDeg: 0, rotationZDeg: 0 },
    { xCm: 0, yCm: 0, zCm: 0, rotationXDeg: 0, rotationYDeg: 0, rotationZDeg: 0 },
  );
  assert.equal(lock.host.childItemKey, 'profile_41_5');
  assert.equal(lock.follower.childItemKey, 'upright_99');
  assert.equal(lock.relative.xCm, 5);
  assert.equal(lock.members.length, 2);
});

test('poseDelta + applyPoseDelta moves both parts the same way', () => {
  const startDriver = {
    xCm: 10, yCm: 0, zCm: 0, rotationXDeg: 0, rotationYDeg: 0, rotationZDeg: 0,
  };
  const startOther = {
    xCm: 15, yCm: 0, zCm: 5, rotationXDeg: 0, rotationYDeg: 0, rotationZDeg: 90,
  };
  const endDriver = {
    xCm: 40, yCm: 20, zCm: 0, rotationXDeg: 0, rotationYDeg: 0, rotationZDeg: 45,
  };
  const delta = poseDelta(startDriver, endDriver);
  const endOther = applyPoseDelta(startOther, delta);
  assert.deepEqual(endOther, {
    xCm: 45, yCm: 20, zCm: 5, rotationXDeg: 0, rotationYDeg: 0, rotationZDeg: 135,
  });
});

test('addPartToLockGroup grows N-member lock', () => {
  let lock = createAssemblyLockGroup([
    { childItemKey: 'upright_99', instanceIndex: 0 },
    { childItemKey: 'profile_41_5', instanceIndex: 0 },
  ]);
  assert.equal(lock.members.length, 2);
  lock = addPartToLockGroup(lock, { childItemKey: 'upright_99', instanceIndex: 1 });
  assert.equal(lock.members.length, 3);
  assert.equal(lockContainsPart(lock, { childItemKey: 'upright_99', instanceIndex: 1 }), true);
  const same = addPartToLockGroup(lock, { childItemKey: 'profile_41_5', instanceIndex: 0 });
  assert.equal(same.members.length, 3);
});

test('removePartFromLockGroup drops member; under 2 clears lock', () => {
  let lock = createAssemblyLockGroup([
    { childItemKey: 'a', instanceIndex: 0 },
    { childItemKey: 'b', instanceIndex: 0 },
    { childItemKey: 'c', instanceIndex: 0 },
  ]);
  lock = removePartFromLockGroup(lock, { childItemKey: 'b', instanceIndex: 0 });
  assert.equal(lock.members.length, 2);
  assert.equal(lockContainsPart(lock, { childItemKey: 'b', instanceIndex: 0 }), false);
  assert.equal(
    removePartFromLockGroup(lock, { childItemKey: 'a', instanceIndex: 0 }),
    null,
  );
});

test('lockGroupFromParts rebuilds group from lockGroupId', () => {
  const lock = lockGroupFromParts([
    { childItemKey: 'a', instanceIndex: 0, lockGroupId: 1 },
    { childItemKey: 'solo', instanceIndex: 0, lockGroupId: null },
    { childItemKey: 'b', instanceIndex: 0, lockGroupId: 1 },
  ]);
  assert.equal(lock.members.length, 2);
  assert.equal(lockContainsPart(lock, { childItemKey: 'a', instanceIndex: 0 }), true);
  assert.equal(lockContainsPart(lock, { childItemKey: 'b', instanceIndex: 0 }), true);
  assert.equal(lockGroupFromParts([{ childItemKey: 'x', instanceIndex: 0, lockGroupId: 1 }]), null);
});

