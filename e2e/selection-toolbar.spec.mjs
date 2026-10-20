import { test, expect } from '@playwright/test';

// Tablet kullanımı: seçili modülün üstündeki işlem çubuğu (Döndür / Kopyala / Sil / ⋯) ve
// parmakla uzun basma ile sağ tık menüsü.
test.use({ viewport: { width: 1180, height: 820 }, hasTouch: true });

async function createIslandStand(page) {
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('600');
  await page.locator('#stand-size-y').fill('600');
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill('E2E Araç Çubuğu');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  await page.locator('#autosave-interval').selectOption('0');
}

async function dropFridge(page, x, y) {
  const openCatalogButton = page.locator('#open-module-catalog');
  const modulePanel = page.locator('details', { has: openCatalogButton });
  if (!(await modulePanel.evaluate((el) => el.open))) await modulePanel.locator(':scope > summary').click();
  const card = page.locator('.module-drag-card[data-module-key="mini_fridge_avanti"]');
  const group = page.locator('.module-drag-group', { has: card });
  if (!(await group.evaluate((el) => el.open))) await group.locator(':scope > summary').click();
  await card.scrollIntoViewIfNeeded();
  const viewport = await page.locator('#viewport').boundingBox();
  const point = { x: Math.round(viewport.width * x), y: Math.round(viewport.height * y) };
  await card.dragTo(page.locator('#viewport'), { targetPosition: point });
  await expect.poll(async () => (await fridges(page)).length).toBeGreaterThan(0);
  return { x: viewport.x + point.x, y: viewport.y + point.y };
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

test('selection toolbar rotates, duplicates, deletes and opens the menu', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await createIslandStand(page);
  const point = await dropFridge(page, 0.6, 0.8);

  const toolbar = page.getByRole('toolbar', { name: 'Seçim işlemleri' });
  await expect(toolbar).toBeHidden();
  await page.mouse.click(point.x, point.y);
  await expect(toolbar).toBeVisible();

  // Döndür: Shift+R ile aynı (90°).
  const [before] = await fridges(page);
  await expect(toolbar).toBeVisible();
  await toolbar.getByRole('button', { name: /Döndür/ }).click();
  const [rotated] = await fridges(page);
  expect(rotated.placement.rotationZDeg).not.toBe(before.placement.rotationZDeg);

  // Kopyala: ikinci kutu.
  await toolbar.getByRole('button', { name: /Kopyala/ }).click();
  await expect.poll(async () => (await fridges(page)).length).toBe(2);

  // ⋯: sağ tık menüsü, Döndür dahil.
  await page.mouse.click(point.x, point.y);
  await toolbar.getByRole('button', { name: 'Diğer işlemler' }).click();
  const menu = page.getByRole('menu', { name: 'Modül işlemleri' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Döndür' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.mouse.click(5, 5);

  // Sil: onaylı.
  await page.mouse.click(point.x, point.y);
  await expect(toolbar).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await toolbar.getByRole('button', { name: 'Sil' }).click();
  await expect.poll(async () => (await fridges(page)).length).toBe(1);
  expect(errors).toEqual([]);
});

test('touch long-press on a module opens the module menu', async ({ page }) => {
  await createIslandStand(page);
  const point = await dropFridge(page, 0.6, 0.8);
  const menu = page.getByRole('menu', { name: 'Modül işlemleri' });
  await expect(menu).toBeHidden();

  await page.evaluate(async ({ x, y }) => {
    const canvas = document.querySelector('#viewport > canvas');
    const init = { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, button: 0, buttons: 1, bubbles: true, cancelable: true };
    canvas.dispatchEvent(new PointerEvent('pointerdown', init));
    await new Promise((resolve) => setTimeout(resolve, 750));
    window.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }));
  }, point);

  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Döndür' })).toBeVisible();
});

test('a short touch tap does not open the menu', async ({ page }) => {
  await createIslandStand(page);
  const point = await dropFridge(page, 0.6, 0.8);
  await page.evaluate(async ({ x, y }) => {
    const canvas = document.querySelector('#viewport > canvas');
    const init = { pointerId: 8, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, button: 0, buttons: 1, bubbles: true, cancelable: true };
    canvas.dispatchEvent(new PointerEvent('pointerdown', init));
    await new Promise((resolve) => setTimeout(resolve, 120));
    window.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }));
    await new Promise((resolve) => setTimeout(resolve, 700));
  }, point);
  await expect(page.getByRole('menu', { name: 'Modül işlemleri' })).toBeHidden();
});

