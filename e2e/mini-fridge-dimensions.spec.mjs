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

function isTenCmGridAligned(value) {
  const units = Number(value) / 10;
  return Number.isFinite(units) && Math.abs(units - Math.round(units)) < 1e-9;
}

test('mini fridge uses the 50x50x66 nominal footprint in the real catalog drag flow', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await createIslandStand(page, 'Mini Fridge 50x50');

  const openCatalogButton = page.locator('.module-drag-catalog');
  const modulePanel = page.locator('details', { has: openCatalogButton });
  await modulePanel.locator(':scope > summary').click();

  const fridgeCard = page.locator('.module-drag-card[data-module-key="mini_fridge_avanti"]');
  const fridgeGroup = page.locator('.module-drag-group', { has: fridgeCard });
  if (!(await fridgeGroup.getAttribute('open'))) {
    await fridgeGroup.locator(':scope > summary').click();
  }

  await expect(fridgeCard).toBeVisible();
  await expect(fridgeCard).toHaveAttribute('aria-disabled', 'false');

  const viewport = page.locator('#viewport');
  await expect(viewport).toBeVisible();
  const viewportBox = await viewport.boundingBox();
  expect(viewportBox).not.toBeNull();
  await fridgeCard.dragTo(viewport, {
    targetPosition: {
      x: Math.round(viewportBox.width * 0.52),
      y: Math.round(viewportBox.height * 0.82),
    },
  });

  const project = await saveAndReadProject(page);
  expect(project).not.toBeNull();
  const fridge = project.modules.find((moduleState) => moduleState.type === 'mini-fridge');
  expect(fridge).toBeTruthy();
  expect([fridge.widthCm, fridge.depthCm, fridge.heightCm]).toEqual([50, 50, 66]);
  expect(fridge.placement.wallId).toBe('free');
  expect(Number(fridge.placement.rotationZDeg)).toBe(0);

  // Serbest yerleşimde xCm genişlik kenarı kökeni, yCm varsayılan 0° yönünde
  // oturum orta çizgisidir. 50x50 oturum kenarlarını 10 cm ızgaraya göre doğrula;
  // merkez koordinatının kendisini değil.
  const xMin = Number(fridge.placement.xCm);
  const xMax = xMin + Number(fridge.widthCm);
  const yCenter = Number(fridge.placement.yCm);
  const yMin = yCenter - Number(fridge.depthCm) / 2;
  const yMax = yCenter + Number(fridge.depthCm) / 2;
  expect(isTenCmGridAligned(xMin)).toBe(true);
  expect(isTenCmGridAligned(xMax)).toBe(true);
  expect(isTenCmGridAligned(yMin)).toBe(true);
  expect(isTenCmGridAligned(yMax)).toBe(true);
  expect(pageErrors).toEqual([]);
});
