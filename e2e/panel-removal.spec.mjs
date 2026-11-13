import { test, expect } from '@playwright/test';
import { createStageFromWizard, clickProjectAction } from './helpers/standSetup.mjs';
import { openPanelTab } from './helpers/surfaceControls.mjs';

// Panel kaldırma (kullanıcı kararı 2026-11-12): düz duvarın tıklanan bant paneli sağ tık →
// "Paneli kaldır" ile kalkar, bant boş çerçeve kalır; üretim listesinde panel ve iki tekli düşer.
// Duvara sağ tık → "Kaldırılan paneli geri ekle" eski hale döndürür.

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

function panelScreenPoint(page, moduleId, stripIndex) {
  return page.evaluate(({ id, index }) => {
    const panel = window.__sceneSurfaces().find((mesh) => mesh.userData.moduleId === id
      && (mesh.userData.panelSide ?? 'front') === 'front' && mesh.userData.stripIndex === index);
    if (!panel) return null;
    const canvas = document.querySelector('#viewport > canvas').getBoundingClientRect();
    panel.updateMatrixWorld(true);
    const screen = panel.getWorldPosition(panel.position.clone()).project(window.__sceneCamera);
    return {
      x: canvas.left + ((screen.x + 1) / 2) * canvas.width,
      y: canvas.top + ((1 - screen.y) / 2) * canvas.height,
    };
  }, { id: moduleId, index: stripIndex });
}

function frontPanelCount(page, moduleId) {
  return page.evaluate((id) => window.__sceneSurfaces()
    .filter((mesh) => mesh.userData.moduleId === id && (mesh.userData.panelSide ?? 'front') === 'front').length, moduleId);
}

async function openBomTotals(page) {
  const canvasBox = await page.locator('#viewport > canvas').boundingBox();
  await page.mouse.click(canvasBox.x + canvasBox.width * 0.2, canvasBox.y + canvasBox.height * 0.85);
  await page.locator('#toggle-production-bom').click();
  const totals = page.locator('#production-bom-panel [data-bom-collapse-key="__totals__"]');
  if (!(await totals.evaluate((element) => element.open))) await totals.locator(':scope > summary').click();
  return totals;
}

test('tıklanan panel kaldırılır, üretim listesi düşer; duvara sağ tıkla geri eklenir', async ({ page }) => {
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
  await page.locator('form input[name="projectName"]').fill('E2E Panel Kaldırma');
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
  await clickProjectAction(page, 'open-project');
  await expect(page.locator('#project-status')).toContainText('Açıldı:');
  const wallId = (await readLatestProject(page)).modules[0].id;
  await expect.poll(() => frontPanelCount(page, wallId)).toBe(7);

  // Ortadaki panele sağ tık → Paneli kaldır.
  const removeButton = page.locator('[data-module-action="remove-panels"]');
  const restoreButton = page.locator('[data-module-action="restore-panels"]');
  const point = await panelScreenPoint(page, wallId, 3);
  await page.mouse.click(point.x, point.y, { button: 'right' });
  await openPanelTab(page, 'more');
  await expect(removeButton).toBeVisible();
  await expect(removeButton).toHaveText('Paneli kaldır');
  await expect(restoreButton).toBeHidden();
  await removeButton.click();
  await expect.poll(() => frontPanelCount(page, wallId)).toBe(6);
  await expect.poll(() => panelScreenPoint(page, wallId, 3)).toBeNull();
  let project = await saveAndReadProject(page);
  expect(project.modules[0].strips[3].removed).toBe(true);
  expect(project.modules[0].strips.filter((strip) => strip.removed)).toHaveLength(1);

  let totals = await openBomTotals(page);
  await expect(totals.locator('li[data-item-key="panel_98"]')).toHaveText(/^6 × .* · adet$/);
  await expect(totals.locator('li[data-item-key="connector_single"]')).toHaveText(/^11 × .* · adet$/);
  await expect(totals.locator('li[data-item-key="connector_start"]')).toHaveText(/^2 × .* · adet$/);
  await page.locator('#toggle-production-bom').click();

  // Duvarın başka paneline sağ tık → Kaldırılan paneli geri ekle.
  const other = await panelScreenPoint(page, wallId, 5);
  await page.mouse.click(other.x, other.y, { button: 'right' });
  await openPanelTab(page, 'more');
  await expect(restoreButton).toBeVisible();
  await expect(restoreButton).toHaveText('Kaldırılan paneli geri ekle');
  await restoreButton.click();
  await expect.poll(() => frontPanelCount(page, wallId)).toBe(7);
  project = await saveAndReadProject(page);
  expect(project.modules[0].strips.some((strip) => strip.removed)).toBe(false);

  totals = await openBomTotals(page);
  await expect(totals.locator('li[data-item-key="panel_98"]')).toHaveText(/^7 × .* · adet$/);
  await expect(totals.locator('li[data-item-key="connector_single"]')).toHaveText(/^13 × .* · adet$/);
  expect(errors).toEqual([]);
});
