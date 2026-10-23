import { test, expect } from '@playwright/test';
import { installModuleUnlockFixture, unlockModuleForFixture } from './helpers/module-lock-fixture.mjs';

test.beforeEach(async ({ page }) => installModuleUnlockFixture(page));

const WALL_LINE_HEIGHT_CM = 350;

function wallFlatPanelItemKey(widthCm) {
  return `wall_${widthCm}_${WALL_LINE_HEIGHT_CM}`;
}

async function createStand(page, { standName, projectName, xCm = '500', yCm = '500' }) {
  await page.goto('/');

  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: standName }).click();
  await page.locator('#stand-size-x').fill(String(Number(xCm) / 100));
  await page.locator('#stand-size-y').fill(String(Number(yCm) / 100));

  const createStage = page.locator('#create-stage');
  await expect(createStage).toBeEnabled();
  await createStage.click();

  const projectNameInput = page.locator('form input[name="projectName"]');
  await expect(projectNameInput).toBeVisible();
  await projectNameInput.fill(projectName);
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();

  await expect(page.locator('#viewport-empty')).toBeHidden();
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

test('F-010 automatic wall construction reaches persisted runtime state through Chromium', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await createStand(page, {
    standName: 'Sırt Duvar',
    projectName: 'F010 Automatic Wall',
  });

  const project = await saveAndReadProject(page);
  expect(project).not.toBeNull();
  const walls = project.modules.filter((moduleState) => moduleState.type === 'flat-panel');
  const lamps = project.modules.filter((moduleState) => moduleState.type === 'led-floodlight');
  expect(walls.map((moduleState) => moduleState.widthCm)).toEqual([200, 200, 100]);
  expect(walls.every((moduleState) => moduleState.itemKey === wallFlatPanelItemKey(moduleState.widthCm))).toBe(true);
  expect(walls.every((moduleState) => moduleState.placement?.wallId === 'back')).toBe(true);
  expect(walls.every((moduleState) => moduleState.locked === true)).toBe(true);
  expect(lamps).toHaveLength(3);
  expect(lamps.every((moduleState) => moduleState.itemKey === 'led_floodlight')).toBe(true);
  expect(lamps.every((moduleState) => moduleState.placement?.wallId === 'back')).toBe(true);
  expect(lamps.every((moduleState) => moduleState.locked !== true)).toBe(true);
  expect(project.modules).toHaveLength(walls.length + lamps.length);
  expect(pageErrors).toEqual([]);
});

test('F-010 catalog construction persists a module created through the real picker', async ({ page }) => {
  test.setTimeout(60_000);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await createStand(page, {
    standName: 'Sırt Duvar',
    projectName: 'F010 Catalog Module',
  });

  // F-027 eski duvar temizleme kontrolünü "Sahneyi Sıfırla" yaptı. Bu inşa
  // testi kapasiteyi mevcut modül-silme yoluyla açar; kaldırılmış hepsini-temizle
  // davranışına bağlanmaz.
  const initialProject = await saveAndReadProject(page);
  expect(initialProject).not.toBeNull();
  expect(initialProject.modules.length).toBeGreaterThan(0);
  const removedModule = initialProject.modules[0];
  expect(removedModule.itemKey).toBe(wallFlatPanelItemKey(removedModule.widthCm));

  for (const moduleState of initialProject.modules) await unlockModuleForFixture(page, moduleState);
  page.once('dialog', async (dialog) => dialog.accept());
  await page.evaluate((moduleId) => {
    window.dispatchEvent(new CustomEvent('fair-stand:delete-selected-module', {
      detail: { moduleId },
    }));
  }, removedModule.id);

  const openCatalogButton = page.locator('#open-module-catalog');
  const modulePanel = page.locator('details', { has: openCatalogButton });
  await expect(modulePanel).toHaveCount(1);
  await modulePanel.locator(':scope > summary').click();

  await expect(openCatalogButton).toBeVisible();
  await expect(openCatalogButton).toBeEnabled();
  await openCatalogButton.click();

  const picker = page.locator('.module-picker-backdrop');
  await expect(picker).toBeVisible();
  await picker.locator('summary', { hasText: 'Panel & Duvar' }).click();

  const replacementCard = picker.locator(`[data-module-key="${removedModule.itemKey}"]`);
  await expect(replacementCard).toBeVisible();
  await replacementCard.click();

  const addButton = picker.locator('.module-picker-add');
  await expect(addButton).toBeEnabled();
  await addButton.click();
  await expect(picker).toBeHidden();

  const project = await saveAndReadProject(page);
  expect(project).not.toBeNull();
  expect(project.modules).toHaveLength(initialProject.modules.length);
  expect(project.modules.some((moduleState) => moduleState.id === removedModule.id)).toBe(false);
  const replacement = project.modules.find(
    (moduleState) => moduleState.itemKey === removedModule.itemKey
      && moduleState.id !== removedModule.id,
  );
  expect(replacement).toBeTruthy();
  expect(replacement.type).toBe('flat-panel');
  expect(replacement.widthCm).toBe(removedModule.widthCm);
  expect(pageErrors).toEqual([]);
});


test('F-010 door catalog construction persists canonical door_leaf_100 child state', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await createStand(page, { standName: 'Sırt Duvar', projectName: 'F010 Door Leaf Item' });
  const initialProject = await saveAndReadProject(page);
  expect(initialProject).not.toBeNull();
  expect(initialProject.modules.length).toBeGreaterThan(0);
  const removable = initialProject.modules.slice(0, 2);
  for (const moduleState of initialProject.modules) await unlockModuleForFixture(page, moduleState);
  for (const moduleState of removable) {
    page.once('dialog', async (dialog) => dialog.accept());
    await page.evaluate((moduleId) => {
      window.dispatchEvent(new CustomEvent('fair-stand:delete-selected-module', { detail: { moduleId } }));
    }, moduleState.id);
  }
  const openCatalogButton = page.locator('#open-module-catalog');
  const modulePanel = page.locator('details', { has: openCatalogButton });
  await modulePanel.locator(':scope > summary').click();
  await openCatalogButton.click();
  const picker = page.locator('.module-picker-backdrop');
  await expect(picker).toBeVisible();
  await picker.locator('summary', { hasText: 'Panel & Duvar' }).click();
  const doorCard = picker.locator('[data-module-key="wall_door_100_350"]');
  await expect(doorCard).toBeVisible();
  await doorCard.click();
  await picker.locator('.module-picker-add').click();
  await expect(picker).toBeHidden();
  const project = await saveAndReadProject(page);
  const door = project.modules.find((moduleState) => moduleState.itemKey === 'wall_door_100_350');
  expect(door).toBeTruthy();
  expect(door.itemKey).toBe('wall_door_100_350');
  expect(door.itemKey).toBe('wall_door_100_350');
  expect(door.type).toBe('door');
  expect(door.widthCm).toBe(100);
  expect(door.surface.itemKey).toBe('door_leaf_100');
  expect(door.surface.color).toBe('#ffffff');
  expect(door.surface.imageAssetId).toBeNull();
  expect(door.surface.imageTransform.mode).toBe('single');
  expect(pageErrors).toEqual([]);
});
