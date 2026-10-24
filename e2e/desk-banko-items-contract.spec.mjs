import { test, expect } from '@playwright/test';
import { catalogCardKeyFor, chooseCatalogWidth } from './helpers/catalogWidth.mjs';

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

const keys = [
  'desk_banko_100',
  'desk_banko_150',
  'desk_banko_200',
  'desk_banko_100_l',
  'desk_banko_150_l',
  'desk_banko_200_l',
];

for (const itemKey of keys) {
  test(`${itemKey} catalog drag creates a canonical counter Item with faces`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await createIslandStand(page, itemKey);

    const button = page.locator('#open-module-catalog');
    await page.locator('details', { has: button }).locator(':scope > summary').click();
    // Ölçü ailesi: tek kart sürüklenir, ölçü pencereden seçilir (0083).
    const card = page.locator(`.module-drag-card[data-module-key="${catalogCardKeyFor(itemKey)}"]`);
    await page.locator('.module-drag-group', { has: card }).locator(':scope > summary').click();
    await expect(card).toBeVisible();

    const viewport = page.locator('#viewport');
    const box = await viewport.boundingBox();
    await card.dragTo(viewport, {
      targetPosition: { x: Math.round(box.width * 0.52), y: Math.round(box.height * 0.82) },
    });
    await chooseCatalogWidth(page, itemKey);

    const project = await saveAndReadProject(page);
    const item = project.modules.find((module) => module.itemKey === itemKey);
    expect(item).toBeTruthy();
    expect(item.itemKey).toBe(itemKey);
    expect(item.type).toBe('counter');
    expect(item.id).toBeTruthy();
    expect(item.faces?.frontLower).toBeTruthy();
    expect(item.faces?.frontUpper).toBeTruthy();
    expect(item.faces.frontLower.color).toBeTruthy();
    expect(item.placement?.wallId).toBe('free');
    if (itemKey.endsWith('_l')) {
      expect(item.shape).toBe('L');
      expect(item.faces?.returnLower).toBeTruthy();
    } else {
      expect(item.shape).toBe('straight');
    }
    expect(errors).toEqual([]);
  });
}
