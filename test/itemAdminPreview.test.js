import test from 'node:test';
import assert from 'node:assert/strict';

import { envelopeFromForm } from '../src/itemAdminPreview.js';
import { readFileSync } from 'node:fs';

test('envelopeFromForm uses dimensions only (ignores scene override args if passed)', () => {
  const envelope = envelopeFromForm({
    widthCm: 100,
    depthCm: 10,
    heightCm: 50,
    sceneWidthCm: 200,
    sceneDepthCm: 8,
    sceneHeightCm: 350,
    defaultColor: 0xff0000,
  });
  assert.deepEqual(envelope, {
    widthCm: 100,
    depthCm: 10,
    heightCm: 50,
    colorCss: '#ff0000',
  });
});

test('envelopeFromForm returns null when dimensions incomplete', () => {
  assert.equal(
    envelopeFromForm({ widthCm: 100, depthCm: '', heightCm: 50, defaultColor: 1 }),
    null,
  );
});


test('admin assembly preview does not draw parent wire ghost envelope', () => {
  const source = readFileSync(new URL('../src/itemAdminPreview.js', import.meta.url), 'utf8');
  const start = source.indexOf("if (state.mode === 'assembly' && state.parts.length)");
  const end = source.indexOf('} else if (state.envelope)');
  assert.ok(start >= 0 && end > start, 'assembly branch markers missing');
  const assemblyBranch = source.slice(start, end);
  assert.doesNotMatch(assemblyBranch, /wire:\s*true/);
  assert.doesNotMatch(assemblyBranch, /makeBoxMesh\(\s*\{\s*\.\.\.state\.envelope/);
  assert.match(assemblyBranch, /for \(const part of state\.parts\)/);
});
