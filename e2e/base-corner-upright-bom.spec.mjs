import { test, expect } from '@playwright/test';
import { createStageFromWizard, clickProjectAction } from './helpers/standSetup.mjs';
import { openEditorSettings } from './helpers/editorSettings.mjs';

// Bazanın arka köşelerinde 346,5 dikme duruyorsa o köşelerin 49,5 dikmesi üretim listesinden
// düşer (kullanıcı sahnesi 2026-11-11: 4 değil 2 × Dikme 49,5).
test('baza köşesindeki 346,5 dikme üretim listesinde 49,5 dikmenin yerini alır', async ({ page }) => {
  test.setTimeout(60_000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const setup = page.locator('details.stand-setup-card');
  await setup.locator(':scope > summary').click();
  await setup.getByRole('button', { name: 'Ada Stand', exact: true }).click();
  await page.locator('#stand-size-x').fill('5');
  await page.locator('#stand-size-y').fill('4');
  await createStageFromWizard(page);
  await page.locator('form input[name="projectName"]').fill('Baza köşe dikmesi');
  await page.getByRole('button', { name: 'Projeyi Oluştur', exact: true }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  await openEditorSettings(page);
  await page.locator('#autosave-interval').selectOption('0');
  const projectId = await page.locator('#project-select').inputValue();

  await page.evaluate(async ({ id }) => {
    const { createModuleStateFromCatalogKey } = await import('/src/designState.js');
    const module = (key, moduleId, xCm, yCm, rotationZDeg) => {
      const state = createModuleStateFromCatalogKey(key);
      state.id = moduleId;
      state.placement = { xCm, yCm, zCm: 0, rotationZDeg, wallId: 'free' };
      return state;
    };
    const modules = [
      module('base_200', 'base', 255, 105, 90),
      module('upright_346_5', 'post-a', 230, 100, 90),
      module('upright_346_5', 'post-b', 230, 300, 90),
    ];
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('fair-stand-configurator', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      const store = tx.objectStore('projects');
      const request = store.get(id);
      request.onsuccess = () => store.put({ ...request.result, modules });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, { id: projectId });

  await page.reload();
  await page.locator('#project-select').evaluate((select, id) => { select.value = id; }, projectId);
  await clickProjectAction(page, 'open-project');
  await expect(page.locator('#project-status')).toContainText('Açıldı:');
  await expect(page.locator('#project-loading-overlay')).toBeHidden({ timeout: 30_000 });
  await page.locator('#toggle-production-bom').click();
  const totals = page.locator('#production-bom-panel [data-bom-collapse-key="__totals__"]');
  if (!(await totals.evaluate((element) => element.open))) await totals.locator(':scope > summary').click();
  await expect(totals.locator('li[data-item-key="upright_49_5"]')).toHaveText(/^2 × .* · adet$/);
  await expect(totals.locator('li[data-item-key="upright_346_5"]')).toHaveText(/^2 × .* · adet$/);
  expect(errors).toEqual([]);
});
