import { test, expect } from '@playwright/test';

// Faz 2 — Geri al / İleri al (kyrox-platform projects/fair-stand/GROUP_LOCK_ROADMAP.md):
// taşıma, silme ve kilit Ctrl+Z ile geri alınır, Ctrl+Y ile ileri alınır; üst bant
// düğmeleri aynı işi yapar; metin kutusundaki Ctrl+Z tasarımı etkilemez.

const FRIDGE = { key: 'mini_fridge_avanti', at: { x: 0.52, y: 0.82 } };
const MOVED_TO = { x: 0.72, y: 0.82 };

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
  const openCatalogButton = page.locator('#open-module-catalog');
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

// Kısayol, odak tuvaldeyken (metin kutusu değil) gönderilir.
async function pressOnScene(page, keys) {
  await page.locator('#viewport').focus().catch(() => {});
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press(keys);
}

function findModule(project, id) {
  return project.modules.find((moduleState) => moduleState.id === id);
}

test('taşıma, silme ve kilit Ctrl+Z ile geri alınır, Ctrl+Y ile ileri alınır', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('dialog', (dialog) => dialog.accept());
  await createIslandStand(page, 'E2E Design Undo');
  await expect(page.locator('#design-undo')).toBeDisabled();
  await expect(page.locator('#design-redo')).toBeDisabled();

  await dropCatalogItem(page, FRIDGE);
  const placed = await saveAndReadProject(page);
  const fridge = placed.modules.find((moduleState) => moduleState.itemKey === FRIDGE.key);
  expect(fridge).toBeTruthy();
  await expect(page.locator('#design-undo')).toBeEnabled();

  // Taşı → Ctrl+Z eski yer → Ctrl+Y yeni yer.
  await drag(page, FRIDGE.at, MOVED_TO);
  const moved = await saveAndReadProject(page);
  expect(findModule(moved, fridge.id).placement.xCm).not.toBe(fridge.placement.xCm);

  await pressOnScene(page, 'Control+z');
  await expect(page.locator('#selection-info')).toContainText('Geri alındı');
  const undone = await saveAndReadProject(page);
  expect(findModule(undone, fridge.id).placement).toEqual(fridge.placement);
  await expect(page.locator('#design-redo')).toBeEnabled();

  await pressOnScene(page, 'Control+y');
  const redone = await saveAndReadProject(page);
  expect(findModule(redone, fridge.id).placement).toEqual(findModule(moved, fridge.id).placement);

  // Sil → Geri al düğmesi → öğe geri gelir.
  const point = await viewportPoint(page, MOVED_TO);
  await page.mouse.click(point.x, point.y);
  await page.keyboard.press('Delete');
  const deleted = await saveAndReadProject(page);
  expect(findModule(deleted, fridge.id)).toBeUndefined();
  await page.locator('#design-undo').click();
  const restored = await saveAndReadProject(page);
  expect(findModule(restored, fridge.id)).toBeTruthy();

  // Kilitle → Ctrl+Z → kilit kalkar; Ctrl+Shift+Z → kilit geri gelir.
  await page.mouse.click(point.x, point.y, { button: 'right' });
  const menu = page.getByRole('menu', { name: 'Modül işlemleri' });
  await menu.locator('[data-module-action="toggle-lock"]').click();
  const locked = await saveAndReadProject(page);
  expect(findModule(locked, fridge.id).locked).toBe(true);
  await pressOnScene(page, 'Control+z');
  const unlocked = await saveAndReadProject(page);
  expect(findModule(unlocked, fridge.id).locked).toBeUndefined();
  await pressOnScene(page, 'Control+Shift+z');
  const relocked = await saveAndReadProject(page);
  expect(findModule(relocked, fridge.id).locked).toBe(true);

  expect(pageErrors).toEqual([]);
});

test('metin kutusundaki Ctrl+Z tasarımı geri almaz', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await createIslandStand(page, 'E2E Design Undo Input');
  await dropCatalogItem(page, FRIDGE);
  const placed = await saveAndReadProject(page);
  const fridge = placed.modules.find((moduleState) => moduleState.itemKey === FRIDGE.key);

  // Yetenek bağımsız metin alanı: buzdolabının renk alanı olmak zorunda değildir.
  await page.locator('#rename-project').click();
  const name = page.locator('form input[name="projectName"]');
  await expect(name).toBeVisible();
  await name.fill('Metin düzenlemesi');
  await page.keyboard.press('Control+z');
  await page.getByRole('button', { name: 'İptal', exact: true }).click();
  const after = await saveAndReadProject(page);
  expect(findModule(after, fridge.id)).toBeTruthy();
  expect(pageErrors).toEqual([]);
});
