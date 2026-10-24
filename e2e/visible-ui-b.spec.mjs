import { test, expect } from '@playwright/test';
import { DEFAULT_SELECTION_HINT } from '../src/selectionFeedback.js';

test('seçim hint, standart listesi ve üretim listesi varsayılan girişte kapalı', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#selection-info')).toHaveText(DEFAULT_SELECTION_HINT);
  await expect(page.locator('#raw-bom-debug')).toHaveCount(0);
  // Liste kullanıcı açana kadar kapalıdır; üst bant sahne kurulana kadar gizlidir.
  await expect(page.locator('#production-bom-panel')).toBeHidden();
  await expect(page.locator('#toggle-production-bom')).toBeHidden();

  await page.locator('#editor-mode-advanced').click();
  const standardsPanel = page.locator('details').filter({ hasText: 'Standartlar' }).first();
  await standardsPanel.locator('summary').click();
  await expect(page.locator('#stand-standards-list li').first()).toContainText('Yükseklik:');
  await expect(page.locator('#stand-standards-list li')).toHaveCount(9);
});

test('üst banttaki Üretim Listesi butonu paneli açar', async ({ page }) => {
  await page.goto('/');

  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Sırt Duvar' }).click();
  await page.locator('#stand-size-x').fill('5');
  await page.locator('#stand-size-y').fill('5');
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill('BOM toolbar');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  await expect(page.locator('#design-details')).toHaveCount(0);
  await expect(page.locator('#viewport-toolbar #toggle-production-bom')).toBeVisible();
  await expect(page.locator('#toggle-production-bom')).toBeEnabled();
  await expect(page.locator('#production-bom-panel')).toBeHidden();

  await page.locator('#toggle-production-bom').click();
  await expect(page.locator('#production-bom-panel')).toBeVisible();
  await expect(page.locator('#production-bom-panel .production-bom-panel__title')).toHaveText('Üretim Listesi');
  await expect(page.locator('#production-bom-panel [data-role="bom-download"]')).toHaveText('Metin indir');
  await page.locator('#editor-mode-advanced').click();
  await expect(page.locator('#production-bom-panel')).toBeVisible();
  await expect(page.locator('#toggle-production-bom')).toHaveAttribute('aria-pressed', 'true');
});

test('üretim listesi paneli gerçek girişte düz duvar reçete satırlarını çizer', async ({ page }) => {
  await page.goto('/');

  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Sırt Duvar' }).click();
  await page.locator('#stand-size-x').fill('5');
  await page.locator('#stand-size-y').fill('5');
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill('BOM satır');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();

  await page.locator('#toggle-production-bom').click();
  await expect(page.locator('#production-bom-panel')).toBeVisible();

  const modulesGroup = page.locator('#production-bom-panel .production-bom-modules');
  await modulesGroup.locator('> summary').click();
  const firstModule = page.locator('#production-bom-panel .production-bom-module').first();
  await expect(firstModule).toContainText('Modül');
  await firstModule.locator('summary').click();

  const firstLine = firstModule.locator('.production-bom-module__list li').first();
  await expect(firstLine).toBeVisible();
  await expect(firstLine).toContainText('×');
  // Modülün Item kodu ekranda yazmaz; başlığın ipucunda kalır.
  await expect(firstModule.locator('summary')).toHaveAttribute('data-item-key', /^wall_/);
  await expect(firstModule.locator('.production-bom-module__list li').first()).not.toContainText('wall_');
});
