import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_STAND_DIMENSION_CM,
  MIN_STAND_DIMENSION_CM,
  STAND_DIMENSION_STEP_CM,
  STAND_TYPES,
  validateStandSetup,
} from '../src/standSetup.js';

test('requires a stand type and both dimensions', () => {
  assert.equal(validateStandSetup({ xCm: 1000, yCm: 500 }).ok, false);
  assert.equal(validateStandSetup({ standType: 'back-wall', xCm: 1000 }).ok, false);
  assert.equal(validateStandSetup({ standType: 'back-wall', yCm: 500 }).ok, false);
});

test('supports left and right L stands as separate stand types', () => {
  assert.equal(STAND_TYPES.includes('l-left'), true);
  assert.equal(STAND_TYPES.includes('l-right'), true);
  assert.equal(STAND_TYPES.includes('l-stand'), false);

  assert.equal(validateStandSetup({ standType: 'l-left', xCm: 1000, yCm: 500 }).ok, true);
  assert.equal(validateStandSetup({ standType: 'l-right', xCm: 1000, yCm: 500 }).ok, true);
});

test('accepts stand dimensions only in 50 cm increments', () => {
  assert.equal(MIN_STAND_DIMENSION_CM, 200);
  assert.equal(STAND_DIMENSION_STEP_CM, 50);

  assert.equal(validateStandSetup({ standType: 'back-wall', xCm: 800, yCm: 450 }).ok, true);
  assert.equal(validateStandSetup({ standType: 'back-wall', xCm: 350, yCm: 500 }).ok, true);

  assert.equal(validateStandSetup({ standType: 'back-wall', xCm: 25, yCm: 75 }).ok, false);
  assert.equal(validateStandSetup({ standType: 'back-wall', xCm: 825, yCm: 450 }).ok, false);
  assert.equal(validateStandSetup({ standType: 'back-wall', xCm: 800, yCm: 475 }).ok, false);
});

test('converts centimetres to the active area and adds a 1 metre surround', () => {
  const result = validateStandSetup({
    standType: 'l-left',
    xCm: 1000,
    yCm: 500,
  });

  assert.equal(result.ok, true);
  assert.equal(result.widthM, 10);
  assert.equal(result.depthM, 5);
  assert.equal(result.sceneWidthM, 12);
  assert.equal(result.sceneDepthM, 7);
});

test('allows up to 50 metres on each axis and rejects anything larger', () => {
  assert.equal(
    validateStandSetup({
      standType: 'island',
      xCm: MAX_STAND_DIMENSION_CM,
      yCm: MAX_STAND_DIMENSION_CM,
    }).ok,
    true,
  );

  assert.equal(
    validateStandSetup({
      standType: 'island',
      xCm: MAX_STAND_DIMENSION_CM + STAND_DIMENSION_STEP_CM,
      yCm: 1000,
    }).ok,
    false,
  );
});
