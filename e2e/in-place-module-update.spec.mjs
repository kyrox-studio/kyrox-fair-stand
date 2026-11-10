import { test, expect } from '@playwright/test';
import { clickProjectAction, createStageFromWizard } from './helpers/standSetup.mjs';
import { openPanelTab } from './helpers/surfaceControls.mjs';

// Ölçü ve arka yüz paneli değişimi yalnız o modülü yeniden yaratır: sahnedeki diğer modüllerin
// nesneleri aynı kalır (tam kurulum yok), görselli yüzey dokusunu yeniden yüklemez ve seçim korunur.

async function exposeScene(page) {
  await page.route('**/src/scene3d.js*', async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace(
        'const controls = new OrbitControls(camera, renderer.domElement);',
        'const controls = new OrbitControls(camera, renderer.domElement); window.__sceneCamera = camera;',
      )
      .replace(
        '  let surfaceMeshes = [];',
        '  let surfaceMeshes = []; window.__sceneSurfaces = () => surfaceMeshes;',
      )
      .replace(
        '  function buildWall(modules, { resetView = true } = {}) {',
        '  function buildWall(modules, { resetView = true } = {}) { window.__buildWallCount = (window.__buildWallCount ?? 0) + 1;',
      );
    await route.fulfill({ response, body });
  });
}

async function openProjectWith(page, buildModules) {
  await exposeScene(page);
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('6');
  await page.locator('#stand-size-y').fill('6');
  // Proje yalnız sihirbazdan kurulur (Sahneyi Oluştur kaldırıldı).
  await createStageFromWizard(page);
  await page.locator('form input[name="projectName"]').fill('E2E Yerinde Güncelleme');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  await page.locator('#save-project').click();
  await expect(page.locator('#save-project')).toBeEnabled();

  const projectId = await page.evaluate(async (source) => {
    const designState = await import('/src/designState.js');
    const placement = await import('/src/modulePlacement.js');
    // eslint-disable-next-line no-new-func
    const modules = new Function('designState', 'placement', `return (${source})(designState, placement);`)(designState, placement);
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('fair-stand-configurator', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const projects = await new Promise((resolve) => {
      const request = db.transaction('projects', 'readonly').objectStore('projects').getAll();
      request.onsuccess = () => resolve(request.result ?? []);
    });
    const project = projects.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0];
    project.modules = modules;
    project.updatedAt = Date.now();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      tx.objectStore('projects').put(project);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return project.id;
  }, buildModules.toString());
  await page.reload();
  await page.locator('#project-select').evaluate((select, id) => { select.value = id; }, projectId);
  await clickProjectAction(page, 'open-project');
  await expect(page.locator('#project-status')).toContainText('Açıldı:');
}

function surfacePoint(page, predicateSource) {
  return page.evaluate((source) => {
    // eslint-disable-next-line no-new-func
    const predicate = new Function('mesh', `return (${source})(mesh);`);
    const mesh = window.__sceneSurfaces().find((candidate) => predicate(candidate));
    const canvas = document.querySelector('#viewport > canvas').getBoundingClientRect();
    mesh.updateMatrixWorld(true);
    const screen = mesh.getWorldPosition(mesh.position.clone()).project(window.__sceneCamera);
    return {
      x: canvas.left + ((screen.x + 1) / 2) * canvas.width,
      y: canvas.top + ((1 - screen.y) / 2) * canvas.height,
    };
  }, predicateSource.toString());
}

// Diğer modülün yüzeyleri işaretlenir; işaret nesneyle yaşar, yeniden yaratılan nesnede olmaz.
function markSurfaces(page, moduleId) {
  return page.evaluate((id) => {
    const surfaces = window.__sceneSurfaces().filter((mesh) => mesh.userData.moduleId === id);
    surfaces.forEach((mesh) => { mesh.userData.__keepMarker = true; });
    return surfaces.length;
  }, moduleId);
}

function countMarked(page, moduleId) {
  return page.evaluate((id) => window.__sceneSurfaces()
    .filter((mesh) => mesh.userData.moduleId === id && mesh.userData.__keepMarker === true).length, moduleId);
}

