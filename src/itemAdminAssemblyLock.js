/**
 * Admin montaj kilit — N parçalık grup.
 * Absolute pose + lock_group_id DB’ye yazılır; yeniden açılışta geri yüklenir.
 */

export function assemblyPartKey(childItemKey, instanceIndex) {
  return `${String(childItemKey || '')}#${Number(instanceIndex) || 0}`;
}

export function partRefFromPart(part) {
  if (!part?.childItemKey) return null;
  return {
    childItemKey: String(part.childItemKey),
    instanceIndex: Number(part.instanceIndex) || 0,
  };
}

/** Follower’ın host’a göre ofseti (cm + Euler °). */
export function captureRelativePose(followerPose, hostPose) {
  return {
    xCm: Number(followerPose.xCm) - Number(hostPose.xCm),
    yCm: Number(followerPose.yCm) - Number(hostPose.yCm),
    zCm: Number(followerPose.zCm) - Number(hostPose.zCm),
    rotationXDeg: Number(followerPose.rotationXDeg) - Number(hostPose.rotationXDeg),
    rotationYDeg: Number(followerPose.rotationYDeg) - Number(hostPose.rotationYDeg),
    rotationZDeg: Number(followerPose.rotationZDeg) - Number(hostPose.rotationZDeg),
  };
}

/** Host pose + relative → follower absolute pose. */

/** Sürüklenen parçanın delta’sı (grup hareketi). */
export function poseDelta(fromPose, toPose) {
  return {
    xCm: Number(toPose.xCm) - Number(fromPose.xCm),
    yCm: Number(toPose.yCm) - Number(fromPose.yCm),
    zCm: Number(toPose.zCm) - Number(fromPose.zCm),
    rotationXDeg: Number(toPose.rotationXDeg) - Number(fromPose.rotationXDeg),
    rotationYDeg: Number(toPose.rotationYDeg) - Number(fromPose.rotationYDeg),
    rotationZDeg: Number(toPose.rotationZDeg) - Number(fromPose.rotationZDeg),
  };
}

export function applyPoseDelta(pose, delta) {
  return {
    xCm: Number(pose.xCm) + Number(delta.xCm),
    yCm: Number(pose.yCm) + Number(delta.yCm),
    zCm: Number(pose.zCm) + Number(delta.zCm),
    rotationXDeg: Number(pose.rotationXDeg) + Number(delta.rotationXDeg),
    rotationYDeg: Number(pose.rotationYDeg) + Number(delta.rotationYDeg),
    rotationZDeg: Number(pose.rotationZDeg) + Number(delta.rotationZDeg),
  };
}

export function lockContainsPart(lock, part) {
  const ref = partRefFromPart(part);
  if (!lock?.members?.length || !ref) return false;
  const key = assemblyPartKey(ref.childItemKey, ref.instanceIndex);
  return lock.members.some(
    (m) => assemblyPartKey(m.childItemKey, m.instanceIndex) === key,
  );
}

/**
 * @param {Array<{ childItemKey: string, instanceIndex?: number }>} parts
 * @returns {{ members: Array<{ childItemKey: string, instanceIndex: number }> } | null}
 */
export function createAssemblyLockGroup(parts) {
  const members = [];
  const seen = new Set();
  for (const part of parts || []) {
    const ref = partRefFromPart(part);
    if (!ref) continue;
    const key = assemblyPartKey(ref.childItemKey, ref.instanceIndex);
    if (seen.has(key)) continue;
    seen.add(key);
    members.push(ref);
  }
  if (members.length < 2) return null;
  return { members };
}

/** Mevcut gruba yeni parça ekle (zaten varsa aynı lock). */
export function addPartToLockGroup(lock, part) {
  if (!lock?.members?.length) {
    return createAssemblyLockGroup([part]);
  }
  const ref = partRefFromPart(part);
  if (!ref) return lock;
  if (lockContainsPart(lock, ref)) return lock;
  return { members: [...lock.members, ref] };
}

/**
 * Parçayı gruptan çıkar. 2’den az kalırsa kilit sipariş edilir (null).
 * @returns {{ members: Array<{ childItemKey: string, instanceIndex: number }> } | null}
 */
export function removePartFromLockGroup(lock, part) {
  if (!lock?.members?.length) return null;
  const ref = partRefFromPart(part);
  if (!ref) return lock;
  const key = assemblyPartKey(ref.childItemKey, ref.instanceIndex);
  const members = lock.members.filter(
    (m) => assemblyPartKey(m.childItemKey, m.instanceIndex) !== key,
  );
  if (members.length < 2) return null;
  return { members };
}

/**
 * İkili kilit (geriye uyum). members + host/follower/relative.
 * @returns {object | null}
 */
export function createAssemblyLock(followerPart, hostPart, followerPose, hostPose) {
  const group = createAssemblyLockGroup([hostPart, followerPart]);
  if (!group) return null;
  return {
    ...group,
    host: { ...group.members[0] },
    follower: { ...group.members[1] },
    relative: captureRelativePose(followerPose, hostPose),
  };
}

/** Parça listesinden kalıcı lock_group_id → kilit grubu (ilk >=2 üyeli grup). */
export function lockGroupFromParts(parts) {
  const byGroup = new Map();
  for (const part of parts || []) {
    const gid = Number(part?.lockGroupId ?? part?.lock_group_id);
    if (!Number.isInteger(gid) || gid < 1) continue;
    const ref = partRefFromPart(part);
    if (!ref) continue;
    const bucket = byGroup.get(gid) || [];
    const key = assemblyPartKey(ref.childItemKey, ref.instanceIndex);
    if (bucket.some((m) => assemblyPartKey(m.childItemKey, m.instanceIndex) === key)) continue;
    bucket.push(ref);
    byGroup.set(gid, bucket);
  }
  const ordered = [...byGroup.entries()].sort((a, b) => a[0] - b[0]);
  for (const [, members] of ordered) {
    const group = createAssemblyLockGroup(members);
    if (group) return group;
  }
  return null;
}

/** Kilit üyelerine lockGroupId bas; diğerlerinde null. Tek aktif grup = 1. */
