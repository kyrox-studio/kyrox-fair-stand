import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Kullanıcı hatası 2026-11-13: köşede birleşik iki duvar sürükleyerek ayrılınca, ortak dikmeyi
// çizmeyen duvarın uç dikmesi (profil) kayıp kalıyordu; sürükleme yalnız konumu güncelliyordu.
// Her taşıma / döndürme / ok tuşu kaydından sonra köşe durumu yeniden hesaplanmalı.
const scene = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');

function body(signature) {
  const start = scene.indexOf(signature);
  assert.ok(start >= 0, `${signature} bulunamadı`);
  return scene.slice(start, scene.indexOf('\n  }\n', start) === -1 ? undefined : scene.indexOf('\n  }', start + signature.length));
}

test('every placement commit schedules a corner joint refresh', () => {
  assert.match(scene, /function scheduleCornerJointRefresh\(\)[\s\S]*refreshCornerJointGroups\(\)/);
  for (const signature of ['function rotateSelectedModule(', 'function commitGroupPlacements(', 'function finishPlacementDrag(']) {
    assert.match(body(signature), /scheduleCornerJointRefresh\(\)/, signature);
  }
  const keydownStart = scene.indexOf("hostWindow.addEventListener('keydown', (event) => {");
  const keydown = scene.slice(keydownStart, scene.indexOf('}, { signal });', keydownStart));
  const commits = keydown.match(/moduleState\.placement = \{ \.\.\.[A-Za-z]+ \};/g) ?? [];
  const refreshes = keydown.match(/scheduleCornerJointRefresh\(\)/g) ?? [];
  assert.ok(commits.length > 0);
  assert.equal(refreshes.length, commits.length, 'ok tuşu taşımalarının her biri köşe yenilemesi ister');
});
