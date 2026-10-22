import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const mainSource = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const indexSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('F-027 reset uses the current stand setup controls and the same scene builder as create', () => {
  assert.match(indexSource, /id="clear-wall"[^>]*>Sahneyi Sıfırla<\/button>/);
  assert.match(mainSource, /function readSceneSetupFromControls\(\)/);
  assert.match(mainSource, /function rebuildSceneFromSetup\(\{ setup, depotConfig, depotPlan, fasciaConfig, fasciaPlan \}\)/);

  const createStart = mainSource.indexOf("createStageButton.addEventListener('click'");
  const createEnd = mainSource.indexOf("floorTypeSelect.addEventListener", createStart);
  const createHandler = mainSource.slice(createStart, createEnd);
  assert.match(createHandler, /readSceneSetupFromControls\(\)/);
  assert.match(createHandler, /rebuildSceneFromSetup\(\{ setup, depotConfig, depotPlan, fasciaConfig, fasciaPlan \}\)/);

  const resetStart = mainSource.indexOf("clearWallButton.addEventListener('click'");
  const resetEnd = mainSource.indexOf("resetModuleFeaturesButton.addEventListener", resetStart);
  const resetHandler = mainSource.slice(resetStart, resetEnd);
  assert.match(resetHandler, /readSceneSetupFromControls\(\)/);
  assert.match(resetHandler, /rebuildSceneFromSetup\(sceneSetup\)/);
  assert.equal(resetHandler.includes('scene3d.clearWall('), false);
});
