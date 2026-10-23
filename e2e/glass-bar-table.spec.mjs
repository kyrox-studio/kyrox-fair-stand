import { test, expect } from '@playwright/test';

// Bar masası sahnede cam masa ile aynı çizilir; seçim kutusu (ve tabla) 108 cm'dedir. Katalog üyeliği: test/glassBarTable.test.js.

async function exposeScene(page) {
  await page.route('**/src/scene3d.js*', async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace('  let surfaceMeshes = [];', '  let surfaceMeshes = []; window.__sceneSurfaces = () => surfaceMeshes;');
    await route.fulfill({ response, body });
  });
}

test('bar masası 108 cm, cam masa 74 cm; aynı çizim ailesi', async ({ page }) => {
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
  await page.locator('form input[name="projectName"]').fill('E2E Bar Masası');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  await page.locator('#save-project').click();
  await expect(page.locator('#save-project')).toBeEnabled();

  const projectId = await page.evaluate(async () => {
    const designState = await import('/src/designState.js');
    const placement = await import('/src/modulePlacement.js');
    const table = designState.createModuleStateFromCatalogKey('glass_table');
    table.placement = placement.createModulePlacement({ xCm: 150, yCm: 250, zCm: 0, rotationZDeg: 0, wallId: 'free' });
    const bar = designState.createModuleStateFromCatalogKey('glass_bar_table');
    bar.placement = placement.createModulePlacement({ xCm: 350, yCm: 250, zCm: 0, rotationZDeg: 0, wallId: 'free' });
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
    project.modules = [table, bar];
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

  // Seçim kutusu (proxy) masa yüksekliğindedir: 74 ve 108 cm.
  await expect.poll(() => page.evaluate(() => window.__sceneSurfaces()
    .filter((mesh) => mesh.userData.moduleType === 'table-glass')
    .map((mesh) => Math.round(mesh.geometry.parameters.height * 100))
    .sort((a, b) => a - b))).toEqual([74, 108]);
  expect(errors).toEqual([]);
});