test('arka yüz paneli eklemek yalnız o duvarı yeniden yaratır; diğer duvar ve seçim yerinde kalır', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openProjectWith(page, (designState, placement) => {
    const first = designState.createModuleStateFromCatalogKey('wall_100_350');
    first.placement = placement.createModulePlacement({ xCm: 150, yCm: 300, zCm: 0, rotationZDeg: 0, wallId: 'free' });
    const second = designState.createModuleStateFromCatalogKey('wall_100_350');
    second.placement = placement.createModulePlacement({ xCm: 400, yCm: 300, zCm: 0, rotationZDeg: 0, wallId: 'free' });
    return [first, second];
  });
  const [firstId, secondId] = await page.evaluate(() => {
    const ids = [...new Set(window.__sceneSurfaces().map((mesh) => mesh.userData.moduleId).filter(Boolean))];
    return ids;
  });
  const markedCount = await markSurfaces(page, secondId);
  expect(markedCount).toBeGreaterThan(0);

  const point = await surfacePoint(page, `(mesh) => mesh.userData.moduleId === ${JSON.stringify(firstId)} && (mesh.userData.panelSide ?? 'front') === 'front' && mesh.userData.stripIndex === 3`);
  await page.mouse.click(point.x, point.y, { button: 'right' });
  await openPanelTab(page, 'more');
  const buildsBefore = await page.evaluate(() => window.__buildWallCount ?? 0);
  await page.locator('[data-module-action="toggle-back-panels"]').click();

  await expect.poll(() => page.evaluate((id) => window.__sceneSurfaces()
    .filter((mesh) => mesh.userData.moduleId === id && mesh.userData.panelSide === 'back').length, firstId)).toBe(7);
  expect(await page.evaluate(() => window.__buildWallCount ?? 0)).toBe(buildsBefore);
  expect(await countMarked(page, secondId)).toBe(markedCount);
  // Tıklanan ön panel yeni nesnede de seçili kalır; Özellikler paneli açık durur.
  await expect(page.locator('.selection-property-panel')).toBeVisible();
  await expect(page.locator('[data-module-action="toggle-back-panels"]')).toHaveText('Arka yüz panellerini kaldır');
  expect(errors).toEqual([]);
});

test('kutu blok ölçüsü canlı değişince yalnız kutu blok yeniden yaratılır', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openProjectWith(page, (designState, placement) => {
    const wall = designState.createModuleStateFromCatalogKey('wall_100_350');
    wall.placement = placement.createModulePlacement({ xCm: 150, yCm: 300, zCm: 0, rotationZDeg: 0, wallId: 'free' });
    const box = designState.createModuleStateFromCatalogKey('box_block');
    box.placement = placement.createModulePlacement({ xCm: 400, yCm: 300, zCm: 0, rotationZDeg: 0, wallId: 'free' });
    return [wall, box];
  });
  const ids = await page.evaluate(() => {
    const surfaces = window.__sceneSurfaces();
    return {
      wall: surfaces.find((mesh) => mesh.userData.moduleType !== 'box-block' && mesh.userData.moduleId)?.userData.moduleId,
      box: surfaces.find((mesh) => mesh.userData.moduleType === 'box-block')?.userData.moduleId,
    };
  });
  expect(ids.wall).toBeTruthy();
  expect(ids.box).toBeTruthy();
  const markedCount = await markSurfaces(page, ids.wall);

  const point = await surfacePoint(page, `(mesh) => mesh.userData.moduleType === 'box-block' && mesh.userData.faceSlot === 'front'`);
  await page.mouse.click(point.x, point.y, { button: 'right' });
  await openPanelTab(page, 'size');
  const width = page.locator('.selection-property-panel [data-field="widthCm"]');
  await expect(width).toBeVisible();
  const buildsBefore = await page.evaluate(() => window.__buildWallCount ?? 0);
  await width.fill('180');
  await width.press('Enter');

  await expect.poll(() => page.evaluate((id) => {
    const box = window.__sceneSurfaces().find((mesh) => mesh.userData.moduleId === id);
    let group = box;
    while (group && !group.userData?.moduleState) group = group.parent;
    return group?.userData.moduleState.widthCm;
  }, ids.box)).toBe(180);
  expect(await page.evaluate(() => window.__buildWallCount ?? 0)).toBe(buildsBefore);
  expect(await countMarked(page, ids.wall)).toBe(markedCount);
  await expect(page.locator('.selection-property-panel')).toBeVisible();

  // Geri al eski ölçüyü getirir.
  await page.keyboard.press('Escape');
  await page.locator('#design-undo').click();
  await expect.poll(() => page.evaluate((id) => {
    const box = window.__sceneSurfaces().find((mesh) => mesh.userData.moduleId === id);
    let group = box;
    while (group && !group.userData?.moduleState) group = group.parent;
    return group?.userData.moduleState.widthCm;
  }, ids.box)).not.toBe(180);
  expect(errors).toEqual([]);
});

