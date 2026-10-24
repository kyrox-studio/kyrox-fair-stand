import { test, expect } from '@playwright/test';

// Proje açma ölçümü (ölçüm anahtarı açıkken): kayıtlı proje yeniden açılınca konsola adım süreleri yazılır,
// görseller ve modeller gelince "sahne tamamen hazır" satırı gelir. Açılış eskisi gibi tamamlanır.
test('opening a saved project logs step timings and model loads', async ({ page }) => {
  const measurements = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (message.text().startsWith('[Fair Stand ölçüm]')) measurements.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('fairStandTiming', '1'));

  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('5');
  await page.locator('#stand-size-y').fill('5');
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill('E2E Olcum');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();

  const openCatalogButton = page.locator('.module-drag-catalog');
  const modulePanel = page.locator('details', { has: openCatalogButton });
  await modulePanel.locator(':scope > summary').click();
  const card = page.locator('.module-drag-card[data-module-key="box_block"]');
  const group = page.locator('.module-drag-group', { has: card });
  if (!(await group.evaluate((el) => el.open))) await group.locator(':scope > summary').click();
  await card.scrollIntoViewIfNeeded();
  const viewport = await page.locator('#viewport').boundingBox();
  await card.dragTo(page.locator('#viewport'), {
    targetPosition: { x: Math.round(viewport.width * 0.5), y: Math.round(viewport.height * 0.7) },
  });
  await expect(page.locator('#box-block-size-title')).toBeVisible();
  await page.getByRole('button', { name: 'Uygula' }).click();
  await expect(page.locator('#box-block-size-title')).toHaveCount(0);

  await page.locator('#save-project').click();
  await expect(page.locator('#project-status')).toContainText('Kaydedildi:');
  const projectId = await page.locator('#project-select').inputValue();
  expect(projectId).toBeTruthy();

  await page.reload();
  await expect(page.locator('#viewport-empty')).toBeVisible();
  measurements.length = 0;
  const projectSelect = page.locator('#project-select');
  await expect(projectSelect.locator(`option[value="${projectId}"]`)).toHaveCount(1);
  await projectSelect.evaluate((select, id) => { select.value = id; }, projectId);
  await page.locator('#open-project').click();
  await expect(page.locator('#project-status')).toContainText('Açıldı:');

  await expect.poll(() => measurements.length, { timeout: 15000 }).toBeGreaterThanOrEqual(2);
  const [opened, models] = measurements;
  expect(opened).toMatch(/^\[Fair Stand ölçüm\] proje açıldı: toplam \d+ ms/);
  expect(opened).toMatch(/proje \(yerel\) \d+ ms/);
  expect(opened).toMatch(/görsel hazırlama \d+ ms/);
  expect(opened).toMatch(/sahne kurulumu \d+ ms/);
  expect(opened).toMatch(/· 1 modül$/);
  expect(models).toMatch(/^\[Fair Stand ölçüm\] sahne tamamen hazır: açılıştan \+\d+ ms · \d+ görsel yüzeyi · \d+ model/);
  expect(pageErrors).toEqual([]);
});

// Varsayılan: kullanıcının konsoluna ölçüm satırı yazılmaz.
test('without the timing switch no measurement lines reach the console', async ({ page }) => {
  const measurements = [];
  page.on('console', (message) => {
    if (message.text().startsWith('[Fair Stand ölçüm]')) measurements.push(message.text());
  });
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('5');
  await page.locator('#stand-size-y').fill('5');
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill('E2E Olcum Kapali');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  await page.locator('#save-project').click();
  await page.locator('#open-project').click();
  await page.waitForTimeout(2500);
  expect(measurements).toEqual([]);
});
