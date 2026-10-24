import { openEditorSettings } from './helpers/editorSettings.mjs';
import { test, expect } from '@playwright/test';

// Kısa panel seçiliyken Ekle → katalogdan Panel: yeni panel kısa panelin üstüne / aynı hizaya binmez.
async function exposeScene(page) {
  await page.route('**/src/scene3d.js*', async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace(
        'const controls = new OrbitControls(camera, renderer.domElement);',
        'const controls = new OrbitControls(camera, renderer.domElement); window.__sceneCamera = camera;',
      )
      .replace('  let surfaceMeshes = [];', '  let surfaceMeshes = []; window.__sceneSurfaces = () => surfaceMeshes;');
    await route.fulfill({ response, body });
  });
}

function readModules(page) {
  return page.evaluate(async () => {
    const { getActiveAutosaveController } = await import('/src/autosaveController.js');
    await getActiveAutosaveController().flush();
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
    const latest = projects.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
    return latest?.modules ?? latest?.design?.modules ?? [];
  });
}

function moduleScreenPoint(page, moduleId) {
  return page.evaluate((id) => {
    const surface = window.__sceneSurfaces().find((mesh) => mesh.userData.moduleId === id);
    const canvas = document.querySelector('#viewport > canvas').getBoundingClientRect();
    surface.updateMatrixWorld(true);
    const center = surface.getWorldPosition(surface.position.clone()).project(window.__sceneCamera);
    return { x: canvas.left + ((center.x + 1) / 2) * canvas.width, y: canvas.top + ((1 - center.y) / 2) * canvas.height };
  }, moduleId);
}

async function addFromPanel(page, { tab, card, itemKey }) {
  await page.locator('.selection-property-panel [data-module-action="add"]').click();
  const picker = page.locator('.module-picker-backdrop');
  await expect(picker).toBeVisible();
  await picker.locator('.module-picker-tab', { hasText: tab }).click();
  await picker.locator(`[data-module-key="${card}"]`).click();
  await picker.locator('.module-picker-add').click();
  const dialog = page.locator('.item-size-dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('select[name="itemKey"]').selectOption(itemKey);
  await dialog.locator('button[type="submit"]').click();
  await expect(picker).toBeHidden();
}

// Öğenin dünya kutusu (cm): yeni panel kısa panelin kutusuyla kesişmemeli.
function moduleBoxes(page, ids) {
  return page.evaluate((moduleIds) => Object.fromEntries(moduleIds.map((id) => {
    const meshes = window.__sceneSurfaces().filter((mesh) => mesh.userData.moduleId === id);
    let min = [Infinity, Infinity, Infinity];
    let max = [-Infinity, -Infinity, -Infinity];
    meshes.forEach((mesh) => {
      mesh.updateMatrixWorld(true);
      mesh.geometry.computeBoundingBox();
      const box = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
      min = min.map((value, index) => Math.min(value, box.min.toArray()[index]));
      max = max.map((value, index) => Math.max(value, box.max.toArray()[index]));
    });
    return [id, { min: min.map((value) => Math.round(value * 100)), max: max.map((value) => Math.round(value * 100)) }];
  })), ids);
}

test('kısa panel seçiliyken Ekle ile eklenen Panel kısa panelin üstüne binmez', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await exposeScene(page);
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill('E2E Kisa Panel Ekle');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  await openEditorSettings(page);
  await page.locator('#autosave-interval').selectOption('0');

  // Kısa paneli sahneye katalogdan ekle (seçim yok → duvar sonuna / müsait yere).
  const openCatalogButton = page.locator('#open-module-catalog');
  await page.locator('details', { has: openCatalogButton }).locator(':scope > summary').click();
  await openCatalogButton.click();
  const picker = page.locator('.module-picker-backdrop');
  await picker.locator('.module-picker-tab', { hasText: 'Panel Ek Modül' }).click();
  await picker.locator('[data-module-key="wall_100_short_1"]').click();
  await picker.locator('.module-picker-add').click();
  const dialog = page.locator('.item-size-dialog');
  await dialog.locator('select[name="itemKey"]').selectOption('wall_100_short_1');
  await dialog.locator('button[type="submit"]').click();
  await expect(picker).toBeHidden();
  let modules = await readModules(page);
  const short = modules.find((moduleState) => moduleState.itemKey === 'wall_100_short_1');
  expect(short).toBeTruthy();

  await page.locator('body').press('Escape');
  const point = await moduleScreenPoint(page, short.id);
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('.selection-property-heading')).toContainText('Panel Tek Sıra');
  await addFromPanel(page, { tab: 'Panel & Duvar', card: 'wall_100_350', itemKey: 'wall_100_350' });
  modules = await readModules(page);
  const panel = modules.find((moduleState) => moduleState.itemKey === 'wall_100_350');
  expect(panel).toBeTruthy();
  // Panel kısa panelin yüksekliğini (z) devralmaz: zeminden başlar; kısa panel yerinde kalır.
  expect(panel.placement.zCm ?? 0).toBe(0);
  expect(modules.find((moduleState) => moduleState.id === short.id).placement.zCm).toBe(short.placement.zCm);
  const boxes = await moduleBoxes(page, [short.id, panel.id]);
  // Panelin ilk bandı zeminden ~9 cm yukarıda başlar; havada asılı değildir.
  expect(boxes[panel.id].min[1]).toBeLessThan(50);
  expect(errors).toEqual([]);
});