test('Lightbox kaplamalı duvarı silmek sahneyi baştan kurmaz; tek parça kaplama çözülür', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openProjectWith(page, (designState, placement) => {
    const first = designState.createModuleStateFromCatalogKey('wall_100_350');
    first.placement = placement.createModulePlacement({ xCm: 150, yCm: 300, zCm: 0, rotationZDeg: 0, wallId: 'free' });
    const second = designState.createModuleStateFromCatalogKey('wall_100_350');
    second.placement = placement.createModulePlacement({ xCm: 250, yCm: 300, zCm: 0, rotationZDeg: 0, wallId: 'free' });
    const third = designState.createModuleStateFromCatalogKey('wall_100_350');
    third.placement = placement.createModulePlacement({ xCm: 450, yCm: 300, zCm: 0, rotationZDeg: 0, wallId: 'free' });
    return [first, second, third];
  });
  const ids = await page.evaluate(() => {
    const surfaces = window.__sceneSurfaces().filter((mesh) => mesh.userData.moduleId);
    const byModule = new Map();
    surfaces.forEach((mesh) => {
      mesh.updateMatrixWorld(true);
      const x = mesh.getWorldPosition(mesh.position.clone()).x;
      if (!byModule.has(mesh.userData.moduleId)) byModule.set(mesh.userData.moduleId, x);
    });
    return [...byModule.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);
  });
  expect(ids).toHaveLength(3);
  const [firstId, secondId, thirdId] = ids;
  const frontPanel = (id) => `(mesh) => mesh.userData.moduleId === ${JSON.stringify(id)} && (mesh.userData.panelSide ?? 'front') === 'front' && mesh.userData.stripIndex === 3`;

  // İki duvarın ön panelleri tek Lightbox kaplaması olur.
  const a = await surfacePoint(page, frontPanel(firstId));
  await page.mouse.click(a.x, a.y);
  const b = await surfacePoint(page, frontPanel(secondId));
  await page.keyboard.down('Control');
  await page.mouse.click(b.x, b.y);
  await page.keyboard.up('Control');
  await openPanelTab(page, 'more');
  await page.locator('.selection-property-panel [data-module-action="toggle-fabric"]').click();
  const fabricOn = (id) => page.evaluate((moduleId) => window.__sceneSurfaces()
    .filter((mesh) => mesh.userData.moduleId === moduleId && mesh.userData.surfaceState?.fabricGroupId).length, id);
  await expect.poll(() => fabricOn(firstId)).toBeGreaterThan(0);
  await expect.poll(() => fabricOn(secondId)).toBeGreaterThan(0);

  const markedCount = await markSurfaces(page, thirdId);
  const buildsBefore = await page.evaluate(() => window.__buildWallCount ?? 0);
  await page.keyboard.press('Escape');
  const again = await surfacePoint(page, frontPanel(firstId));
  await page.mouse.click(again.x, again.y, { button: 'right' });
  await page.locator('.selection-property-panel [data-module-action="delete"]').click();

  await expect.poll(() => page.evaluate((id) => window.__sceneSurfaces()
    .filter((mesh) => mesh.userData.moduleId === id).length, firstId)).toBe(0);
  expect(await page.evaluate(() => window.__buildWallCount ?? 0)).toBe(buildsBefore);
  expect(await countMarked(page, thirdId)).toBe(markedCount);
  // Tek parça kumaşın bir sahibi silinince kaplama fiziksel olarak kalmaz; diğer duvardan da çözülür
  // (scene3d normalizeFabricOwnership, tam kurulumdaki kuralla aynı).
  expect(await fabricOn(secondId)).toBe(0);
  expect(errors).toEqual([]);
});

