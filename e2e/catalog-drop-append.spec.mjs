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
  await exposeScene(page);
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('600');
  await page.locator('#stand-size-y').fill('600');
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
