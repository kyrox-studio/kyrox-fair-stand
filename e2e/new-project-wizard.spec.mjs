import { test, expect } from '@playwright/test';

// Yeni proje sihirbazı: boş sahnede 3 adım (stand tipi, ölçü, özet + Oluştur). Mevcut kurulum
// alanlarını ve "Sahneyi Oluştur" akışını kullanır. İlk kullanım ipuçları bir kez çıkar.

const wizard = (page) => page.getByRole('dialog', { name: 'Yeni proje sihirbazı' });

async function finishNameDialog(page, name) {
  const nameInput = page.locator('form input[name="projectName"]');
  await expect(nameInput).toBeVisible();
  await nameInput.fill(name);
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
}

test('new project wizard sets up an L stand in three steps', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const dialog = wizard(page);
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Adım 1 / 3');
  const next = dialog.getByRole('button', { name: /İleri|Oluştur/ });
  await expect(next).toBeDisabled();

  await dialog.getByRole('button', { name: 'L Stand Sol' }).click();
  await next.click();
  await expect(dialog).toContainText('Adım 2 / 3');
  await dialog.locator('#wizard-size-x').fill('600');
  await dialog.locator('#wizard-size-y').fill('400');
  await dialog.locator('#wizard-wall-height').selectOption('300');
  // Sol menüdeki asıl alanlar güncellenir.
  await expect(page.locator('#stand-size-x')).toHaveValue('600');
  await expect(page.locator('#wall-height')).toHaveValue('300');
  await next.click();
  await expect(dialog).toContainText('Adım 3 / 3');
  await expect(dialog).toContainText('L Stand Sol');
  await expect(dialog).toContainText('600 × 400 cm · duvar 300 cm');

  await dialog.getByRole('button', { name: 'Oluştur' }).click();
  await finishNameDialog(page, 'E2E Sihirbaz');
  await expect(page.locator('#stage-result')).toContainText('L Stand Sol · 600 × 400 cm');
  await expect(dialog).toBeHidden();
  expect(errors).toEqual([]);
});

test('wizard shows the size error on the step and close falls back to the sidebar card', async ({ page }) => {
  await page.goto('/');
  const dialog = wizard(page);
  await dialog.getByRole('button', { name: 'Ada Stand' }).click();
  await dialog.getByRole('button', { name: 'İleri →' }).click();
  await dialog.locator('#wizard-size-x').fill('55');
  await dialog.locator('#wizard-size-y').fill('400');
  await dialog.getByRole('button', { name: 'İleri →' }).click();
  await expect(dialog).toContainText('Adım 2 / 3');
  await expect(dialog.locator('.wizard-error')).toBeVisible();

  await dialog.getByRole('button', { name: 'Sihirbazı kapat' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('.viewport-empty-card')).toBeVisible();
});

test.describe('first-use tips', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('tips show once after the first stand and never again', async ({ page }) => {
    await page.goto('/');
    const dialog = wizard(page);
    await dialog.getByRole('button', { name: 'Ada Stand' }).click();
    await dialog.getByRole('button', { name: 'İleri →' }).click();
    await dialog.locator('#wizard-size-x').fill('500');
    await dialog.locator('#wizard-size-y').fill('500');
    await dialog.getByRole('button', { name: 'İleri →' }).click();
    await dialog.getByRole('button', { name: 'Oluştur' }).click();
    await finishNameDialog(page, 'E2E Ipucu');

    const tip = page.getByRole('status', { name: 'İpucu' });
    await expect(tip).toContainText('İpucu 1 / 3');
    await tip.getByRole('button', { name: 'Tamam' }).click();
    await expect(tip).toContainText('İpucu 2 / 3');
    await tip.getByRole('button', { name: 'Tamam' }).click();
    await tip.getByRole('button', { name: 'Bitir' }).click();
    await expect(tip).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('fairStandTipsSeen'))).toBe('1');

    await page.reload();
    const standSetup = page.locator('details.stand-setup-card');
    if (!(await standSetup.evaluate((el) => el.open))) await standSetup.locator('summary').click();
    await standSetup.getByRole('button', { name: 'Sırt Duvar' }).click();
    await page.locator('#stand-size-x').fill('500');
    await page.locator('#stand-size-y').fill('300');
    await page.locator('#create-stage').click();
    page.once('dialog', (confirm) => confirm.accept());
    await finishNameDialog(page, 'E2E Ipucu 2');
    await expect(page.getByRole('status', { name: 'İpucu' })).toBeHidden();
  });
});

test.describe('tablet', () => {
  test.use({ viewport: { width: 820, height: 1180 }, hasTouch: true });

  test('wizard works with taps on a tablet', async ({ page }) => {
    await page.goto('/');
    const dialog = wizard(page);
    await dialog.getByRole('button', { name: 'Sırt Duvar' }).tap();
    await dialog.getByRole('button', { name: 'İleri →' }).tap();
    await dialog.locator('#wizard-size-x').fill('400');
    await dialog.locator('#wizard-size-y').fill('300');
    await dialog.getByRole('button', { name: 'İleri →' }).tap();
    await dialog.getByRole('button', { name: 'Oluştur' }).tap();
    await finishNameDialog(page, 'E2E Sihirbaz Tablet');
    await expect(page.locator('#stage-result')).toContainText('Sırt Duvar · 400 × 300 cm');
  });
});
