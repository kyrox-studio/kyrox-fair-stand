import test from 'node:test';
import assert from 'node:assert/strict';

import { getModuleDefaultRotationDeg, getModuleRotationStepDeg } from '../src/moduleBehavior.js';

for (const widthCm of [100, 150, 200]) {
  test(`corner counter ${widthCm} defaults to the same orientation`, () => {
    const module = { itemKey: `desk_banko_${widthCm}_l`, type: 'counter', shape: 'L', widthCm };
    assert.equal(getModuleDefaultRotationDeg(module), 270);
    assert.equal(getModuleRotationStepDeg(module), 15);
  });
}

test('straight counter default orientation is unchanged', () => {
  const module = { itemKey: 'desk_banko_150', type: 'counter', widthCm: 150 };
  assert.equal(getModuleDefaultRotationDeg(module), 0);
  assert.equal(getModuleRotationStepDeg(module), 15);
});