test('çoklu seçim, renk, cam ve sürükleme sahneyi baştan kurmaz', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openProjectWith(page, (designState, placement) => {
    const walls = [150, 250, 350].map((xCm) => {
      const wall = designState.createModuleStateFromCatalogKey('wall_100_350');
      wall.placement = placement.createModulePlacement({ xCm, yCm: 150, zCm: 0, rotationZDeg: 0, wallId: 'free' });
      return wall;
    });
    const box = designState.createModuleStateFromCatalogKey('box_block');
    box.placement = placement.createModulePlacement({ xCm: 300, yCm: 400, zCm: 0, rotationZDeg: 0, wallId: 'free' });
    return [...walls, box];
  });
  const wallIds = await page.evaluate(() => {
    const byModule = new Map();
    window.__sceneSurfaces().forEach((mesh) => {
      if (!mesh.userData.moduleId || mesh.userData.moduleType === 'box-block') return;
      mesh.updateMatrixWorld(true);
      if (!byModule.has(mesh.userData.moduleId)) byModule.set(mesh.userData.moduleId, mesh.getWorldPosition(mesh.position.clone()).x);
    });
    return [...byModule.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);
  });
  expect(wallIds).toHaveLength(3);
  const allSurfaceCount = await page.evaluate(() => {
    window.__sceneSurfaces().forEach((mesh) => { mesh.userData.__keepMarker = true; });
    return window.__sceneSurfaces().length;
  });
  const marked = () => page.evaluate(() => window.__sceneSurfaces().filter((mesh) => mesh.userData.__keepMarker === true).length);
  const builds = () => page.evaluate(() => window.__buildWallCount ?? 0);
  const buildsBefore = await builds();
  const frontPanel = (id, stripIndex) => `(mesh) => mesh.userData.moduleId === ${JSON.stringify(id)} && (mesh.userData.panelSide ?? 'front') === 'front' && mesh.userData.stripIndex === ${stripIndex}`;

  // Üç duvardan altı panel seçilir (Ctrl + tık).
  let first = true;
  for (const id of wallIds) {
    for (const stripIndex of [2, 3]) {
      const point = await surfacePoint(page, frontPanel(id, stripIndex));
      if (!first) await page.keyboard.down('Control');
      await page.mouse.click(point.x, point.y);
      if (!first) await page.keyboard.up('Control');
      first = false;
    }
  }
  await expect(page.locator('.selection-property-panel')).toBeVisible();

  // Renk ve cam yalnız seçili yüzeyleri değiştirir.
  await openPanelTab(page, 'look');
  await page.locator('.selection-property-panel #color-hex').fill('#3366AA');
  await page.locator('.selection-property-panel #color-hex').press('Enter');
  await page.locator('.selection-property-panel #apply-color').click();
  // Açılan Özellikler paneli sağdaki duvarı örtebilir; seçilebilen panel sayısı (en az 4) kadar boyanır.
  const colored = () => page.evaluate(() => window.__sceneSurfaces()
    .filter((mesh) => String(mesh.userData.surfaceState?.color ?? '').toLowerCase() === '#3366aa').length);
  await expect.poll(colored).toBeGreaterThanOrEqual(4);
  const coloredCount = await colored();
  await openPanelTab(page, 'more');
  await page.locator('.selection-property-panel [data-module-action="toggle-glass"]').click();
  await expect.poll(() => page.evaluate(() => window.__sceneSurfaces()
    .filter((mesh) => mesh.userData.surfaceState?.isGlass).length)).toBe(coloredCount);

  // Kutu blok sahnede sürüklenir; yeri değişir, sahne baştan kurulmaz.
  await page.keyboard.press('Escape');
  const boxBefore = await page.evaluate(() => {
    const mesh = window.__sceneSurfaces().find((candidate) => candidate.userData.moduleType === 'box-block');
    let group = mesh;
    while (group && !group.userData?.moduleState) group = group.parent;
    return { ...group.userData.moduleState.placement };
  });
  const start = await surfacePoint(page, `(mesh) => mesh.userData.moduleType === 'box-block' && mesh.userData.faceSlot === 'top'`);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 120, start.y, { steps: 16 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => {
    const mesh = window.__sceneSurfaces().find((candidate) => candidate.userData.moduleType === 'box-block');
    let group = mesh;
    while (group && !group.userData?.moduleState) group = group.parent;
    return group.userData.moduleState.placement.xCm;
  })).not.toBe(boxBefore.xCm);

  expect(await builds()).toBe(buildsBefore);
  expect(await marked()).toBe(allSurfaceCount);
  expect(errors).toEqual([]);
});
