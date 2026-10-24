import { test, expect } from '@playwright/test';

// Proje açılırken yükleme ekranı bütün görseller ve 3D modeller gelene kadar kalır:
// model indirmesi bilerek geciktirilir; ekran model gelmeden kapanmamalı.
const MODEL_DELAY_MS = 2500;

test('loading screen stays until the delayed 3D model has arrived', async ({ page }) => {
  test.setTimeout(120000);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('6');
  await page.locator('#stand-size-y').fill('6');
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill('E2E Bekle');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();

  const openCatalogButton = page.locator('.module-drag-catalog');
  const modulePanel = page.locator('details', { has: openCatalogButton });
  await modulePanel.locator(':scope > summary').click();
  const card = page.locator('.module-drag-card[data-module-key="extra_indoor_plant_1"]');
  const group = page.locator('.module-drag-group', { has: card });
  if (!(await group.evaluate((el) => el.open))) await group.locator(':scope > summary').click();
  await card.scrollIntoViewIfNeeded();
  const viewport = await page.locator('#viewport').boundingBox();
  await card.dragTo(page.locator('#viewport'), {
    targetPosition: { x: Math.round(viewport.width * 0.62), y: Math.round(viewport.height * 0.86) },
  });
  await page.locator('#save-project').click();
  await expect(page.locator('#project-status')).toContainText('Kaydedildi:');
  const projectId = await page.locator('#project-select').inputValue();

  await page.reload();
  await expect(page.locator('#viewport-empty')).toBeVisible();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.clearBrowserCache');
  let modelArrivedAt = null;
  await page.route('**/models/indoor_plants.glb*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, MODEL_DELAY_MS));
    modelArrivedAt = Date.now();
    await route.continue();
  });

  const overlay = page.locator('#project-loading-overlay');
  await page.locator('#project-select').evaluate((select, id) => { select.value = id; }, projectId);
  await page.locator('#open-project').click();
  // Sahne kuruldu (durum satırı "Açıldı"), ama model gecikmede: ekran açık ve ilerleme yazıyor.
  await expect(page.locator('#project-status')).toContainText('Açıldı:');
  expect(modelArrivedAt).toBeNull();
  await expect(overlay).toBeVisible();
  await expect(page.locator('#project-loading-detail')).toHaveText(/Görseller ve 3D modeller yükleniyor… \d+ \/ \d+/);

  await expect(overlay).toBeHidden({ timeout: 30000 });
  const hiddenAt = Date.now();
  expect(modelArrivedAt).not.toBeNull();
  expect(hiddenAt).toBeGreaterThanOrEqual(modelArrivedAt);
  expect(pageErrors).toEqual([]);
});
