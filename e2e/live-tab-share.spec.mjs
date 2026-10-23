import { test, expect } from '@playwright/test';

test('canlı paylaşım kontrolü sahne açılınca toolbar içinde durur', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#live-share-start')).toBeHidden();

  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Sırt Duvar' }).click();
  await page.locator('#stand-size-x').fill('5');
  await page.locator('#stand-size-y').fill('5');
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill('Canlı paylaşım');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();

  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ekranı paylaş' })).toBeVisible();
  await expect(page.locator('#viewport-toolbar #save-project')).toBeVisible();
  await expect(page.locator('#viewport-toolbar #live-share-start')).toHaveText('Ekranı paylaş');
  await expect(page.locator('#live-share-popover')).toBeHidden();
  await expect(page.locator('#live-share-link')).toBeHidden();
  await expect(page.locator('#live-share-stop')).toBeHidden();
  await expect(page.locator('#viewport video')).toHaveCount(0);
});
