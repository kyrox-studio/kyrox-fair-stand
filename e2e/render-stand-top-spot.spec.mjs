import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { disableAutoFurniture, keepWallLock } from './helpers/standSetup.mjs';

test('Sahne Işığı önizlemesi açılıp kapanır; Render Al tepe spotuyla PNG üretir ve önizleme durumunu korur', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');

  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'U Stand' }).click();
  await page.locator('#stand-size-x').fill('6');
  await page.locator('#stand-size-y').fill('4');
  await disableAutoFurniture(page);
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill('Render Tepe Spotu');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await keepWallLock(page);
  await expect(page.locator('#viewport-empty')).toBeHidden();

  // Sahne Işığı varsayılan açık gelir; kapatılıp yeniden açılır, Render Al önizleme açıkken alınır.
  const stageLightButton = page.locator('#toggle-stage-light');
  await expect(stageLightButton).toHaveAttribute('aria-pressed', 'true');
  await stageLightButton.click();
  await expect(stageLightButton).toHaveAttribute('aria-pressed', 'false');
  await stageLightButton.click();
  await expect(stageLightButton).toHaveAttribute('aria-pressed', 'true');

  const renderButton = page.locator('#render-current-view');
  const downloadPromise = page.waitForEvent('download');
  await renderButton.click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/-render\.png$/);
  const png = await readFile(await download.path());
  expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

  // Render bitince buton geri gelir; ışıklar finally içinde editör değerlerine döner.
  await expect(renderButton).toBeEnabled();
  await expect(renderButton).toHaveText('Render Al');
  await expect(stageLightButton).toHaveAttribute('aria-pressed', 'true');
  await stageLightButton.click();
  await expect(stageLightButton).toHaveAttribute('aria-pressed', 'false');
  await page.locator('.view-cube-home').click();

  // Oturumluk: kapatılsa da yeniden yüklemede varsayılan açık gelir.
  await page.reload();
  await expect(page.locator('#toggle-stage-light')).toHaveAttribute('aria-pressed', 'true');

  expect(pageErrors).toEqual([]);
});
