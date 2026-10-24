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
  if (!(await group.getAttribute('open'))) {
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

test('Kaydet → tarayıcı yenile → Aç önceki item identity ve placement’ı geri yükler', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await createIslandStand(page, 'E2E Reload Restore');
  const card = await openCatalogCard(page, 'mini_fridge_avanti');
  const viewport = page.locator('#viewport');
  const box = await viewport.boundingBox();
  await card.dragTo(viewport, {
    targetPosition: {
      x: Math.round(box.width * 0.52),
      y: Math.round(box.height * 0.82),
    },
  });

  const before = await saveAndReadProject(page);
  expect(before).not.toBeNull();
  const fridgeBefore = before.modules.find((moduleState) => moduleState.itemKey === 'mini_fridge_avanti');
  expect(fridgeBefore).toBeTruthy();
  expect(fridgeBefore.placement.wallId).toBe('free');

  await page.reload();
  await expect(page.locator('#viewport-empty')).toBeVisible();
  const projectSelect = page.locator('#project-select');
  await expect(projectSelect.locator(`option[value="${before.id}"]`)).toHaveCount(1);
  await projectSelect.evaluate((select, id) => {
    select.value = id;
  }, before.id);

  await page.locator('#open-project').click();
  await expect(page.locator('#project-status')).toContainText('Açıldı:');
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  await expect(page.locator('#viewport > canvas')).toHaveCount(1);

  const after = await saveAndReadProject(page);
  expect(after.id).toBe(before.id);
  expect(after.modules).toHaveLength(before.modules.length);
  const fridgeAfter = after.modules.find((moduleState) => moduleState.id === fridgeBefore.id);
  expect(fridgeAfter).toBeTruthy();
  expect(fridgeAfter.itemKey).toBe(fridgeBefore.itemKey);
  expect(fridgeAfter.placement).toEqual(fridgeBefore.placement);
  expect(fridgeAfter.widthCm).toBe(fridgeBefore.widthCm);
  expect(fridgeAfter.depthCm).toBe(fridgeBefore.depthCm);
  expect(pageErrors).toEqual([]);
});
