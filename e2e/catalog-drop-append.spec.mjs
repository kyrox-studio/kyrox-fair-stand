import { test, expect } from '@playwright/test';

// Katalogdan bırakılan tek modül sahneye tek başına eklenir: sahnedeki diğer modüller ve
// görselleri yeniden yaratılmaz (eskiden her bırakmada bütün sahne baştan kuruluyordu).
async function exposeScene(page) {
  await page.route('**/src/scene3d.js*', async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      '  let surfaceMeshes = [];',
      '  let surfaceMeshes = []; window.__sceneSurfaces = () => surfaceMeshes;',
    );
    await route.fulfill({ response, body });
  });
}

async function dropBoxBlock(page, x, y) {
  const openCatalogButton = page.locator('#open-module-catalog');
  const modulePanel = page.locator('details', { has: openCatalogButton });
  if (!(await modulePanel.evaluate((el) => el.open))) await modulePanel.locator(':scope > summary').click();
  const card = page.locator('.module-drag-card[data-module-key="box_block"]');
  const group = page.locator('.module-drag-group', { has: card });
  if (!(await group.evaluate((el) => el.open))) await group.locator(':scope > summary').click();
  await card.scrollIntoViewIfNeeded();
  const viewport = await page.locator('#viewport').boundingBox();
  await card.dragTo(page.locator('#viewport'), {
    targetPosition: { x: Math.round(viewport.width * x), y: Math.round(viewport.height * y) },
  });
  await expect(page.locator('#box-block-size-title')).toBeVisible();
  await page.getByRole('button', { name: 'Uygula' }).click();
  await expect(page.locator('#box-block-size-title')).toHaveCount(0);
}

function boxBodies(page) {
  return page.evaluate(() => window.__sceneSurfaces()
    .filter((mesh) => mesh.userData.moduleType === 'box-block' && mesh.userData.selectionMode === 'module')
    .map((mesh) => ({ uuid: mesh.uuid, moduleId: mesh.userData.moduleId, moduleIndex: mesh.userData.moduleIndex })));
}

test('dropping a catalog module adds only that module and keeps the others untouched', async ({ page }) => {
  const refreshLines = [];
  page.on('console', (message) => {
    if (message.text().startsWith('[Fair Stand ölçüm] sahne yenileme')) refreshLines.push(message.text());
  });
  await page.addInitScript(() => localStorage.setItem('fairStandTiming', '1'));
  await exposeScene(page);
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('6');
  await page.locator('#stand-size-y').fill('6');
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill('E2E Ekleme');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();

  await dropBoxBlock(page, 0.6, 0.85);
  const [first] = await boxBodies(page);
  expect(first).toBeTruthy();

  await dropBoxBlock(page, 0.75, 0.9);
  const bodies = await boxBodies(page);
  expect(bodies).toHaveLength(2);
  // Birinci kutunun sahne nesnesi aynı nesne: yeniden yaratılmadı.
  expect(bodies.find((body) => body.moduleId === first.moduleId)?.uuid).toBe(first.uuid);
  await expect.poll(() => refreshLines.length).toBeGreaterThanOrEqual(2);
  expect(refreshLines.at(-1)).toMatch(/sahne yenileme: kurulum \d+ ms · ilk kare \d+ ms \(\+\d+ program\)/);

  // Silme: yalnız o modül kalkar; kalan modül aynı nesne olarak kalır ve sıra numarası güncellenir.
  const second = bodies.find((body) => body.moduleId !== first.moduleId);
  page.once('dialog', (dialog) => dialog.accept());
  await page.evaluate((moduleId) => {
    window.dispatchEvent(new CustomEvent('fair-stand:delete-selected-module', { detail: { moduleId } }));
  }, first.moduleId);
  await expect.poll(async () => (await boxBodies(page)).length).toBe(1);
  const [remaining] = await boxBodies(page);
  expect(remaining.uuid).toBe(second.uuid);
  expect(remaining.moduleIndex).toBe(0);
});

test('undo and redo touch only the module that changed', async ({ page }) => {
  await exposeScene(page);
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('6');
  await page.locator('#stand-size-y').fill('6');
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill('E2E Geri Al');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();

  await dropBoxBlock(page, 0.6, 0.85);
  const [first] = await boxBodies(page);
  await dropBoxBlock(page, 0.75, 0.9);
  await expect.poll(async () => (await boxBodies(page)).length).toBe(2);
  const second = (await boxBodies(page)).find((body) => body.moduleId !== first.moduleId);

  // Geri al: ikinci kutu kalkar, birinci aynı nesne olarak kalır.
  await expect(page.locator('#design-undo')).toBeEnabled();
  await page.locator('#design-undo').click();
  await expect.poll(async () => (await boxBodies(page)).length).toBe(1);
  let [only] = await boxBodies(page);
  expect(only.moduleId).toBe(first.moduleId);
  expect(only.uuid).toBe(first.uuid);

  // İleri al: ikinci kutu geri gelir; birinci yine dokunulmadan kalır.
  await page.locator('#design-redo').click();
  await expect.poll(async () => (await boxBodies(page)).length).toBe(2);
  const bodies = await boxBodies(page);
  expect(bodies.find((body) => body.moduleId === first.moduleId)?.uuid).toBe(first.uuid);
  const restored = bodies.find((body) => body.moduleId === second.moduleId);
  expect(restored).toBeTruthy();
  expect(restored.moduleIndex).toBe(1);
});
