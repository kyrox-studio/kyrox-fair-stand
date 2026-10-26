import { test, expect } from '@playwright/test';

// Faz 1 — Kilit (kyrox-platform projects/fair-stand/GROUP_LOCK_ROADMAP.md): kilitli öğe sürüklenmez,
// ok tuşu ve Delete ile oynamaz, kilit projeyle kaydedilir; kilit açılınca taşınır.
// Çift tık + Ctrl+tık toplu seçimi sağ tık menüsünden hepsini birden kilitler.

const FRIDGE = { key: 'mini_fridge_avanti', at: { x: 0.52, y: 0.82 } };
const BIN = { key: 'plastic_trash_bin', at: { x: 0.36, y: 0.82 } };

async function createIslandStand(page, projectName) {
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('5');
  await page.locator('#stand-size-y').fill('5');
  // Kilit akışı boş ada standda sınanır; otomatik stand mobilyaları bırakma noktalarını doldurur.
  await page.locator('#auto-furniture').uncheck();
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

async function viewportPoint(page, at) {
  const box = await page.locator('#viewport').boundingBox();
  expect(box).not.toBeNull();
  return { x: box.x + Math.round(box.width * at.x), y: box.y + Math.round(box.height * at.y) };
}

async function dropCatalogItem(page, item) {
  const card = await openCatalogCard(page, item.key);
  const viewport = page.locator('#viewport');
  const box = await viewport.boundingBox();
  await card.dragTo(viewport, {
    targetPosition: { x: Math.round(box.width * item.at.x), y: Math.round(box.height * item.at.y) },
  });
}

async function saveAndReadProject(page) {
  await page.locator('#save-project').click();
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

async function drag(page, from, to) {
  const start = await viewportPoint(page, from);
  const end = await viewportPoint(page, to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 16 });
  await page.mouse.up();
}

async function contextAction(page, at, action) {
  const point = await viewportPoint(page, at);
  await page.mouse.click(point.x, point.y, { button: 'right' });
  const menu = page.getByRole('menu', { name: 'Modül işlemleri' });
  await expect(menu).toBeVisible();
  const button = menu.locator(`[data-module-action="${action}"]`);
  await expect(button).toBeVisible();
  await button.click();
  if (action === 'toggle-lock') await expect(page.locator('#selection-info')).toContainText('kilitlendi');
  // Özellikler paneli işlemden sonra açık kalır; sahneye dönmek için kapatılır.
  await expect(menu).toBeVisible();
  await page.getByRole('button', { name: 'Seçimi kaldır', exact: true }).click();
  await expect(menu).toBeHidden();
}

function findModule(project, id) {
  return project.modules.find((moduleState) => moduleState.id === id);
}

test('kilitli öğe sürükleme, ok tuşu ve Delete ile oynamaz; kilit kaydedilir ve açılınca taşınır', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await createIslandStand(page, 'E2E Module Lock');
  await dropCatalogItem(page, FRIDGE);

  const initial = await saveAndReadProject(page);
  const fridge = initial.modules.find((moduleState) => moduleState.itemKey === FRIDGE.key);
  expect(fridge).toBeTruthy();
  expect(fridge.locked).toBeUndefined();

  await contextAction(page, FRIDGE.at, 'toggle-lock');
  const locked = await saveAndReadProject(page);
  expect(findModule(locked, fridge.id).locked).toBe(true);

  // Sürükleme: yerinde kalır, uyarı görünür.
  await drag(page, FRIDGE.at, { x: 0.72, y: 0.82 });
  await expect(page.getByText('Bu öğe kilitli.').first()).toBeVisible();
  const afterDrag = await saveAndReadProject(page);
  expect(findModule(afterDrag, fridge.id).placement).toEqual(findModule(locked, fridge.id).placement);

  // Seç, ok tuşu ve Delete: yerinde ve sahnede kalır.
  const point = await viewportPoint(page, FRIDGE.at);
  await page.mouse.click(point.x, point.y);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Delete');
  const afterKeys = await saveAndReadProject(page);
  expect(afterKeys.modules).toHaveLength(locked.modules.length);
  expect(findModule(afterKeys, fridge.id).placement).toEqual(findModule(locked, fridge.id).placement);

  // Menüde Sil pasif, başlıkta Kilitli yazar.
  await page.mouse.click(point.x, point.y, { button: 'right' });
  const menu = page.getByRole('menu', { name: 'Modül işlemleri' });
  await expect(menu.locator('.module-context-title')).toContainText('Kilitli');
  await expect(menu.locator('[data-module-action="delete"]')).toBeDisabled();
  await expect(menu.locator('[data-module-action="toggle-lock"]')).toHaveText('Kilitli');
  await menu.locator('[data-module-action="toggle-lock"]').click();

  const unlocked = await saveAndReadProject(page);
  expect(Object.hasOwn(findModule(unlocked, fridge.id), 'locked')).toBe(false);
  await drag(page, FRIDGE.at, { x: 0.72, y: 0.82 });
  const moved = await saveAndReadProject(page);
  expect(findModule(moved, fridge.id).placement.xCm).not.toBe(findModule(unlocked, fridge.id).placement.xCm);
  expect(pageErrors).toEqual([]);
});

test('çift tık + Ctrl+tık toplu seçim sağ tık menüsünden hepsini kilitler ve kilidini açar', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await createIslandStand(page, 'E2E Module Lock Multi');
  await dropCatalogItem(page, FRIDGE);
  await dropCatalogItem(page, BIN);

  const before = await saveAndReadProject(page);
  const fridge = before.modules.find((moduleState) => moduleState.itemKey === FRIDGE.key);
  const bin = before.modules.find((moduleState) => moduleState.itemKey === BIN.key);
  expect(fridge && bin).toBeTruthy();

  const fridgePoint = await viewportPoint(page, FRIDGE.at);
  const binPoint = await viewportPoint(page, BIN.at);
  // Shift+tık artık modül eklemez.
  await page.mouse.dblclick(fridgePoint.x, fridgePoint.y);
  await page.keyboard.down('Shift');
  await page.mouse.click(binPoint.x, binPoint.y);
  await page.keyboard.up('Shift');
  await expect(page.locator('#selection-info')).not.toContainText('2 öğe seçili');

  await page.mouse.dblclick(fridgePoint.x, fridgePoint.y);
  await page.keyboard.down('Control');
  await page.mouse.click(binPoint.x, binPoint.y);
  await page.keyboard.up('Control');
  await expect(page.locator('#selection-info')).toContainText('2 öğe seçili');

  await contextAction(page, BIN.at, 'lock-selection');
  const lockedBoth = await saveAndReadProject(page);
  expect(findModule(lockedBoth, fridge.id).locked).toBe(true);
  expect(findModule(lockedBoth, bin.id).locked).toBe(true);

  await page.mouse.dblclick(fridgePoint.x, fridgePoint.y);
  await page.keyboard.down('Control');
  await page.mouse.click(binPoint.x, binPoint.y);
  await page.keyboard.up('Control');
  await contextAction(page, FRIDGE.at, 'unlock-selection');
  const unlockedBoth = await saveAndReadProject(page);
  expect(findModule(unlockedBoth, fridge.id).locked).toBeUndefined();
  expect(findModule(unlockedBoth, bin.id).locked).toBeUndefined();
  expect(pageErrors).toEqual([]);
});
