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

const expected = {
  extra_indoor_plant_1: {
    modelFile: 'indoor_plants.glb',
    hasSurface: false,
    widthCm: 60,
  },
  extra_long_planter_100: {
    modelFile: 'saksi_bitkili_100x30x30.glb',
    hasSurface: true,
    widthCm: 100,
  },
  extra_long_planter_150: {
    modelFile: 'saksi_bitkili_150x30x30.glb',
    hasSurface: true,
    widthCm: 150,
  },
  extra_long_planter_200: {
    modelFile: 'saksi_bitkili_200x30x30.glb',
    hasSurface: true,
    widthCm: 200,
  },
};

for (const itemKey of Object.keys(expected)) {
  test(`${itemKey} katalog drag canonical indoor-plant Item üretir`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await createIslandStand(page, itemKey);

    const button = page.locator('.module-drag-catalog');
    await page.locator('details', { has: button }).locator(':scope > summary').click();
    // Uzun Saksı tek kart (0086): 150 / 200 Özellikler panelinde seçilir.
    const card = page.locator(`.module-drag-card[data-module-key="${catalogCardKeyFor(itemKey)}"]`);
    await page.locator('.module-drag-group', { has: card }).locator(':scope > summary').click();
    await expect(card).toBeVisible();

    const viewport = page.locator('#viewport');
    const box = await viewport.boundingBox();
    await card.dragTo(viewport, {
      targetPosition: { x: Math.round(box.width * 0.52), y: Math.round(box.height * 0.72) },
    });
    if (catalogCardKeyFor(itemKey) !== itemKey) await chooseCatalogWidth(page, itemKey);

    const project = await saveAndReadProject(page);
    const item = project.modules.find((module) => module.itemKey === itemKey);
    expect(item).toBeTruthy();
    expect(item.itemKey).toBe(itemKey);
    expect(item.type).toBe('indoor-plant-1');
    expect(item.widthCm).toBe(expected[itemKey].widthCm);
    expect(item.modelFile).toBe(expected[itemKey].modelFile);
    if (expected[itemKey].hasSurface) {
      expect(item.surface?.color).toBeTruthy();
    } else {
      expect(item.surface).toBeUndefined();
    }
    expect(errors).toEqual([]);
  });
}
