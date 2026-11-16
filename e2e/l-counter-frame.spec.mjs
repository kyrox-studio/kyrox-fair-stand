import { test, expect } from '@playwright/test';
import { createStageFromWizard, clickProjectAction } from './helpers/standSetup.mjs';
import { openEditorSettings } from './helpers/editorSettings.mjs';

// L banko çerçevesi (kullanıcı kararı 2026-11-16): orta kot rayı yok; tablanın altında iç kenarda
// üstte uzun ve kısa ray. Sahne Üretim Listesi'yle aynı sayıda profil çizer (100 / 150 / 200).
const CASES = {
  desk_banko_100_l: { 99: 5, 91: 5, '41,5': 5 },
  desk_banko_150_l: { 99: 5, '140,5': 5, 91: 1, '41,5': 4 },
  desk_banko_200_l: { 99: 5, 190: 5, '140,5': 1, '41,5': 4 },
};

for (const [itemKey, expected] of Object.entries(CASES)) {
  test(`${itemKey}: İskelet listedeki uzun ve kısa profilleri çizer`, async ({ page }) => {
    test.setTimeout(90_000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    const setup = page.locator('details.stand-setup-card');
    await setup.locator(':scope > summary').click();
    await setup.getByRole('button', { name: 'Ada Stand', exact: true }).click();
    await page.locator('#stand-size-x').fill('6');
    await page.locator('#stand-size-y').fill('5');
    await createStageFromWizard(page);
    await page.locator('form input[name="projectName"]').fill('L banko çerçevesi');
    await page.getByRole('button', { name: 'Projeyi Oluştur', exact: true }).click();
    await expect(page.locator('#viewport-toolbar')).toBeVisible();
    await openEditorSettings(page);
    await page.locator('#autosave-interval').selectOption('0');
    const projectId = await page.locator('#project-select').inputValue();

    await page.evaluate(async ({ id, itemKey }) => {
      const { createModuleStateFromCatalogKey } = await import('/src/designState.js');
      const module = (key, moduleId, xCm, yCm) => {
        const state = createModuleStateFromCatalogKey(key);
        state.id = moduleId;
        state.placement = { xCm, yCm, zCm: 0, rotationZDeg: 0, wallId: 'free' };
        return state;
      };
      const modules = [module(itemKey, 'l', 250, 250)];
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
    }, { id: projectId, itemKey });

    await page.reload();
    await page.locator('#project-select').evaluate((select, id) => { select.value = id; }, projectId);
    await clickProjectAction(page, 'open-project');
    await expect(page.locator('#project-status')).toContainText('Açıldı:');
    await expect(page.locator('#project-loading-overlay')).toBeHidden({ timeout: 30_000 });

    const skeleton = page.locator('#toggle-skeleton');
    await skeleton.click();
    await expect(skeleton).toHaveAttribute('aria-pressed', 'true');
    const labels = page.locator('.scene-skeleton-label');
    await expect.poll(() => labels.count()).toBe(15);
    const counts = {};
    for (const text of await labels.allTextContents()) counts[text] = (counts[text] ?? 0) + 1;
    expect(counts).toEqual(expected);
    await expect(page.locator('#panel-assignment-summary')).toContainText('Dikme 99: 5');
    expect(errors).toEqual([]);
  });
}