async function openFridgeCard(page) {
  const openCatalogButton = page.locator('#open-module-catalog');
  const modulePanel = page.locator('details', { has: openCatalogButton });
  if (!(await modulePanel.evaluate((el) => el.open))) await modulePanel.locator(':scope > summary').click();
  const card = page.locator('.module-drag-card[data-module-key="mini_fridge_avanti"]');
  const group = page.locator('.module-drag-group', { has: card });
  if (!(await group.evaluate((el) => el.open))) await group.locator(':scope > summary').click();
  await card.scrollIntoViewIfNeeded();
  return card;
}

test('tapping a catalog card then the scene places the module', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await createIslandStand(page);
  const card = await openFridgeCard(page);
  const viewport = await page.locator('#viewport').boundingBox();
  const target = { x: Math.round(viewport.x + viewport.width * 0.6), y: Math.round(viewport.y + viewport.height * 0.8) };

  // Esc iptal eder: kart bırakılır, sahneye dokunmak bir şey eklemez.
  await card.tap();
  await expect(card).toHaveClass(/is-armed/);
  await page.keyboard.press('Escape');
  await expect(card).not.toHaveClass(/is-armed/);

  // Aynı karta ikinci dokunuş da iptal eder.
  await card.tap();
  await card.tap();
  await expect(card).not.toHaveClass(/is-armed/);

  await card.tap();
  await expect(card).toHaveClass(/is-armed/);
  await page.touchscreen.tap(target.x, target.y);
  await expect.poll(async () => (await fridges(page)).length).toBe(1);
  await expect(card).not.toHaveClass(/is-armed/);

  // Yerleştirme tek seferlik: sonraki dokunuş yeni modül eklemez.
  await page.touchscreen.tap(target.x - 120, target.y);
  expect((await fridges(page)).length).toBe(1);
  expect(errors).toEqual([]);
});

test('multi-select toggle on the toolbar adds tapped modules to the selection', async ({ page }) => {
  await createIslandStand(page);
  const first = await dropFridge(page, 0.6, 0.8);
  await dropFridge(page, 0.35, 0.8);
  const viewport = await page.locator('#viewport').boundingBox();
  const second = { x: viewport.x + Math.round(viewport.width * 0.35), y: viewport.y + Math.round(viewport.height * 0.8) };
  await expect.poll(async () => (await fridges(page)).length).toBe(2);

  const toolbar = page.getByRole('toolbar', { name: 'Seçim işlemleri' });
  await page.mouse.click(first.x, first.y);
  await expect(toolbar).toBeVisible();
  const multi = toolbar.getByRole('button', { name: 'Çoklu modül' });
  await multi.click();
  await expect(multi).toHaveAttribute('aria-pressed', 'true');

  await page.touchscreen.tap(second.x, second.y);
  await expect(toolbar.getByRole('button', { name: /Döndür/ })).toBeHidden();
  await toolbar.getByRole('button', { name: 'Diğer işlemler' }).click();
  const menu = page.getByRole('menu', { name: 'Modül işlemleri' });
  await expect(menu).toContainText('2 öğe seçili');
  await page.keyboard.press('Escape');

  // Boş alana dokunmak seçimi ve çoklu seçim modunu kapatır.
  await page.mouse.click(viewport.x + 20, viewport.y + 20);
  await expect(toolbar).toBeHidden();
  await page.mouse.click(first.x, first.y);
  await expect(multi).toHaveAttribute('aria-pressed', 'false');
});

test('module menu keeps advanced panel actions under Gelişmiş', async ({ page }) => {
  await createIslandStand(page);
  const point = await dropFridge(page, 0.6, 0.8);
  await page.mouse.click(point.x, point.y, { button: 'right' });
  const menu = page.getByRole('menu', { name: 'Modül işlemleri' });
  await expect(menu).toBeVisible();
  // Buzdolabında panel dönüşümü yok: Gelişmiş başlığı da çıkmaz.
  await expect(menu.locator('.module-context-advanced-toggle')).toBeHidden();
  await expect(menu.getByRole('menuitem', { name: 'Döndür' })).toBeVisible();
});
