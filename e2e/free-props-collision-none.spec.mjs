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

async function dragCatalogCard(page, moduleKey, targetPosition) {
  const button = page.locator('.module-drag-catalog');
  const modulePanel = page.locator('details', { has: button });
  await modulePanel.evaluate((el) => { el.open = true; });

  const card = page.locator(`.module-drag-card[data-module-key="${moduleKey}"]`);
  const group = page.locator('.module-drag-group', { has: card });
  await group.evaluate((el) => { el.open = true; });
  await card.scrollIntoViewIfNeeded();
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('aria-disabled', 'false');

  const viewport = page.locator('#viewport');
  await card.dragTo(viewport, { targetPosition });
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

function footprint(moduleState) {
  const width = Number(moduleState.widthCm);
  const depth = Number(moduleState.depthCm);
  const xMin = Number(moduleState.placement.xCm);
  const yCenter = Number(moduleState.placement.yCm);
  return {
    xMin,
    xMax: xMin + width,
    yMin: yCenter - depth / 2,
    yMax: yCenter + depth / 2,
  };
}

function overlaps(a, b) {
  return a.xMin < b.xMax
    && a.xMax > b.xMin
    && a.yMin < b.yMax
    && a.yMax > b.yMin;
}

test('mini-fridge and coat-rack may occupy the same free footprint in Chromium', async ({ page }) => {
  test.setTimeout(60_000);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await createIslandStand(page, 'Prop Collision None');

  const viewport = page.locator('#viewport');
  await expect(viewport).toBeVisible();
  const viewportBox = await viewport.boundingBox();
  expect(viewportBox).not.toBeNull();
  const drop = {
    x: Math.round(viewportBox.width * 0.52),
    y: Math.round(viewportBox.height * 0.82),
  };

  await dragCatalogCard(page, 'mini_fridge_avanti', drop);
  await dragCatalogCard(page, 'coat_rack', drop);

  const project = await saveAndReadProject(page);
  expect(project).not.toBeNull();
  const fridge = project.modules.find((moduleState) => moduleState.type === 'mini-fridge');
  const rack = project.modules.find((moduleState) => moduleState.type === 'coat-rack');
  expect(fridge).toBeTruthy();
  expect(rack).toBeTruthy();
  expect(overlaps(footprint(fridge), footprint(rack))).toBe(true);
  expect(pageErrors).toEqual([]);
});
