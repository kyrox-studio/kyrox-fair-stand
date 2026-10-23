import { openProductionDetails } from './helpers/productionDetails.mjs';
import { test, expect } from '@playwright/test';

// Düz duvara sağ tıkla arka yüze panel eklenir ve kaldırılır; üretim listesi iki yüzü sayar.

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
  const selection = page.getByRole('toolbar', { name: 'Seçim işlemleri' });
  if (await selection.isVisible()) {
    const selectedRect = await selection.boundingBox();
    const mainRect = await page.locator('#viewport-toolbar').boundingBox();
    const overlaps = selectedRect.x < mainRect.x + mainRect.width
      && selectedRect.x + selectedRect.width > mainRect.x
      && selectedRect.y < mainRect.y + mainRect.height
      && selectedRect.y + selectedRect.height > mainRect.y;
    expect(overlaps).toBe(false);
  }
  await page.locator('#save-project').click();
  await expect(page.locator('#save-project')).toBeEnabled();
  return readLatestProject(page);
}

function panelScreenPoint(page, moduleId, side) {
  return page.evaluate(({ id, panelSide }) => {
    const panel = window.__sceneSurfaces().find((mesh) => mesh.userData.moduleId === id
      && (mesh.userData.panelSide ?? 'front') === panelSide && mesh.userData.stripIndex === 3);
    const canvas = document.querySelector('#viewport > canvas').getBoundingClientRect();
    panel.updateMatrixWorld(true);
    const screen = panel.getWorldPosition(panel.position.clone()).project(window.__sceneCamera);
    return {
      x: canvas.left + ((screen.x + 1) / 2) * canvas.width,
      y: canvas.top + ((1 - screen.y) / 2) * canvas.height,
    };
  }, { id: moduleId, panelSide: side });
}

test('düz duvara sağ tıkla arka yüze panel eklenir, kaldırılır; üretim listesi iki yüzü 14 panel sayar', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await exposeScene(page);
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('5');
  await page.locator('#stand-size-y').fill('5');
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill('E2E Arka Yüz');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  await page.locator('#save-project').click();
  await expect(page.locator('#save-project')).toBeEnabled();

  const projectId = await page.evaluate(async () => {
    const designState = await import('/src/designState.js');
    const placement = await import('/src/modulePlacement.js');
    const wall = designState.createModuleStateFromCatalogKey('wall_100_350');
    wall.placement = placement.createModulePlacement({ xCm: 200, yCm: 250, zCm: 0, rotationZDeg: 0, wallId: 'free' });
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
    project.modules = [wall];
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
  await page.locator('#open-project').click();
  await expect(page.locator('#project-status')).toContainText('Açıldı:');
  const wallId = (await readLatestProject(page)).modules[0].id;

  const menuButton = page.locator('[data-module-action="toggle-back-panels"]');
  const front = await panelScreenPoint(page, wallId, 'front');
  await page.mouse.click(front.x, front.y, { button: 'right' });
  await expect(menuButton).toHaveText('Arka yüze panel ekle');
  await menuButton.click();
  let project = await saveAndReadProject(page);
  expect(project.modules[0].backStrips).toHaveLength(7);
  expect(project.modules[0].backStrips.map((strip) => strip.itemKey)).toEqual(Array(7).fill('panel_98'));
  await expect.poll(() => page.evaluate((id) => window.__sceneSurfaces()
    .filter((mesh) => mesh.userData.moduleId === id && mesh.userData.panelSide === 'back').length, wallId)).toBe(7);

  const again = await panelScreenPoint(page, wallId, 'front');
  await page.mouse.click(again.x, again.y, { button: 'right' });
  await expect(menuButton).toHaveText('Arka yüz panellerini kaldır');
  await menuButton.click();
  project = await saveAndReadProject(page);
  expect('backStrips' in project.modules[0]).toBe(false);
  await expect.poll(() => page.evaluate((id) => window.__sceneSurfaces()
    .filter((mesh) => mesh.userData.moduleId === id && mesh.userData.panelSide === 'back').length, wallId)).toBe(0);

  // Yeniden ekle: üretim listesi iki yüzü sayar (tek çerçeve, 14 panel).
  const third = await panelScreenPoint(page, wallId, 'front');
  await page.mouse.click(third.x, third.y, { button: 'right' });
  await menuButton.click();
  await saveAndReadProject(page);
  // Seçim çubuğu üretim listesi düğmesinin önüne geçer; önce seçimi kaldır.
  const canvasBox = await page.locator('#viewport > canvas').boundingBox();
  await page.mouse.click(canvasBox.x + canvasBox.width * 0.2, canvasBox.y + canvasBox.height * 0.85);
  await openProductionDetails(page);
  await expect(page.locator('#toggle-production-bom')).toBeVisible();
  await openProductionDetails(page);
  await page.locator('#toggle-production-bom').click();
  const totals = page.locator('#production-bom-panel [data-bom-collapse-key="__totals__"]');
  await totals.locator('summary').click();
  await expect(totals.locator('li[data-item-key="panel_98"]')).toHaveText(/^14 × .* · adet$/);
  await expect(totals.locator('li[data-item-key="profile_91"]')).toHaveText(/^2 × .* · adet$/);
  await expect(totals.locator('li[data-item-key="upright_346_5"]')).toHaveText(/^2 × .* · adet$/);
  expect(errors).toEqual([]);
});
