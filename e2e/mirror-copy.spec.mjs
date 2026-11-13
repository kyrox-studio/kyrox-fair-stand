import { test, expect } from '@playwright/test';
import { createStageFromWizard, clickProjectAction } from './helpers/standSetup.mjs';

// Aynalı kopya (kullanıcı kararı 2026-11-12, 3ds Max Mirror + Copy): yalnız Gelişmiş modda; gruptaki
// öğeye sağ tık → "Aynala · Sağa" grubun aynalı kopyasını hemen sağına ekler; orijinal yerinde kalır,
// Geri al kaldırır. Basit modda aynala satırı görünmez.

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
      );
    await route.fulfill({ response, body });
  });
}

function readLatestProject(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('fair-stand-configurator', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const projects = await new Promise((resolve) => {
      const request = db.transaction('projects', 'readonly').objectStore('projects').getAll();
      request.onsuccess = () => resolve(request.result ?? []);
    });
    db.close();
    return projects.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0] ?? null;
  });
}

async function saveAndReadProject(page) {
  await page.locator('#save-project').click();
  await expect(page.locator('#save-project')).toBeEnabled();
  return readLatestProject(page);
}

function moduleScreenPoint(page, moduleId) {
  return page.evaluate((id) => {
    const surface = window.__sceneSurfaces().find((mesh) => mesh.userData.moduleId === id);
    if (!surface) return null;
    const canvas = document.querySelector('#viewport > canvas').getBoundingClientRect();
    surface.updateMatrixWorld(true);
    const screen = surface.getWorldPosition(surface.position.clone()).project(window.__sceneCamera);
    return {
      x: canvas.left + ((screen.x + 1) / 2) * canvas.width,
      y: canvas.top + ((1 - screen.y) / 2) * canvas.height,
    };
  }, moduleId);
}

test('sağa aynala: grubun aynalı kopyası hemen sağına eklenir, yalnız Gelişmiş modda, Geri al kaldırır', async ({ page }) => {
  test.setTimeout(60_000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await exposeScene(page);
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('5');
  await page.locator('#stand-size-y').fill('5');
  await createStageFromWizard(page);
  await page.locator('form input[name="projectName"]').fill('E2E Aynalı Kopya');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  await page.locator('#save-project').click();
  await expect(page.locator('#save-project')).toBeEnabled();

  const projectId = await page.evaluate(async () => {
    const designState = await import('/src/designState.js');
    const placement = await import('/src/modulePlacement.js');
    // Baza x 100–300 ve sol ucunun üstünde dikme, aynı grupta.
    const group = { id: 'group-e2e-ayna', name: 'Ayna', locked: false };
    const base = designState.createModuleStateFromCatalogKey('base_200');
    base.placement = placement.createModulePlacement({ xCm: 100, yCm: 200, zCm: 0, rotationZDeg: 0, wallId: 'free' });
    base.group = { ...group };
    const upright = designState.createModuleStateFromCatalogKey('upright_346_5');
    upright.widthCm = 10;
    upright.depthCm = 10;
    upright.placement = placement.createModulePlacement({ xCm: 100, yCm: 245, zCm: 0, rotationZDeg: 0, wallId: 'free' });
    upright.group = { ...group };
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
    project.modules = [base, upright];
    project.updatedAt = Date.now();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      tx.objectStore('projects').put(project);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return project.id;
  });
  await page.reload();
  await page.locator('#project-select').evaluate((select, id) => { select.value = id; }, projectId);
  await clickProjectAction(page, 'open-project');
  await expect(page.locator('#project-status')).toContainText('Açıldı:');
  const baseId = (await readLatestProject(page)).modules[0].id;
  await expect.poll(() => moduleScreenPoint(page, baseId)).not.toBeNull();

  const point = await moduleScreenPoint(page, baseId);
  const mirrorRight = page.locator('[data-module-action="mirror"][data-mirror-direction="right"]');
  // Basit modda aynala satırı yok.
  await page.mouse.click(point.x, point.y, { button: 'right' });
  await expect(page.locator('[data-module-action="duplicate"]').first()).toBeVisible();
  await expect(mirrorRight).toBeHidden();
  await page.locator('#editor-mode-advanced').click();
  await page.mouse.click(point.x, point.y, { button: 'right' });
  await expect(mirrorRight).toBeVisible();
  await expect(mirrorRight).toHaveText('Sağ');
  for (const [direction, label] of [['left', 'Sol'], ['front', 'Ön'], ['back', 'Arka']]) {
    await expect(page.locator(`[data-module-action="mirror"][data-mirror-direction="${direction}"]`)).toHaveText(label);
  }
  await mirrorRight.click();

  let project = await saveAndReadProject(page);
  expect(project.modules).toHaveLength(4);
  const originals = project.modules.slice(0, 2);
  const copies = project.modules.slice(2);
  expect(originals[0].placement).toMatchObject({ xCm: 100, yCm: 200, rotationZDeg: 0 });
  expect(originals[1].placement).toMatchObject({ xCm: 100, yCm: 245 });
  // Seçimin kaplaması x 100–300, sağ kenarı x 300: kopya baza x 300–500; sol uçtaki dikme (x 100–110)
  // kopyada sağ uca (x 490–500) düşer.
  const copyBase = copies.find((moduleState) => moduleState.itemKey === 'base_200');
  const copyUpright = copies.find((moduleState) => moduleState.itemKey === 'upright_346_5');
  expect(copyBase.placement).toMatchObject({ xCm: 300, rotationZDeg: 0 });
  expect(copyUpright.placement).toMatchObject({ xCm: 490, yCm: 245 });
  expect(copyBase.group.name).toBe('Ayna (ayna)');

  await page.locator('#design-undo').click();
  project = await saveAndReadProject(page);
  expect(project.modules).toHaveLength(2);
  expect(errors).toEqual([]);
});
