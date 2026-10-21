import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { getCatalogItem, listCatalogGroups } from '../src/catalog.js';
import {
  createBrochureStandModuleState,
  createFloorShowcaseModuleState,
  createModuleStateFromDescriptor,
} from '../src/designState.js';
import { getItem } from '../src/items.js';
import { getModuleBehavior, getModuleMoveSnapCm } from '../src/moduleBehavior.js';
import { resolveModuleContract } from '../src/moduleContracts.js';
import { resolveItemBom } from '../src/itemBom.js';
import { createModulePlacement } from '../src/modulePlacement.js';
import { resolveProjectBom } from '../src/projectBom.js';

const scene = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');

const CASES = [
  {
    itemKey: 'floor_showcase_100',
    type: 'floor-showcase',
    label: 'Ayaklı Vitrin 100',
    group: 'Raf & Vitrin',
    previewId: 29,
    size: [100, 40, 100],
    factory: createFloorShowcaseModuleState,
    renderer: 'createFloorShowcaseModule',
  },
  {
    itemKey: 'brochure_stand',
    type: 'brochure-stand',
    label: 'Broşürlük',
    group: 'Extra',
    previewId: 30,
    size: [30, 30, 150],
    factory: createBrochureStandModuleState,
    renderer: 'createBrochureStandModule',
  },
];

for (const entry of CASES) {
  test(`${entry.itemKey}: katalog kartı, ölçü, state ve davranış Item kaydından gelir`, () => {
    assert.deepEqual(getCatalogItem(entry.itemKey), {
      itemKey: entry.itemKey,
      label: entry.label,
      previewId: entry.previewId,
    });
    assert.ok(listCatalogGroups().find((group) => group.label === entry.group)?.keys.includes(entry.itemKey));

    const item = getItem(entry.itemKey);
    assert.equal(item.type, entry.type);
    assert.equal(item.unit, 'adet');
    assert.deepEqual([item.dimensions.widthCm, item.dimensions.depthCm, item.dimensions.heightCm], entry.size);

    const state = entry.factory();
    assert.equal(state.itemKey, entry.itemKey);
    assert.equal(state.type, entry.type);
    assert.deepEqual([state.widthCm, state.depthCm, state.heightCm], entry.size);
    const fromCatalog = createModuleStateFromDescriptor(getCatalogItem(entry.itemKey), { itemKey: entry.itemKey });
    assert.equal(fromCatalog.itemKey, entry.itemKey);
    assert.equal(fromCatalog.type, entry.type);

    // Serbest yerleşim; taban alanıyla çakışır, 10 cm adımla taşınır, mıknatıslı yapışma yok.
    const behavior = getModuleBehavior(state);
    assert.equal(behavior.placement, 'free');
    assert.equal(behavior.collision, 'footprint');
    assert.equal(behavior.magneticSnap, 'none');
    assert.equal(getModuleMoveSnapCm(state), 10);
  });

  test(`${entry.itemKey}: üretim listesi tek kalem 1 adet; reçete yok`, () => {
    assert.equal(resolveModuleContract(entry.itemKey)?.bom?.mode, 'self');
    assert.deepEqual(resolveItemBom(entry.itemKey).map(({ itemKey, quantity, unit }) => ({ itemKey, quantity, unit })), [
      { itemKey: entry.itemKey, quantity: 1, unit: 'adet' },
    ]);
    const module = entry.factory();
    module.placement = createModulePlacement({ xCm: 200, yCm: 200, rotationZDeg: 0 });
    const bom = resolveProjectBom([module]);
    assert.equal(bom.lines.find((line) => line.itemKey === entry.itemKey)?.quantity, 1);
  });

  test(`${entry.itemKey}: sahne kendi prosedürel çizicisini kullanır`, () => {
    assert.match(scene, new RegExp(`moduleState\\.type === '${entry.type}'\\) \\{\\s*return ${entry.renderer}\\(moduleState, moduleIndex(, onSurfaceReady)?\\);`));
    assert.match(scene, new RegExp(`function ${entry.renderer}\\(moduleState, moduleIndex(, onSurfaceReady = null)?\\) \\{\\s*const \\{ group, proxy, widthM, depthM, heightM \\} = createFreeItemShell\\(moduleState, moduleIndex, '${entry.type}'\\);`));
  });
}

test('ayaklı vitrin: 100 cm toplamın 30 cm’i cam fanus, 70 cm’i gövde', () => {
  assert.match(scene, /const FLOOR_SHOWCASE_GLASS_HEIGHT_RATIO = 0\.3;/);
  assert.match(scene, /const glassHeightM = heightM \* FLOOR_SHOWCASE_GLASS_HEIGHT_RATIO;/);
  assert.match(scene, /const bodyHeightM = heightM - glassHeightM;/);
});

test('broşürlük: 5 cep', () => {
  assert.match(scene, /const BROCHURE_STAND_POCKET_COUNT = 5;/);
});

test('ayaklı vitrin: ön/sol/sağ yüz renk, görsel ve Lightbox alır; kopya yeni yüz kimliği alır', async () => {
  const { duplicateModuleState, normalizeModuleItemState, FLOOR_SHOWCASE_FACE_SLOTS } = await import('../src/designState.js');
  const { getItemSurfaceCapabilities } = await import('../src/itemCapabilities.js');
  assert.deepEqual([...FLOOR_SHOWCASE_FACE_SLOTS], ['front', 'left', 'right']);
  assert.deepEqual({ ...getItemSurfaceCapabilities('floor_showcase_100') }, {
    color: true, image: true, glass: false, lightbox: true, mesh: false,
  });
  assert.equal(getItemSurfaceCapabilities('brochure_stand').image, false);

  const state = createFloorShowcaseModuleState();
  assert.deepEqual(Object.keys(state.faces), ['front', 'left', 'right']);
  state.faces.front.imageAssetId = 'asset-1';
  const copy = duplicateModuleState(state);
  assert.equal(copy.faces.front.imageAssetId, 'asset-1');
  assert.notEqual(copy.faces.front.id, state.faces.front.id);

  // Yüzsüz kayıt açılınca yüzler tamamlanır.
  const saved = JSON.parse(JSON.stringify(state));
  delete saved.faces.left;
  const opened = normalizeModuleItemState(saved);
  assert.ok(opened.faces.left?.id);
  assert.equal(opened.faces.front.imageAssetId, 'asset-1');

  // Çizici yüzleri panel seçimiyle bağlar; seçim kutusu düzenlenmez.
  assert.match(scene, /selectionMode: 'panel',\s*\.\.\.surfaceCapabilityUserData\(moduleState\.itemKey\),/);
  assert.match(scene, /acceptsColor: false, acceptsImage: false, acceptsGlass: false, acceptsLightbox: false, acceptsMesh: false,/);
});
