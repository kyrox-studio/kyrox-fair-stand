import { test, expect } from '@playwright/test';

test('view cube home and face controls stay usable after a stage is created', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');

  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('4');
  await page.locator('#stand-size-y').fill('4');
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill('View Cube Home');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();

  await expect(page.locator('#viewport-empty')).toBeHidden();
  const homeButton = page.locator('.view-cube-home');
  await expect(homeButton).toBeVisible();
  await homeButton.click();
  await page.keyboard.press('h');
  await page.locator('.view-cube-canvas canvas').click();

  expect(pageErrors).toEqual([]);
});
