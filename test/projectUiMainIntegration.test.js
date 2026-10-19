import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const mainSource = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');

test('main.js delegates generic project UI helpers to projectUi module', () => {
  assert.match(mainSource, /import \{ createProjectLoadingController, setButtonBusy, setSaveProjectEnabled \} from '\.\/projectUi\.js';/);
  assert.match(mainSource, /setSaveProjectEnabled\(saveProjectButton, sceneReady\)/);
  assert.match(mainSource, /setSaveProjectEnabled\(saveAsProjectButton, sceneReady\)/);
  assert.match(mainSource, /saveAsProjectButton\?\.addEventListener\('click', async \(\) => \{\s*if \(!currentStand\) return;/);
  assert.match(mainSource, /const sceneReady = Boolean\(currentStand\)/);
  assert.equal(mainSource.includes('function setSaveProjectEnabled('), false);
  assert.equal(mainSource.includes('function setButtonBusy('), false);
  assert.equal(mainSource.includes('function showProjectLoading('), false);
  assert.equal(mainSource.includes('function hideProjectLoading('), false);
  assert.match(mainSource, /const projectLoading = createProjectLoadingController\(\{/);
  // Proje açma, revizyon, canlıya dönüş, içe aktarma ve Render Al.
  assert.equal((mainSource.match(/projectLoading\.show\(/g) || []).length, 5);
  assert.equal((mainSource.match(/projectLoading\.hide\(\)/g) || []).length, 5);
});
