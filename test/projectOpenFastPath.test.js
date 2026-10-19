import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const remote = readFileSync(new URL('../src/projectRemote.js', import.meta.url), 'utf8');
const scene = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');

test('3D models start as soon as project data arrives, before images download', () => {
  const load = remote.slice(remote.indexOf('export async function loadProject('), remote.indexOf('function notifyProjectData'));
  // Sunucu yolu: proje verisi → modeller başlar → görseller iner.
  assert.ok(load.indexOf("timeProjectOpenStep('project-fetch'") < load.indexOf('notifyProjectData(onProjectData, toLocalProject(detail))'));
  assert.ok(load.indexOf('notifyProjectData(onProjectData, toLocalProject(detail))') < load.indexOf('cacheProjectAndAssets(detail, { onAssetProgress })'));
  // Yerel yol da aynı geri çağrıyı alır.
  assert.match(load, /notifyProjectData\(onProjectData, project\);/);
  // Ön hazırlık hatası açılışı bozmaz.
  assert.match(remote, /console\.warn\('Proje verisi ön hazırlığı başarısız:', error\);/);

  const options = main.slice(main.indexOf('function projectOpenLoadOptions()'), main.indexOf('async function waitForSceneToFill()'));
  assert.match(options, /prefetchModuleModels\(project\?\.modules\);/);
  assert.match(main, /import \{ createStandScene, prefetchModuleModels \} from '\.\/scene3d\.js';/);
});

test('model prefetch uses the same scene model cache and loads each file once', () => {
  const prefetch = scene.slice(scene.indexOf('export function prefetchModuleModels'), scene.indexOf('function createTvScreenTexture'));
  assert.match(prefetch, /const files = new Set\(\);/);
  assert.match(prefetch, /moduleState\?\.modelFile\s*\|\| \(moduleState\?\.itemKey \? getItem\(moduleState\.itemKey\)\?\.modelFile : null\)/);
  // loadItemModel → loadGltfScene: aynı gltfSceneCache, sahne kurulumunda tekrar inmez; sayaç (trackSceneModel) da sayar.
  assert.match(prefetch, /loadItemModel\(\{ modelFile \}\)\.catch\(\(\) => \{\}\);/);
});

test('loading screen names each stage of the project open', () => {
  const open = main.slice(main.indexOf('async function openStoredProject'), main.indexOf('function restoreProjectSelectToActiveProject'));
  assert.match(open, /projectLoading\.show\('Proje yükleniyor…', 'Proje verisi alınıyor…'\);/);
  assert.match(open, /loadProject\(projectId, projectOpenLoadOptions\(\)\)/);
  assert.ok(open.indexOf("projectLoading.setDetail('Sahne kuruluyor…')") < open.indexOf('await restoreProject(project)'));
  assert.match(main, /projectLoading\.setDetail\(`Görseller indiriliyor… \$\{done\} \/ \$\{total\}`\)/);
  // Canlıya dönüş de aynı hızlı yolu kullanır.
  const live = main.slice(main.indexOf('async function returnToLiveProject'), main.indexOf('function resetToFirstOpenState'));
  assert.match(live, /loadProject\(activeProjectId, projectOpenLoadOptions\(\)\)/);
});
