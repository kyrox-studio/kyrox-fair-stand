import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PROFILE_SLOT_DEPTH_M, PROFILE_SLOT_WIDTH_M, createSlottedProfileGeometry } from '../src/profileGeometry.js';

function boxSize(geometry) {
  geometry.computeBoundingBox();
  const size = new THREE.Vector3();
  geometry.boundingBox.getSize(size);
  const center = new THREE.Vector3();
  geometry.boundingBox.getCenter(center);
  return { size, center };
}

// Geometri konumları Float32 saklanır; karşılaştırma 1 mikron hassasiyetle.
const EPSILON = 1e-6;

function near(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) < EPSILON, `${label}: ${actual} != ${expected}`);
}

test('slotted profile keeps the BoxGeometry outer size and center on every axis', () => {
  for (const [x, y, z] of [[0.1, 3.5, 0.1], [0.9, 0.1, 0.1], [0.1, 0.1, 0.4]]) {
    const { size, center } = boxSize(createSlottedProfileGeometry(x, y, z));
    near(size.x, x, 'x'); near(size.y, y, 'y'); near(size.z, z, 'z');
    near(center.x, 0, 'cx'); near(center.y, 0, 'cy'); near(center.z, 0, 'cz');
  }
});

test('10 cm profile has a 2 cm wide, 1.5 cm deep channel in the middle of each long face', () => {
  assert.equal(PROFILE_SLOT_WIDTH_M, 0.02);
  assert.equal(PROFILE_SLOT_DEPTH_M, 0.015);
  // Dikme (boy Y): kesit X × Z. Kanal tabanı yüz düzleminden 1,5 cm içeride.
  const geometry = createSlottedProfileGeometry(0.1, 3.5, 0.1);
  const positions = geometry.getAttribute('position');
  const channelFloorX = new Set();
  const channelFloorZ = new Set();
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const z = positions.getZ(index);
    if (Math.abs(Math.abs(x) - 0.035) < EPSILON && Math.abs(z) <= 0.01 + EPSILON) channelFloorX.add(Math.sign(x));
    if (Math.abs(Math.abs(z) - 0.035) < EPSILON && Math.abs(x) <= 0.01 + EPSILON) channelFloorZ.add(Math.sign(z));
  }
  assert.deepEqual([...channelFloorX].sort(), [-1, 1]);
  assert.deepEqual([...channelFloorZ].sort(), [-1, 1]);
});

test('thin profiles clamp the channel to the section', () => {
  const { size } = boxSize(createSlottedProfileGeometry(0.03, 2, 0.03));
  near(size.x, 0.03, 'x');
  near(size.z, 0.03, 'z');
});
