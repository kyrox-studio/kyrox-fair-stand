import test from 'node:test';
import assert from 'node:assert/strict';
import { snapPlacementToStand } from '../src/modulePlacement.js';

// 100 × 40 cm serbest öğe (ayaklı vitrin), 500 × 500 ada stand.
function place(pointerXCm, pointerYCm) {
  return snapPlacementToStand({
    standType: 'island',
    moduleType: 'floor-showcase',
    widthCm: 100,
    depthCm: 40,
    forceFree: true,
    pointerXCm,
    pointerYCm,
    standXCm: 500,
    standYCm: 500,
  }).placement;
}

test('kenara bir adımdan (10 cm) uzak öğe bırakıldığı yerde kalır; köşeye çekilmez', () => {
  // Sol kenar 40 cm, arka kenar 40 cm uzakta: köşeye yapışmaz.
  const placement = place(90, 60);
  assert.equal(placement.xCm, 40);
  assert.equal(placement.yCm, 60);
});

test('kenara bir adım içindeki öğe kenara yaslanır', () => {
  const placement = place(57, 27);
  assert.equal(placement.xCm, 0);
  assert.equal(placement.yCm, 20);
  const farEdge = place(445, 475);
  assert.equal(farEdge.xCm, 400);
  assert.equal(farEdge.yCm, 480);
});
