import { test, expect } from '@playwright/test';
import { installModuleUnlockFixture, unlockModuleForFixture } from './helpers/module-lock-fixture.mjs';

test.beforeEach(async ({ page }) => installModuleUnlockFixture(page));

async function createBackWallStand(page, projectName) {
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Sırt Duvar' }).click();
  await page.locator('#stand-size-x').fill('5');
  await page.locator('#stand-size-y').fill('5');
  await page.locator('#create-stage').click();
  const projectNameInput = page.locator('form input[name="projectName"]');
  await expect(projectNameInput).toBeVisible();
  await projectNameInput.fill(projectName);
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
}

async function saveAndReadProject(page) {
  const saveButton = page.locator('#save-project');
  await saveButton.click();
  await expect(saveButton).toBeEnabled();
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('fair-stand-configurator', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const projects = await new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readonly');
      const request = tx.objectStore('projects').getAll();
      request.onsuccess = () => resolve(request.result ?? []);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return projects.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0] ?? null;
  });
}

function topStrip(module) {
  return module.strips.find((strip) => strip.stripIndex === module.strips.length - 1);
}

test('one metal group with a gap on the wall is listed as separate sheets', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('dialog', (dialog) => dialog.accept());
  await createBackWallStand(page, 'metal-bosluk');

  // Otomatik sırt duvarı: 200 + 200 + 100 cm panel modülü yan yana.
  const initial = await saveAndReadProject(page);
  const walls = initial.modules.filter((module) => Array.isArray(module.strips));
  expect(walls.map((module) => module.placement.xCm)).toEqual([0, 200, 400]);

  // Sabit ilk kamera açısında ilk ve son modülün en üst paneli; Ctrl ile üçünü kapsayan tek grup.
  await page.mouse.click(650, 145);
  await page.keyboard.down('Control');
  await page.mouse.click(905, 205);
  await page.keyboard.up('Control');
  const menu = page.getByRole('menu', { name: 'Modül işlemleri' });
  await page.mouse.click(905, 205, { button: 'right' });
  await expect(menu).toBeVisible();
  // Panel dönüşümleri sade menüde "Gelişmiş" altında; kapalıysa aç.
  await menu.locator('[data-module-action="toggle-metal-separator"]').click();

  await unlockModuleForFixture(page, walls[1]);

  // Ortadaki modül silinir; kalan iki panel aynı grupta ama arada 200 cm boşluk var.
  await page.evaluate((moduleId) => {
    window.dispatchEvent(new CustomEvent('fair-stand:delete-selected-module', {
      detail: { moduleId },
    }));
  }, walls[1].id);

  const project = await saveAndReadProject(page);
  const remaining = project.modules.filter((module) => Array.isArray(module.strips));
  expect(remaining.map((module) => module.placement.xCm)).toEqual([0, 400]);
  const [left, right] = remaining.map(topStrip);
  expect(left.isMetalSeparator).toBe(true);
  expect(right.isMetalSeparator).toBe(true);
  expect(left.metalSeparatorGroupId).toMatch(/^metal-/);
  expect(right.metalSeparatorGroupId).toBe(left.metalSeparatorGroupId);

  await page.locator('#toggle-production-bom').click();
  const totals = page.locator('#production-bom-panel [data-bom-collapse-key="__totals__"]');
  await totals.locator('summary').click();
  // Düzeltme öncesi: tek satır "1 x Metal Separatör 295 × 47 cm".
  const sheetRows = totals.locator('li', { hasText: /Metal Separatör .* cm - metre_kare/ });
  await expect(sheetRows).toHaveText([
    '1 x Metal Separatör 197 × 47 cm - metre_kare',
    '1 x Metal Separatör 98 × 47 cm - metre_kare',
  ]);
  await expect(totals.locator('li', { hasText: '1,39 × Metal Separatör · metre_kare' })).toHaveCount(1);
  expect(errors).toEqual([]);
});
