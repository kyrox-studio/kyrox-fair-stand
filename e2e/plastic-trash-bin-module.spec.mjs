import { test, expect } from '@playwright/test';

const TRASH_KEY = 'plastic_trash_bin';

async function createIslandStand(page, projectName, { depotContents = false } = {}) {
  await page.goto('/');

  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('500');
  await page.locator('#stand-size-y').fill('500');

  if (depotContents) {
    await page.locator('#auto-depot-size').selectOption('100x100');
    await page.locator('#auto-depot-contents').check();
  }

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

function footprint(moduleState) {
  const xMin = Number(moduleState.placement.xCm);
  const xMax = xMin + Number(moduleState.widthCm);
  const yCenter = Number(moduleState.placement.yCm);
  const halfDepth = Number(moduleState.depthCm) / 2;
  return { xMin, xMax, yMin: yCenter - halfDepth, yMax: yCenter + halfDepth };
}

function overlaps(a, b) {
  return a.xMin < b.xMax
    && a.xMax > b.xMin
    && a.yMin < b.yMax
    && a.yMax > b.yMin;
}

function isTenCmGridAligned(value) {
  const units = Number(value) / 10;
  return Number.isFinite(units) && Math.abs(units - Math.round(units)) < 1e-9;
}

test('trash bin is visible in the catalog, renders its GLB, and persists through the real drag/drop flow', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await createIslandStand(page, 'Trash Bin Drag');
  await page.evaluate(() => {
    window.__plasticTrashBinRendered = [];
    window.addEventListener('fair-stand:model-rendered', (event) => {
      const detail = event.detail ?? {};
      if (detail.type === 'plastic-trash-bin') {
        window.__plasticTrashBinRendered.push(detail);
      }
    });
  });

  const openCatalogButton = page.locator('#open-module-catalog');
  const modulePanel = page.locator('details', { has: openCatalogButton });
  await modulePanel.locator(':scope > summary').click();

  const trashCard = page.locator(`.module-drag-card[data-module-key="${TRASH_KEY}"]`);
  await expect(page.locator('.module-drag-group[open]')).toHaveCount(0);
  const trashGroup = page.locator('.module-drag-group', { has: trashCard });
  if (!(await trashGroup.getAttribute('open'))) {
    await trashGroup.locator(':scope > summary').click();
  }

  await expect(trashCard).toBeVisible();
  await expect(trashCard).toHaveAttribute('aria-disabled', 'false');
  await expect(trashCard.locator('.module-drag-plant')).toHaveCount(0);
  await expect(trashCard.locator('.module-drag-panel')).toHaveCount(0);
  const trashPreview = trashCard.locator('.module-drag-trash-bin');
  await expect(trashPreview).toBeVisible();
  await expect(trashPreview.locator('.module-drag-trash-bin-handle')).toHaveCount(1);
  await expect(trashPreview.locator('.module-drag-trash-bin-lid')).toHaveCount(1);
  await expect(trashPreview.locator('.module-drag-trash-bin-body')).toHaveCount(1);

  const viewport = page.locator('#viewport');
  const viewportBox = await viewport.boundingBox();
  expect(viewportBox).not.toBeNull();
  const targetPosition = {
    x: Math.round(viewportBox.width * 0.57),
    y: Math.round(viewportBox.height * 0.80),
  };
  await trashCard.dragTo(viewport, { targetPosition });

  await expect.poll(
    () => page.evaluate(() => (
      window.__plasticTrashBinRendered?.some((entry) => (
        entry.type === 'plastic-trash-bin'
        && entry.modelFile === 'plastic_trash_bin.glb'
        && Number(entry.moduleIndex) >= 0
        && Array.isArray(entry.removedNodes)
        && entry.removedNodes.includes('Sphere_1')
        && entry.topLabelRole === 'plastic-trash-bin-top-label'
        && Math.abs(Number(entry.topLabelRotationZ) - (Math.PI / 2)) < 1e-9
        && Math.abs(Number(entry.trashVisualRotationY) - (-Math.PI / 2)) < 1e-9
        && entry.topLabelParentRole === 'plastic-trash-bin-visual'
        && entry.modelParentRole === 'plastic-trash-bin-visual'
        && Array.isArray(entry.trashBodyMaterials)
        && entry.trashBodyMaterials.some((body) => (
          body.name === 'Object_5'
          && Array.isArray(body.materials)
          && body.materials.length > 0
          && body.materials.every((material) => material.color === 'ffffff' && material.hasMap === false)
        ))
      )) ?? false
    )),
    { message: 'plastic_trash_bin.glb must finish loading and be added to the real scene module' },
  ).toBe(true);

  const project = await saveAndReadProject(page);
  const trash = project.modules.find((moduleState) => moduleState.itemKey === TRASH_KEY);
  expect(trash).toBeTruthy();
  expect(trash.type).toBe('plastic-trash-bin');
  expect([trash.widthCm, trash.depthCm, trash.heightCm]).toEqual([40, 40, 60]);
  expect(trash.modelFile).toBe('plastic_trash_bin.glb');
  expect(trash.placement.wallId).toBe('free');
  expect(Number(trash.placement.rotationZDeg)).toBe(0);

  const box = footprint(trash);
  expect(isTenCmGridAligned(box.xMin)).toBe(true);
  expect(isTenCmGridAligned(box.xMax)).toBe(true);
  expect(isTenCmGridAligned(box.yMin)).toBe(true);
  expect(isTenCmGridAligned(box.yMax)).toBe(true);
  expect(pageErrors).toEqual([]);
});

