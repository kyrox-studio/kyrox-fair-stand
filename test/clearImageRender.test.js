import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sceneSource = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

function functionBody(name) {
  const start = sceneSource.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, `${name} bulunamadı`);
  const end = sceneSource.indexOf('\n  }\n', start);
  return sceneSource.slice(start, end);
}

// Editör yalnız istek olunca çizer; görsel kaldırma başka tıklama beklemeden görünmeli.
test('clearImage editör çizimini ister', () => {
  assert.match(functionBody('clearImage'), /requestEditorRender\(\);/);
});

test('Lightbox/Mesh kaplama yenilemesi editör çizimini ister', () => {
  assert.match(functionBody('rebuildFabricOverlays'), /requestEditorRender\(\);/);
});
