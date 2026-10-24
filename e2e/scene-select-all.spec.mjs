import { openEditorSettings } from './helpers/editorSettings.mjs';
import { test, expect } from '@playwright/test';

async function createStand(page, name, { width = 500, depth = 500 } = {}) {
  await page.goto('/');
  const setup = page.locator('details.stand-setup-card');
  await setup.locator('summary').click();
  await setup.getByRole('button', { name: 'Sırt Duvar' }).click();
  await page.locator('#stand-size-x').fill(String(width / 100));
  await page.locator('#stand-size-y').fill(String(depth / 100));
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill(name);
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
}

async function save(page) {
  await page.locator('#save-project').click();
  await expect(page.locator('#project-status')).toContainText('Kaydedildi:');
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('fair-stand-configurator', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const projects = await new Promise((resolve, reject) => {
      const request = db.transaction('projects').objectStore('projects').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return projects.sort((a, b) => b.updatedAt - a.updatedAt)[0];
  });
}

async function selectAll(page, count) {
  await page.locator('#viewport').click({ position: { x: 20, y: 200 } });
  await page.keyboard.press('Control+a');
  await expect(page.locator('#selection-info')).toContainText(`${count} öğe seçili`);
}

// Ctrl/Cmd+A sonrası Özellikler paneli açılır; ⋯ düğmesi yoktur.
async function menu(page) {
  const result = page.getByRole('menu', { name: 'Modül işlemleri' });
  await expect(result).toBeVisible();
  return result;
}

async function unlockAll(page, count) {
  await selectAll(page, count);
  const context = await menu(page);
  await context.locator('[data-module-action="unlock-selection"]').click();
}

test('Ctrl+A duvar ve lambaları seçer; toplu kilit ve kilit açma çalışır', async ({ page }) => {
  await createStand(page, 'Toplu seçim kilit');
  const initial = await save(page);
  expect(initial.modules.some((module) => module.type === 'flat-panel')).toBe(true);
  expect(initial.modules.some((module) => module.type === 'led-floodlight')).toBe(true);
  const count = initial.modules.length;
  await selectAll(page, count);
  let context = await menu(page);
  await expect(context.locator('[data-module-action="delete"]')).toBeDisabled();
  await context.locator('[data-module-action="lock-selection"]').click();
  expect((await save(page)).modules.every((module) => module.locked === true)).toBe(true);
  await unlockAll(page, count);
  expect((await save(page)).modules.every((module) => module.locked !== true)).toBe(true);

  // Metin alanında Ctrl+A tarayıcıya aittir; sahne seçimine çevrilmez.
  await page.locator('#viewport').click({ position: { x: 20, y: 200 } });
  await page.locator('#rename-project').click();
  const name = page.locator('form input[name="projectName"]');
  await expect(name).toBeVisible();
  await name.fill('Metin seçimi');
  const before = await page.locator('#selection-info').textContent();
  await page.keyboard.press('Control+a');
  expect(await name.evaluate((input) => input.selectionEnd - input.selectionStart)).toBe('Metin seçimi'.length);
  await expect(page.locator('#selection-info')).toHaveText(before);
  await page.getByRole('button', { name: 'İptal', exact: true }).click();
});

test('Ctrl+A ile grup kurulur; grubun tamamının kilidi açılır ve topluca çözülür', async ({ page }) => {
  await createStand(page, 'Toplu seçim grup');
  const initial = await save(page);
  const count = initial.modules.length;
  await unlockAll(page, count);
  await selectAll(page, count);
  let context = await menu(page);
  page.once('dialog', (dialog) => dialog.accept('Bütün stand'));
  await context.locator('[data-module-action="group-create"]').click();
  const grouped = await save(page);
  expect(grouped.modules.every((module) => module.group?.name === 'Bütün stand')).toBe(true);
  await page.locator('#editor-mode-advanced').click();
  const card = page.locator('#module-groups-card');
  if (!(await card.evaluate((el) => el.open))) await card.locator(':scope > summary').click();
  await card.locator('.module-group-row details > summary').click();
  await card.locator('[data-group-action="group-lock"]').click();
  expect((await save(page)).modules.every((module) => module.group.locked === true)).toBe(true);
  await unlockAll(page, count);
  const unlocked = await save(page);
  expect(unlocked.modules.every((module) => module.group.locked === false)).toBe(true);
  await selectAll(page, count);
  context = await menu(page);
  await context.locator('[data-module-action="group-dissolve-selection"]').click();
  const dissolved = await save(page);
  expect(dissolved.modules.every((module) => !module.group)).toBe(true);
  expect(dissolved.modules.map(({ id, placement }) => [id, placement.xCm, placement.yCm, placement.zCm, placement.rotationZDeg]))
    .toEqual(initial.modules.map(({ id, placement }) => [id, placement.xCm, placement.yCm, placement.zCm, placement.rotationZDeg]));
});

test('toplu Delete kilitliyken engellenir; onay sormadan siler; silme tek adımda geri alınır', async ({ page }) => {
  await createStand(page, 'Toplu seçim silme');
  const initial = await save(page);
  const count = initial.modules.length;
  await selectAll(page, count);
  await page.keyboard.press('Delete');
  await expect(page.locator('#selection-info')).toContainText('kilitli öğeler');
  expect((await save(page)).modules).toEqual(initial.modules);
  await unlockAll(page, count);
  const unlocked = await save(page);
  // Silme onay penceresi açmaz; yanlış silme Geri al ile döner.
  const dialogs = [];
  const onDialog = (dialog) => { dialogs.push(dialog.message()); void dialog.dismiss(); };
  page.on('dialog', onDialog);
  await selectAll(page, count);
  await page.keyboard.press('Delete');
  const empty = await save(page);
  page.off('dialog', onDialog);
  expect(dialogs).toEqual([]);
  expect(empty.modules).toEqual([]);
  expect(empty.stand).toEqual(initial.stand);
  await page.locator('body').press('Control+z');
  expect((await save(page)).modules).toEqual(unlocked.modules);
});

test('78 öğenin tamamı seçilir: 26 duvar, 26 lamba, 26 masa ve toplu kilit', async ({ page }) => {
  await createStand(page, '78 öğe tümünü seç', { width: 3000, depth: 1000 });
  const initial = await save(page);
  await page.evaluate(async (projectId) => {
    const { createModuleStateFromCatalogKey } = await import('/src/designState.js');
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('fair-stand-configurator', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const project = await new Promise((resolve, reject) => {
      const request = db.transaction('projects').objectStore('projects').get(projectId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    project.modules = [];
    for (let index = 0; index < 26; index += 1) {
      for (const key of ['wall_100_350', 'led_floodlight', 'glass_table']) {
        const module = createModuleStateFromCatalogKey(key);
        if (!module) throw new Error(`Öğe oluşturulamadı: ${key}`);
        module.placement = { xCm: 100 + index * 100, yCm: key === 'glass_table' ? 500 : 0, zCm: 0, wallId: key === 'glass_table' ? 'free' : 'back', rotationZDeg: 0 };
        if (key === 'wall_100_350') module.locked = true;
        project.modules.push(module);
      }
    }
    await new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      tx.objectStore('projects').put(project);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, initial.id);
  await page.reload();
  await page.locator('#project-select').evaluate((select, id) => { select.value = id; }, initial.id);
  await page.locator('#open-project').click();
  await expect(page.locator('#project-status')).toContainText('Açıldı:');
  expect((await save(page)).modules).toHaveLength(78);
  await selectAll(page, 78);
  const context = await menu(page);
  await expect(context.locator('.module-context-title')).toContainText('78 öğe seçili');
  await context.locator('[data-module-action="lock-selection"]').click();
  const locked = await save(page);
  expect(locked.modules).toHaveLength(78);
  expect(locked.modules.every((module) => module.locked === true)).toBe(true);
});

test('Herşeyi Kilitle checkbox tüm öğeleri ve grup kilitlerini yönetir; geri alma ve kayıt korunur', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await openEditorSettings(page);
  const allLock = page.getByRole('checkbox', { name: 'Herşeyi Kilitle', exact: true });
  await expect(allLock).toBeDisabled();
  await createStand(page, 'Ayarlar Toplu Kilit');
  await openEditorSettings(page);
  await expect(allLock).toBeEnabled();
  const initial = await save(page);
  await allLock.check();
  expect((await save(page)).modules.every(module => module.locked === true)).toBe(true);
  await expect(allLock).toBeChecked();
  await page.locator('#design-undo').click();
  expect((await save(page)).modules.map(module => module.locked ?? false)).toEqual(initial.modules.map(module => module.locked ?? false));
  await page.locator('#design-redo').click();
  await expect(allLock).toBeChecked();
  await allLock.uncheck();
  expect((await save(page)).modules.every(module => module.locked !== true)).toBe(true);
  await selectAll(page, initial.modules.length);
  const context = await menu(page);
  page.once('dialog', dialog => dialog.accept('Toplu Kilit Grubu'));
  await context.locator('[data-module-action="group-create"]').click();
  const card = page.locator('#module-groups-card');
  if (!(await card.evaluate(element => element.open))) await card.locator(':scope > summary').click();
  await card.locator('.module-group-row details > summary').click();
  await card.locator('[data-group-action="group-lock"]').click();
  await expect(allLock).toBeChecked();
  await allLock.uncheck();
  const unlocked = await save(page);
  expect(unlocked.modules.every(module => module.locked !== true && module.group?.locked !== true)).toBe(true);
  expect(unlocked.modules.every(module => module.group?.name === 'Toplu Kilit Grubu')).toBe(true);
  await allLock.check();
  const locked = await save(page);
  await page.reload();
  await expect(page.locator('#project-select option[value="' + locked.id + '"]')).toHaveCount(1);
  await page.locator('#project-select').evaluate((select, id) => { select.value = id; }, locked.id);
  await page.locator('#open-project').click();
  await expect(page.locator('#project-status')).toContainText('Açıldı:');
  await openEditorSettings(page);
  await expect(allLock).toBeChecked();
  await allLock.uncheck();
  expect((await save(page)).modules.every(module => module.locked !== true && module.group?.locked !== true)).toBe(true);
});
