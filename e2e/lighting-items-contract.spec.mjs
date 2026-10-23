import { test, expect } from '@playwright/test';

async function createIslandStand(page, projectName) {
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
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

test('led_floodlight catalog drag creates a canonical top-light Item', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await createIslandStand(page, 'led_floodlight');

  const button = page.locator('#open-module-catalog');
  await page.locator('details', { has: button }).locator(':scope > summary').click();
  const card = page.locator('.module-drag-card[data-module-key="led_floodlight"]');
  await page.locator('.module-drag-group', { has: card }).locator(':scope > summary').click();
  await expect(card).toBeVisible();
  await expect(page.locator('.module-drag-card[data-module-key="illuminated-foam"]')).toHaveCount(0);
  await expect(page.locator('.module-drag-card[data-module-key="LED_FLOODLIGHT"]')).toHaveCount(0);

  const viewport = page.locator('#viewport');
  const box = await viewport.boundingBox();
  await card.dragTo(viewport, {
    targetPosition: { x: Math.round(box.width * 0.52), y: Math.round(box.height * 0.82) },
  });

  const project = await saveAndReadProject(page);
  const item = project.modules.find((module) => module.itemKey === 'led_floodlight');
  expect(item).toBeTruthy();
  expect(item.itemKey).toBe('led_floodlight');
  expect(item.type).toBe('led-floodlight');
  expect(item.widthCm).toBe(50);
  expect(item.depthCm).toBe(20);
  expect(item.heightCm).toBe(35);
  expect(item.placement).toBeTruthy();
  expect(errors).toEqual([]);
});
