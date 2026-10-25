import { test, expect } from '@playwright/test';
import { disableAutoFurniture, keepWallLock } from './helpers/standSetup.mjs';

async function createIslandStand(page, projectName, { depotContents = false } = {}) {
  await page.goto('/');

  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('5');
  await page.locator('#stand-size-y').fill('5');

  if (depotContents) {
    await page.locator('#auto-depot-size').selectOption('100x100');
    await page.locator('#auto-depot-contents').check();
  }

  await disableAutoFurniture(page);
  await page.locator('#create-stage').click();
  const projectNameInput = page.locator('form input[name="projectName"]');
  await expect(projectNameInput).toBeVisible();
  await projectNameInput.fill(projectName);
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await keepWallLock(page);
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


const keys = ['coat_rack', 'kettle', 'mini_fridge_avanti', 'plastic_trash_bin'];
for (const itemKey of keys) {
  test(`${itemKey} catalog drag creates a canonical Item`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await createIslandStand(page, itemKey);
    const button = page.locator('.module-drag-catalog');
    await page.locator('details', { has: button }).locator(':scope > summary').click();
    const card = page.locator(`.module-drag-card[data-module-key="${itemKey}"]`);
    await page.locator('.module-drag-group', { has: card }).locator(':scope > summary').click();
    await expect(card).toBeVisible();
    await expect(page.locator(`[data-module-key="DEPOT_${itemKey}"]`)).toHaveCount(0);
    const viewport = page.locator('#viewport');
    const box = await viewport.boundingBox();
    await card.dragTo(viewport, { targetPosition: { x: Math.round(box.width * 0.52), y: Math.round(box.height * 0.82) } });
    const project = await saveAndReadProject(page);
    const item = project.modules.find((module) => module.itemKey === itemKey);
    expect(item).toBeTruthy();
    expect(item.itemKey).toBe(itemKey);
    expect(item.id).toBeTruthy();
    expect(item.placement.wallId).toBe('free');
    expect(errors).toEqual([]);
  });
}

test('automatic depot saves and reopens all four canonical Items', async ({ page }) => {
  await createIslandStand(page, 'Commercial Item persistence', { depotContents: true });
  const before = await saveAndReadProject(page);
  const items = before.modules.filter((module) => keys.includes(module.itemKey));
  expect(items.map((item) => item.itemKey).sort()).toEqual([...keys].sort());
  await page.reload();
  const projectSelect = page.locator('#project-select');
  await expect(projectSelect.locator(`option[value="${before.id}"]`)).toHaveCount(1);
  await projectSelect.evaluate((select, id) => {
    select.value = id;
  }, before.id);
  await page.locator('#open-project').click();
  await expect(page.locator('#project-status')).toContainText('Açıldı:');
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  const after = await saveAndReadProject(page);
  expect(after.modules.filter((module) => keys.includes(module.itemKey))).toEqual(items);
});
