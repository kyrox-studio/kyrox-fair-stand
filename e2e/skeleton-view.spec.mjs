import { test, expect } from '@playwright/test';
import { disableAutoFurniture, keepWallLock, createStageFromWizard } from './helpers/standSetup.mjs';

// İskelet (kullanıcı kararı 2026-11-16): sahnede yalnız dikme ve profiller, üstlerinde katalog boyu;
// alt özet Üretim Listesi'nin dikme ve profil satırlarıdır. Panel Ölçüleri ile aynı anda açık olmaz.
async function createBackWallStand(page) {
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Sırt Duvar' }).click();
  await page.locator('#stand-size-x').fill('5');
  await page.locator('#stand-size-y').fill('5');
  await disableAutoFurniture(page);
  await createStageFromWizard(page);
  const projectNameInput = page.locator('form input[name="projectName"]');
  await expect(projectNameInput).toBeVisible();
  await projectNameInput.fill('E2E Iskelet');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await keepWallLock(page);
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
}

test('İskelet yalnız dikme ve profilleri boylarıyla gösterir; Panel Ölçüleri ile karşılıklı kapanır', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await createBackWallStand(page);

  const skeleton = page.locator('#toggle-skeleton');
  const panelLabels = page.locator('#toggle-panel-labels');
  const summary = page.locator('#panel-assignment-summary');
  const labels = page.locator('.scene-skeleton-label');

  await expect(skeleton).toBeEnabled();
  await skeleton.click();
  await expect(skeleton).toHaveAttribute('aria-pressed', 'true');
  await expect(summary).toContainText('Dikme 346,5');
  await expect(summary).toContainText('Profil');
  await expect.poll(() => labels.count()).toBeGreaterThan(4);
  const texts = await labels.allTextContents();
  expect(texts).toContain('346,5');
  expect(texts.some((text) => /^(190|140,5|91|41,5)$/.test(text))).toBe(true);
  await expect(page.locator('.scene-skeleton-label.is-upright').first()).toBeAttached();
  await expect(page.locator('.scene-skeleton-label.is-profile').first()).toBeAttached();

  // Panel Ölçüleri açılınca İskelet kapanır, etiketleri kalkar.
  await panelLabels.click();
  await expect(panelLabels).toHaveAttribute('aria-pressed', 'true');
  await expect(skeleton).toHaveAttribute('aria-pressed', 'false');
  await expect(labels).toHaveCount(0);
  await expect(summary).toContainText('Varsayılan Panel');

  // İskelet yeniden açılınca Panel Ölçüleri kapanır; kapatınca özet gizlenir.
  await skeleton.click();
  await expect(panelLabels).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.scene-panel-label')).toHaveCount(0);
  await expect(summary).toContainText('Dikme 346,5');
  await skeleton.click();
  await expect(labels).toHaveCount(0);
  await expect(summary).toBeHidden();
  expect(pageErrors).toEqual([]);
});
