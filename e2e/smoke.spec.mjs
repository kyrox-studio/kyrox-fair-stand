import { test, expect } from '@playwright/test';

test('user can create an island stand through the real browser UI', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Maxima Konfigüratörü' })).toBeVisible();
  await expect(page.locator('#viewport-empty')).toBeVisible();

  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();

  const islandButton = standSetup.getByRole('button', { name: 'Ada Stand' });
  await expect(islandButton).toBeVisible();
  await islandButton.click();
  await page.locator('#stand-size-x').fill('5');
  await page.locator('#stand-size-y').fill('5');

  const createStage = page.locator('#create-stage');
  await expect(createStage).toBeEnabled();
  await createStage.click();

  const projectNameInput = page.locator('form input[name="projectName"]');
  await expect(projectNameInput).toBeVisible();
  await projectNameInput.fill('E2E Smoke');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();

  await expect(page.locator('#viewport-empty')).toBeHidden();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  await expect(page.locator('#clear-wall')).toBeEnabled();
  await expect(page.locator('#stage-result')).toContainText('Ada Stand · 500 × 500 cm');
  await expect(page.locator('#project-name-display')).toHaveText('E2E_Smoke-Ada_500_500');

  expect(pageErrors).toEqual([]);
});
