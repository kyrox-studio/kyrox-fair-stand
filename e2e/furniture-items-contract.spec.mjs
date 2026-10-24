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

const expected = {
  furniture_sofa_set_classic: {
    type: 'sofa-set-classic',
    widthCm: 150,
    depthCm: 150,
    heightCm: 78,
  },
  furniture_sofa_single_classic: {
    type: 'sofa-single-classic',
    widthCm: 65,
    depthCm: 45,
    heightCm: 78,
  },
  furniture_sofa_double_classic: {
    type: 'sofa-double-classic',
    widthCm: 150,
    depthCm: 45,
    heightCm: 78,
  },
  furniture_coffee_table_classic: {
    type: 'coffee-table-classic',
    widthCm: 60,
    depthCm: 42,
    heightCm: 38,
    hasSurface: false,
  },
  furniture_table_chair_set_eames: {
    type: 'table-chair-set-eames',
    widthCm: 150,
    depthCm: 150,
    heightCm: 82,
    chairCount: 4,
  },
  chair_eames: {
    type: 'chair',
    widthCm: 46,
    depthCm: 58,
    heightCm: 82,
  },
  glass_table: {
    type: 'table-glass',
    widthCm: 75,
    depthCm: 75,
    heightCm: 74,
    hasSurface: false,
  },
  furniture_bar_stool_classic: {
    type: 'bar-stool',
    widthCm: 60,
    depthCm: 55,
    heightCm: 121,
  },
};

for (const itemKey of Object.keys(expected)) {
  test(`${itemKey} katalog drag canonical furniture Item üretir`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await createIslandStand(page, itemKey);

    const button = page.locator('.module-drag-catalog');
    await page.locator('details', { has: button }).locator(':scope > summary').click();
    const card = page.locator(`.module-drag-card[data-module-key="${itemKey}"]`);
    await page.locator('.module-drag-group', { has: card }).locator(':scope > summary').click();
    await expect(card).toBeVisible();

    const viewport = page.locator('#viewport');
    const box = await viewport.boundingBox();
    await card.dragTo(viewport, {
      targetPosition: { x: Math.round(box.width * 0.52), y: Math.round(box.height * 0.72) },
    });

    const project = await saveAndReadProject(page);
    const item = project.modules.find((module) => module.itemKey === itemKey);
    expect(item).toBeTruthy();
    expect(item.itemKey).toBe(itemKey);
    expect(item.type).toBe(expected[itemKey].type);
    expect(item.widthCm).toBe(expected[itemKey].widthCm);
    expect(item.depthCm).toBe(expected[itemKey].depthCm);
    expect(item.heightCm).toBe(expected[itemKey].heightCm);
    if (expected[itemKey].chairCount != null) {
      expect(item.chairCount).toBe(expected[itemKey].chairCount);
    }
    if (expected[itemKey].hasSurface === false) {
      expect(item.surface).toBeFalsy();
    } else {
      expect(item.surface?.color).toBeTruthy();
    }
    expect(errors).toEqual([]);
  });
}
