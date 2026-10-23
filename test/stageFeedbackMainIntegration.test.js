import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('main delegates stage feedback helpers', () => {
  assert.match(source, /import \{ renderStageResult as renderStageResultInto, renderWallResult \} from '\.\/stageFeedback\.js'/);
  assert.match(source, /function renderStageResult\(message, isError = false\) \{\s*renderStageResultInto\(stageResult, message, isError\);\s*\}/);
  assert.doesNotMatch(source, /function formatCapacityPopup\(/);
  assert.doesNotMatch(source, /if \(isError\) console\.warn\(message\)/);
});
