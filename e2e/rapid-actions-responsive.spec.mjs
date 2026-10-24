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
  const modulePanel = page.locator('details.panel-card', { has: openCatalogButton }).first();
  if (!(await modulePanel.evaluate((el) => el.open))) {
    await modulePanel.locator(':scope > summary').click();
  }
  const card = page.locator(`.module-drag-card[data-module-key="${itemKey}"]`);
  const group = page.locator('.module-drag-group', { has: card });
  if (!(await group.evaluate((el) => el.open))) {
    await group.locator(':scope > summary').click();
  }
  await card.scrollIntoViewIfNeeded();
  await expect(card).toBeVisible();
  return card;
}

async function dragToViewport(page, itemKey, xRatio, yRatio) {
  const card = await openCatalogCard(page, itemKey);
  const viewport = page.locator('#viewport');
  const box = await viewport.boundingBox();
  await card.dragTo(viewport, {
    targetPosition: {
      x: Math.round(box.width * xRatio),
      y: Math.round(box.height * yRatio),
    },
  });
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

test('art arda ekle / sil / ekle state’i bozmaz', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await createIslandStand(page, 'E2E Rapid Add Delete');

  await dragToViewport(page, 'mini_fridge_avanti', 0.52, 0.82);
  await dragToViewport(page, 'coat_rack', 0.52, 0.82);

  let project = await saveAndReadProject(page);
  const fridge = project.modules.find((moduleState) => moduleState.itemKey === 'mini_fridge_avanti');
  const rack = project.modules.find((moduleState) => moduleState.itemKey === 'coat_rack');
  expect(fridge).toBeTruthy();
  expect(rack).toBeTruthy();

  page.once('dialog', async (dialog) => dialog.accept());
  await page.evaluate((moduleId) => {
    window.dispatchEvent(new CustomEvent('fair-stand:delete-selected-module', {
      detail: { moduleId },
    }));
  }, fridge.id);

  project = await saveAndReadProject(page);
  expect(project.modules.some((moduleState) => moduleState.id === fridge.id)).toBe(false);
  expect(project.modules.some((moduleState) => moduleState.id === rack.id)).toBe(true);

  await dragToViewport(page, 'mini_fridge_avanti', 0.44, 0.80);
  project = await saveAndReadProject(page);
  expect(project.modules.filter((moduleState) => moduleState.itemKey === 'mini_fridge_avanti')).toHaveLength(1);
  expect(project.modules.some((moduleState) => moduleState.id === rack.id)).toBe(true);
  await expect(page.locator('#viewport > canvas')).toHaveCount(1);
  expect(pageErrors).toEqual([]);
});

test('Sahneyi Sıfırla sonrası yeni item eklenebilir', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await createIslandStand(page, 'E2E Reset Then Add');
  await dragToViewport(page, 'kettle', 0.52, 0.82);

  await page.locator('#clear-wall').click();
  await expect(page.locator('#stage-result')).toContainText('Ada Stand · 500 × 500 cm');

  await dragToViewport(page, 'mini_fridge_avanti', 0.52, 0.82);
  const project = await saveAndReadProject(page);
  expect(project.modules.some((moduleState) => moduleState.itemKey === 'mini_fridge_avanti')).toBe(true);
  expect(project.modules.some((moduleState) => moduleState.itemKey === 'kettle')).toBe(false);
  expect(pageErrors).toEqual([]);
});

test('dar viewport smoke: boot, katalog ve sahne erişilebilir', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 900, height: 700 });
  await createIslandStand(page, 'E2E Narrow Viewport');

  await expect(page.getByRole('heading', { name: 'Maxima Konfigüratörü' })).toBeVisible();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  await expect(page.locator('#viewport > canvas')).toBeVisible();
  await expect(page.locator('#clear-wall')).toBeEnabled();
  await expect(page.locator('#save-project')).toBeEnabled();
  expect(pageErrors).toEqual([]);
});
