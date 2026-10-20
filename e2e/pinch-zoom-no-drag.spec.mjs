import { test, expect } from '@playwright/test';

// Tablet iki parmak: ilk parmak bir öğeyi yakalamış olsa da ikinci parmak gelince öğe sürüklemesi
// iptal edilir (öğe yerinde kalır) ve iki parmak kamerayı yakınlaştırır.
test.use({ viewport: { width: 1180, height: 820 }, hasTouch: true });

async function createIslandStand(page) {
  await page.route('**/src/scene3d.js*', async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      'const controls = new OrbitControls(camera, renderer.domElement);',
      'const controls = new OrbitControls(camera, renderer.domElement); window.__sceneCamera = camera; window.__sceneControls = controls;',
    );
    await route.fulfill({ response, body });
  });
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('600');
  await page.locator('#stand-size-y').fill('600');
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill('E2E Iki Parmak');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  await page.locator('#autosave-interval').selectOption('0');
}

async function fridges(page) {
  await page.locator('#save-project').click();
  await expect(page.locator('#save-project')).toBeEnabled();
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('fair-stand-configurator', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const projects = await new Promise((resolve) => {
      const request = db.transaction('projects', 'readonly').objectStore('projects').getAll();
      request.onsuccess = () => resolve(request.result ?? []);
    });
    db.close();
    const project = projects.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0];
    return (project?.modules ?? []).filter((module) => module.itemKey === 'mini_fridge_avanti');
  });
}

async function dropFridge(page) {
  const openCatalogButton = page.locator('#open-module-catalog');
  const modulePanel = page.locator('details', { has: openCatalogButton });
  if (!(await modulePanel.evaluate((el) => el.open))) await modulePanel.locator(':scope > summary').click();
  const card = page.locator('.module-drag-card[data-module-key="mini_fridge_avanti"]');
  const group = page.locator('.module-drag-group', { has: card });
  if (!(await group.evaluate((el) => el.open))) await group.locator(':scope > summary').click();
  await card.scrollIntoViewIfNeeded();
  const box = await page.locator('#viewport').boundingBox();
  const point = { x: Math.round(box.width * 0.6), y: Math.round(box.height * 0.8) };
  await card.dragTo(page.locator('#viewport'), { targetPosition: point });
  await expect.poll(async () => (await fridges(page)).length).toBe(1);
  return { fridge: { x: box.x + point.x, y: box.y + point.y }, box };
}

async function cameraDistance(page) {
  return page.evaluate(() => window.__sceneCamera.position.distanceTo(window.__sceneControls.target));
}

// Gerçek dokunmatik giriş: önce yalnız ilk parmak, sonra iki parmak açılarak (yakınlaştırma).
async function pinch(page, first, second, { firstWanders = false } = {}) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  await send('touchStart', [{ x: first.x, y: first.y, id: 1 }]);
  if (firstWanders) {
    // İlk parmak öğeyi biraz sürükler (sürükleme başlar).
    for (let step = 1; step <= 4; step += 1) {
      await send('touchMove', [{ x: first.x + step * 6, y: first.y, id: 1 }]);
      await page.waitForTimeout(16);
    }
  }
  const a = { x: first.x + (firstWanders ? 24 : 0), y: first.y };
  await send('touchStart', [{ x: a.x, y: a.y, id: 1 }, { x: second.x, y: second.y, id: 2 }]);
  // Parmaklar birbirinden uzaklaşır (yakınlaştırma).
  const sx = Math.sign(a.x - second.x) || 1;
  const sy = Math.sign(a.y - second.y) || 1;
  for (let step = 1; step <= 10; step += 1) {
    await send('touchMove', [
      { x: a.x + sx * step * 12, y: a.y + sy * step * 6, id: 1 },
      { x: second.x - sx * step * 12, y: second.y - sy * step * 6, id: 2 },
    ]);
    await page.waitForTimeout(16);
  }
  await send('touchEnd', []);
  await cdp.detach();
  await page.waitForTimeout(300);
}

test('first finger grabbing an item, then a second finger: item stays, camera zooms', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await createIslandStand(page);
  const { fridge, box } = await dropFridge(page);
  const [before] = await fridges(page);
  const distanceBefore = await cameraDistance(page);

  await pinch(page, fridge, { x: box.x + box.width * 0.35, y: box.y + box.height * 0.55 }, { firstWanders: true });

  const [after] = await fridges(page);
  expect(after.placement).toEqual(before.placement);
  expect(await cameraDistance(page)).toBeLessThan(distanceBefore * 0.97);
  await expect(page.getByRole('menu', { name: 'Modül işlemleri' })).toBeHidden();
  expect(errors).toEqual([]);
});

test('second finger landing on an item does not grab it; camera zooms', async ({ page }) => {
  await createIslandStand(page);
  const { fridge, box } = await dropFridge(page);
  const [before] = await fridges(page);
  const distanceBefore = await cameraDistance(page);

  await pinch(page, { x: box.x + box.width * 0.35, y: box.y + box.height * 0.55 }, fridge);

  const [after] = await fridges(page);
  expect(after.placement).toEqual(before.placement);
  expect(await cameraDistance(page)).toBeLessThan(distanceBefore * 0.97);
});
