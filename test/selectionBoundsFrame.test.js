import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSelectionBoundsFrame, fitSelectionBoundsFrame } from '../src/selectionBoundsFrame.js';

test('kesik seçim kutusu tüm sınırları sarar; güncelleme geometri biriktirmez ve tıklama yakalamaz', () => {
  const frame = createSelectionBoundsFrame(0xf97316);
  const geometry = frame.geometry;
  const distances = frame.geometry.getAttribute('lineDistance');
  const bounds = new THREE.Box3(new THREE.Vector3(-2, 0, -1), new THREE.Vector3(3, 4, 2));
  fitSelectionBoundsFrame(frame, bounds);
  assert.equal(frame.material.isLineDashedMaterial, true);
  assert.equal(frame.material.color.getHex(), 0xf97316);
  assert.ok(frame.geometry.getAttribute('lineDistance').count > 0);
  assert.deepEqual(frame.position.toArray(), [0.5, 2, 0.5]);
  frame.updateMatrixWorld(true);
  const actual = new THREE.Box3().setFromObject(frame);
  assert.ok(actual.containsBox(bounds));
  fitSelectionBoundsFrame(frame, bounds.clone().translate(new THREE.Vector3(2, 0, 1)));
  assert.equal(frame.geometry, geometry);
  assert.equal(frame.geometry.getAttribute('lineDistance'), distances);
  assert.deepEqual(frame.position.toArray(), [2.5, 2, 1.5]);
  const hits = [];
  frame.raycast(new THREE.Raycaster(), hits);
  assert.deepEqual(hits, []);
  fitSelectionBoundsFrame(frame, new THREE.Box3());
  assert.equal(frame.visible, false);
});
