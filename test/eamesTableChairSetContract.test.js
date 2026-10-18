import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  getCatalogItem,
  listCatalogItems,
} from '../src/catalog.js';
import { createEamesTableChairSetModuleState } from '../src/designState.js';

test('Eames is the only table-chair set in the catalog', () => {
  const eames = getCatalogItem('furniture_table_chair_set_eames');
  assert.equal(getCatalogItem('furniture_table_chair_set_minyon'), null);
  assert.equal(getCatalogItem('furniture_table_chair_set_minyon') != null, false);
  assert.equal(eames.itemKey, 'furniture_table_chair_set_eames');
  assert.equal(eames.previewId, 25);
});

test('Eames set contains four chairs', () => {
  const eames = createEamesTableChairSetModuleState();
  assert.equal(eames.type, 'table-chair-set-eames');
  assert.equal(eames.chairCount, 4);
  assert.equal(eames.widthCm, 150);
  assert.equal(eames.depthCm, 150);
});

test('Eames renderer loads the original GLB once and clones four chairs', () => {
  const source = fs.readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  assert.match(source, /GLTFLoader/);
  assert.match(source, /MeshoptDecoder/);
  assert.match(source, /setMeshoptDecoder/);
  assert.match(source, /loadItemModel\('chair_eames'\)/);
  assert.match(source, /template\.clone\(true\)/);
  assert.match(source, /chairPlacements\.forEach/);
});

test('original Eames GLB asset is present', async () => {
  const glbUrl = new URL('../public/models/eames_chair.glb', import.meta.url);
  const glbPath = fileURLToPath(glbUrl);
  const payload = fs.statSync(glbPath);
  // Meshopt-only sonrası ~100 KB (eski sıkıştırılmamış ~479 KB).
  assert.ok(payload.size > 50000);
  assert.ok(payload.size < 400000);

  const { NodeIO } = await import('@gltf-transform/core');
  const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
  const { MeshoptDecoder } = await import('meshoptimizer');
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.read(glbPath);
  const materials = new Set(doc.getRoot().listMaterials().map((m) => m.getName() || ''));
  assert.ok(materials.has('plastic_wit'), 'plastic_wit seat material must remain');
  assert.ok(materials.has('Material1'), 'Material1 leg material must remain');
  assert.ok(materials.has('skp_front_default'), 'skp_front_default must remain (optimize palette silmesin)');
});
