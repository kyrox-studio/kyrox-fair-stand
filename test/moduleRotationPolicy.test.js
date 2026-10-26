import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getModuleRotationStepDeg,
  resolveModuleRotationDeltaDeg,
} from '../src/moduleBehavior.js';

test('clockwise and counter-clockwise deltas always use the Item rotation step', () => {
  const cases = [
    [{ itemKey: 'wall_200_350' }, 15],
    [{ itemKey: 'desk_banko_100_l' }, 15],
    [{ itemKey: 'desk_banko_100' }, 15],
    [{ itemKey: 'desk_banko_150' }, 15],
    [{ itemKey: 'desk_banko_200' }, 15],
    [{ itemKey: 'furniture_bar_stool_classic' }, 15],
    [{ itemKey: 'furniture_sofa_single_classic' }, 15],
    [{ itemKey: 'furniture_sofa_double_classic' }, 15],
    [{ itemKey: 'mini_fridge_avanti' }, 15],
    [{ itemKey: 'kettle' }, 15],
    [{ itemKey: 'coat_rack' }, 15],
    [{ itemKey: 'extra_indoor_plant_1' }, 15],
    [{ itemKey: 'illuminated-foam' }, 15],
    [{ itemKey: 'tv_42' }, 15],
    [{ itemKey: 'led_floodlight' }, 15],
  ];

  for (const [moduleState, expectedStep] of cases) {
    assert.equal(getModuleRotationStepDeg(moduleState), expectedStep);
    assert.equal(resolveModuleRotationDeltaDeg(moduleState, -90), -expectedStep);
    assert.equal(resolveModuleRotationDeltaDeg(moduleState, 90), expectedStep);
  }
});

test('zero requested rotation remains zero', () => {
  assert.equal(resolveModuleRotationDeltaDeg({ itemKey: 'furniture_bar_stool_classic' }, 0), 0);
});
