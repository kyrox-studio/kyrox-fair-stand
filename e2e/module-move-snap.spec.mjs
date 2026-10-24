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

async function openCatalogCard(page, itemKey) {
  const openCatalogButton = page.locator('.module-drag-catalog');
  const modulePanel = page.locator('details', { has: openCatalogButton });
  await modulePanel.locator(':scope > summary').click();
  const card = page.locator(`.module-drag-card[data-module-key="${itemKey}"]`);
  const group = page.locator('.module-drag-group', { has: card });
  if (!(await group.evaluate((el) => el.open))) {
    await group.locator(':scope > summary').click();
  }
  await card.scrollIntoViewIfNeeded();
  await expect(card).toBeVisible();
  return card;
}

async function saveAndReadProject(page) {
  const saveButton = page.locator('#save-project');
  await saveButton.click();
  await expect(page.locator('#project-status')).toContainText('Kaydedildi:');
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

async function dragPlacedModuleOnCanvas(page, from, to) {
  const viewport = page.locator('#viewport');
  await expect(viewport).toBeVisible();
  const box = await viewport.boundingBox();
  expect(box).not.toBeNull();
  const start = {
    x: box.x + Math.round(box.width * from.x),
    y: box.y + Math.round(box.height * from.y),
  };
  const end = {
    x: box.x + Math.round(box.width * to.x),
    y: box.y + Math.round(box.height * to.y),
  };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 16 });
  await page.mouse.up();
}

test('yerleşik free prop canvas sürüklemede taşınır ve 10 cm grid’e oturur', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await createIslandStand(page, 'E2E Module Move');

  const card = await openCatalogCard(page, 'mini_fridge_avanti');
  const viewport = page.locator('#viewport');
  const box = await viewport.boundingBox();
  expect(box).not.toBeNull();
  const start = {
    x: Math.round(box.width * 0.52),
    y: Math.round(box.height * 0.82),
  };
  await card.dragTo(viewport, { targetPosition: start });

  const before = await saveAndReadProject(page);
  const fridgeBefore = before.modules.find((moduleState) => moduleState.itemKey === 'mini_fridge_avanti');
  expect(fridgeBefore).toBeTruthy();
  expect(fridgeBefore.placement.wallId).toBe('free');

  await dragPlacedModuleOnCanvas(page, { x: 0.52, y: 0.82 }, { x: 0.72, y: 0.82 });

  const after = await saveAndReadProject(page);
  const fridgeAfter = after.modules.find((moduleState) => moduleState.id === fridgeBefore.id);
  expect(fridgeAfter).toBeTruthy();
  expect(fridgeAfter.placement.wallId).toBe('free');
  expect(fridgeAfter.placement.xCm).not.toBe(fridgeBefore.placement.xCm);
  const widthCm = Number(fridgeAfter.widthCm);
  const depthCm = Number(fridgeAfter.depthCm);
  const xMinCm = Number(fridgeAfter.placement.xCm);
  const yCenterCm = Number(fridgeAfter.placement.yCm);
  for (const edgeCm of [xMinCm, xMinCm + widthCm, yCenterCm - depthCm / 2, yCenterCm + depthCm / 2]) {
    expect(edgeCm % 10).toBe(0);
  }
  expect(pageErrors).toEqual([]);
});
