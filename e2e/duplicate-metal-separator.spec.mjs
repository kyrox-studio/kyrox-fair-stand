import { test, expect } from '@playwright/test';

async function createBackWallStand(page, projectName) {
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Sırt Duvar' }).click();
  await page.locator('#stand-size-x').fill('500');
  await page.locator('#stand-size-y').fill('500');
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

test('duplicating a panel with a metal separator gives the copy its own metal group', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('dialog', (dialog) => dialog.accept());
  await createBackWallStand(page, 'metal-cogaltma');

  // Otomatik sırt duvarında yalnız ilk modülü bırak; sağ tarafta çoğaltma için yer aç.
  const initialProject = await saveAndReadProject(page);
  for (const moduleState of initialProject.modules.slice(1)) {
    await page.evaluate((moduleId) => {
      window.dispatchEvent(new CustomEvent('fair-stand:delete-selected-module', {
        detail: { moduleId },
      }));
    }, moduleState.id);
  }

  const menu = page.getByRole('menu', { name: 'Modül işlemleri' });
  const metalToggle = menu.locator('[data-module-action="toggle-metal-separator"]');

  // Sabit ilk kamera açısında ilk modülün en üst paneli.
  await page.mouse.click(650, 145, { button: 'right' });
  await expect(menu).toBeVisible();
  // Panel dönüşümleri sade menüde "Gelişmiş" altında; kapalıysa aç.
  const advancedToggle = menu.locator('.module-context-advanced-toggle');
  // Sade menü: dönüşüm kapalı başlar.
  await expect(advancedToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(metalToggle).toBeHidden();
  await advancedToggle.click();
  await expect(metalToggle).toHaveText('Metal Separatöre Çevir');
  await metalToggle.click();

  await page.mouse.click(650, 145, { button: 'right' });
  await menu.locator('[data-module-action="duplicate-right"]').click();

  const duplicated = await saveAndReadProject(page);
  expect(duplicated.modules).toHaveLength(2);
  const [original, copy] = duplicated.modules.map(topStrip);
  expect(original.isMetalSeparator).toBe(true);
  expect(copy.isMetalSeparator).toBe(true);
  expect(original.metalSeparatorGroupId).toMatch(/^metal-/);
  expect(copy.metalSeparatorGroupId).toMatch(/^metal-/);
  expect(copy.metalSeparatorGroupId).not.toBe(original.metalSeparatorGroupId);

  // Kopyada separatörü kapatmak orijinali etkilememeli.
  await page.mouse.click(785, 190, { button: 'right' });
  await expect(menu).toBeVisible();
  // "Gelişmiş" açık kaldı (oturum boyunca hatırlanır).
  await expect(menu.locator('.module-context-advanced-toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(metalToggle).toHaveText('Normal Panele Çevir');
  await metalToggle.click();

  const afterToggle = await saveAndReadProject(page);
  const [originalAfter, copyAfter] = afterToggle.modules.map(topStrip);
  expect(copyAfter.isMetalSeparator).toBe(false);
  expect(originalAfter.isMetalSeparator).toBe(true);
  expect(originalAfter.metalSeparatorGroupId).toBe(original.metalSeparatorGroupId);
  expect(errors).toEqual([]);
});
