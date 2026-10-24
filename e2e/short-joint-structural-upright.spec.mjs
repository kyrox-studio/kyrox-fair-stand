import { test, expect } from '@playwright/test';
import { openEditorSettings } from './helpers/editorSettings.mjs';
import { openProductionDetails } from './helpers/productionDetails.mjs';

// Kaydedilmiş sahne fixture'ı gerçek Item state factory'siyle üretilir; BOM ve
// proje açma/kaydetme uygulamanın kendi yollarından doğrulanır.
for (const { level, corner } of [{ level: 1, corner: false }, { level: 2, corner: true }]) {
  test(`ortak uçta taşıyıcı: ${level} sıra ${corner ? 'köşe' : 'uç uca'}, üretim listesi ve kayıt/açma`, async ({ page }) => {
    test.setTimeout(60_000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    const setup = page.locator('details.stand-setup-card');
    await setup.locator(':scope > summary').click();
    await setup.getByRole('button', { name: 'Ada Stand', exact: true }).click();
    await page.locator('#stand-size-x').fill('6');
    await page.locator('#stand-size-y').fill('4');
    await page.locator('#create-stage').click();
    await page.locator('form input[name="projectName"]').fill(`Ortak kısa dikme ${level}`);
    await page.getByRole('button', { name: 'Projeyi Oluştur', exact: true }).click();
    await expect(page.locator('#viewport-toolbar')).toBeVisible();
    await openEditorSettings(page);
    await page.locator('#autosave-interval').selectOption('0');
    const projectId = await page.locator('#project-select').inputValue();

    await page.evaluate(async ({ id, level, corner }) => {
      const { createModuleStateFromCatalogKey } = await import('/src/designState.js');
      const module = (key, id, xCm, yCm, zCm, rotationZDeg) => {
        const state = createModuleStateFromCatalogKey(key);
        state.id = id;
        state.placement = { xCm, yCm, zCm, rotationZDeg, wallId: 'free' };
        return state;
      };
      const key = `wall_200_short_${level}`;
      const z = level === 1 ? 300 : 250;
      const modules = [module(key, 'short-a', 0, 100, z, 180),
        module(key, 'short-b', corner ? 0 : 200, 100, z, corner ? 270 : 180),
        module('upright_346_5', 'post', corner ? 0 : 196, 100, 0, corner ? 270 : 180)];
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
        tx.onabort = () => reject(tx.error);
      });
      db.close();
    }, { id: projectId, level, corner });

    async function reopenAndCheck() {
      await page.reload();
      await expect(page.locator('#project-select').locator(`option[value="${projectId}"]`)).toHaveCount(1);
      await page.locator('#project-select').evaluate((select, id) => { select.value = id; }, projectId);
      await page.locator('#open-project').click();
      await expect(page.locator('#project-status')).toContainText('Açıldı:');
      await expect(page.locator('#project-loading-overlay')).toBeHidden({ timeout: 30_000 });
      await openProductionDetails(page);
      await page.locator('#toggle-production-bom').click();
      const totals = page.locator('#production-bom-panel [data-bom-collapse-key="__totals__"]');
      if (!(await totals.evaluate(element => element.open))) await totals.locator(':scope > summary').click();
      const key = level === 1 ? 'upright_49_5' : 'upright_99';
      await expect(totals.locator(`li[data-item-key="${key}"]`)).toHaveText(/^2 × .* · adet$/);
      await expect(totals.locator('li[data-item-key="upright_346_5"]')).toHaveText(/^1 × .* · adet$/);
    }
    await reopenAndCheck();
    await page.locator('#save-project').click();
    await expect(page.locator('#project-status')).toContainText('Kaydedildi:');
    await reopenAndCheck();
    expect(errors).toEqual([]);
  });
}