test('trash bin is visible and selectable in the existing Add catalog', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await createIslandStand(page, 'Trash Bin Add Catalog');

  const openCatalogButton = page.locator('#open-module-catalog');
  const modulePanel = page.locator('details', { has: openCatalogButton });
  await modulePanel.locator(':scope > summary').click();
  await openCatalogButton.click();

  const picker = page.locator('.module-picker-backdrop');
  await expect(picker).toBeVisible();
  await picker.locator('summary', { hasText: 'Extra' }).click();
  const trashCard = picker.locator(`[data-module-key="${TRASH_KEY}"]`);
  await expect(trashCard).toBeVisible();
  await expect(trashCard).toHaveAttribute('aria-selected', 'false');
  await expect(trashCard.locator('.module-drag-plant')).toHaveCount(0);
  await expect(trashCard.locator('.module-drag-panel')).toHaveCount(0);
  await expect(trashCard.locator('.module-drag-trash-bin')).toBeVisible();

  await trashCard.click();
  await expect(trashCard).toHaveAttribute('aria-selected', 'true');
  await expect(picker.locator('.module-picker-selection-list')).toContainText('Çöp Kutusu');
  await expect(pageErrors).toEqual([]);
});

test('100x100 automatic depot includes trash bin without overlapping floor fixtures', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await createIslandStand(page, 'Trash Bin Auto Depot', { depotContents: true });
  const project = await saveAndReadProject(page);

  const trash = project.modules.find((moduleState) => moduleState.itemKey === TRASH_KEY);
  const fridge = project.modules.find((moduleState) => moduleState.type === 'mini-fridge');
  const rack = project.modules.find((moduleState) => moduleState.type === 'coat-rack');
  expect(trash).toBeTruthy();
  expect(fridge).toBeTruthy();
  expect(rack).toBeTruthy();
  expect(trash.autoDepot).toBe(true);
  expect([trash.widthCm, trash.depthCm, trash.heightCm]).toEqual([40, 40, 60]);

  const trashBox = footprint(trash);
  const fridgeBox = footprint(fridge);
  const rackBox = footprint(rack);
  expect(overlaps(trashBox, fridgeBox)).toBe(false);
  expect(overlaps(trashBox, rackBox)).toBe(false);
  expect(overlaps(fridgeBox, rackBox)).toBe(false);
  expect(pageErrors).toEqual([]);
});
