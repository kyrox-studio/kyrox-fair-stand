import { test, expect } from '@playwright/test';
import { installModuleUnlockFixture, unlockModuleForFixture } from './helpers/module-lock-fixture.mjs';

test.beforeEach(async ({ page }) => installModuleUnlockFixture(page));

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

async function removeModules(page, modules) {
  for (const moduleState of modules) {
    await unlockModuleForFixture(page, moduleState);
    page.once('dialog', async (dialog) => dialog.accept());
    await page.evaluate((moduleId) => {
      window.dispatchEvent(new CustomEvent('fair-stand:delete-selected-module', {
        detail: { moduleId },
      }));
    }, moduleState.id);
  }
}

const expected = {
  wall_separator_50_350: { modelFile: null },
  wall_separator_100_350: { modelFile: null },
  wall_separator_50_350_sarmasik: { modelFile: 'wall_separator_50_sarmasik.glb' },
  wall_separator_100_350_sarmasik: { modelFile: 'wall_separator_100_sarmasik.glb' },
};

for (const itemKey of Object.keys(expected)) {
  test(`${itemKey} katalog ekleme canonical separator Item üretir`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await createBackWallStand(page, itemKey);

    const initialProject = await saveAndReadProject(page);
    expect(initialProject).not.toBeNull();
    expect(initialProject.modules.length).toBeGreaterThan(0);
    await removeModules(page, initialProject.modules);

    const openCatalogButton = page.locator('#open-module-catalog');
    const modulePanel = page.locator('details', { has: openCatalogButton });
    await modulePanel.locator(':scope > summary').click();
    await openCatalogButton.click();

    const picker = page.locator('.module-picker-backdrop');
    await expect(picker).toBeVisible();
    await picker.locator('summary', { hasText: 'Panel & Duvar' }).click();
    await picker.locator(`[data-module-key="${itemKey}"]`).click();
    await picker.locator('.module-picker-add').click();
    await expect(picker).toBeHidden();

    const project = await saveAndReadProject(page);
    const item = project.modules.find((module) => module.itemKey === itemKey);
    expect(item).toBeTruthy();
    expect(item.itemKey).toBe(itemKey);
    expect(item.type).toBe('separator');
    expect(item.modelFile ?? null).toBe(expected[itemKey].modelFile);
    expect(item.surface?.color).toBeTruthy();
    expect(item.surface?.imageAssetId).toBeUndefined();
    expect(errors).toEqual([]);
  });
}
