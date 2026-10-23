import { test, expect } from '@playwright/test';

// 500 cm duvarın reçetesindeki upright_495 Üretim Listesi'nde tek satır kalır, adın yanında
// parça bölünüşü yazar; standart boylarda bölünüş yazılmaz.
test('Üretim Listesi uzun dikmeyi parça bölünüşüyle tek satırda gösterir', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/');

  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Sırt Duvar' }).click();
  await page.locator('#stand-size-x').fill('300');
  await page.locator('#stand-size-y').fill('200');
  await page.locator('#wall-height').selectOption('500');
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill('Uzun Parca Bolunus');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-empty')).toBeHidden();

  await page.locator('#toggle-production-bom').click();
  const panel = page.locator('#production-bom-panel');
  await expect(panel).toBeVisible();
  const lines = panel.locator('li');
  // Satır parça kodunu yazmaz; kod data-item-key / ipucunda.
  await expect(panel.locator('li[data-item-key="upright_495"]').first()).toContainText('Dikme 495 (346,5 + 8 + 140,5) · adet');
  await expect(panel.locator('li[data-item-key="upright_495"]').first()).not.toContainText('upright_495');
  // Bölünüş yalnız etiket: profile_8 ayrı satır olarak görünmez.
  await expect(panel.locator('li[data-item-key="profile_8"]')).toHaveCount(0);
  const standard = panel.locator('li[data-item-key="profile_190"]').first();
  await expect(standard).not.toContainText('(');

  expect(pageErrors).toEqual([]);
});
