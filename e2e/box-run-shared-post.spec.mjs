import { test, expect } from '@playwright/test';
import { createStageFromWizard, clickProjectAction } from './helpers/standSetup.mjs';
import { openEditorSettings } from './helpers/editorSettings.mjs';

// Yan yana baza / banko (kullanıcı kararı 2026-11-16): ortak uçtaki iki dikme ve iki yan profil
// listede de sahnede de tek; aradaki yan paneller çizilmez. İki baza + iki banko:
// Dikme 49,5 = 6, Dikme 99 = 6; İskelet'te aynı sayıda dikme çizilir.
test('yan yana baza ve bankoda ortak dikme listede ve sahnede tektir', async ({ page }) => {
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
  await page.locator('form input[name="projectName"]').fill('Baza banko birleşimi');
  await page.getByRole('button', { name: 'Projeyi Oluştur', exact: true }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  await openEditorSettings(page);
  await page.locator('#autosave-interval').selectOption('0');
  const projectId = await page.locator('#project-select').inputValue();

  await page.evaluate(async ({ id }) => {
    const { createModuleStateFromCatalogKey } = await import('/src/designState.js');
    const module = (key, moduleId, xCm, yCm) => {
      const state = createModuleStateFromCatalogKey(key);
      state.id = moduleId;
      state.placement = { xCm, yCm, zCm: 0, rotationZDeg: 0, wallId: 'free' };
      return state;
    };
    const modules = [
      module('base_100', 'base-a', 150, 150),
      module('base_100', 'base-b', 250, 150),
      module('desk_banko_100', 'desk-a', 150, 330),
      module('desk_banko_100', 'desk-b', 250, 330),
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
  await expect(totals.locator('li[data-item-key="upright_49_5"]')).toHaveText(/^6 × .* · adet$/);
  await expect(totals.locator('li[data-item-key="upright_99"]')).toHaveText(/^6 × .* · adet$/);
  // Dış yanaklar: baza 2 + banko 4 (alt + üst); aradakiler düşer.
  await expect(totals.locator('li[data-item-key="panel_48_5"]')).toHaveText(/^6 × .* · adet$/);
  await page.locator('#toggle-production-bom').click();

  const skeleton = page.locator('#toggle-skeleton');
  await skeleton.click();
  await expect(skeleton).toHaveAttribute('aria-pressed', 'true');
  const summary = page.locator('#panel-assignment-summary');
  await expect(summary).toContainText('Dikme 49,5: 6');
  await expect(summary).toContainText('Dikme 99: 6');
  const labels = page.locator('.scene-skeleton-label');
  await expect.poll(() => labels.count()).toBeGreaterThan(10);
  const texts = await labels.allTextContents();
  expect(texts.filter((text) => text === '49,5')).toHaveLength(6);
  expect(texts.filter((text) => text === '99')).toHaveLength(6);
  // Yan profil 41,5: baza 3 hat × 2 kot, banko 3 hat × 2 kot.
  expect(texts.filter((text) => text === '41,5')).toHaveLength(12);
  expect(errors).toEqual([]);
});
