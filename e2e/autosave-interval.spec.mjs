import { test, expect } from '@playwright/test';

async function createIslandProject(page, baseName) {
  const standSetup = page.locator('details.stand-setup-card');
  const isOpen = await standSetup.evaluate((element) => element.open);
  if (!isOpen) await standSetup.locator('summary').click();

  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('500');
  await page.locator('#stand-size-y').fill('500');
  await page.locator('#create-stage').click();
  const nameInput = page.locator('form input[name="projectName"]');
  await expect(nameInput).toBeVisible();
  await nameInput.fill(baseName);
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();

  await expect(page.locator('#project-status')).toContainText('Oluşturuldu ve kaydedildi');
  return page.locator('#project-name-display').textContent();
}

async function readStoredFloorType(page, projectName) {
  return page.evaluate(async (name) => {
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
    return projects.find((project) => project.name === name)?.stand?.itemKey ?? null;
  }, projectName);
}

test('autosave interval defaults to 3 minutes and saves when the time passes', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.clock.install();
  await page.goto('/');

  const select = page.locator('#autosave-interval');
  await expect(select).toHaveValue('3');
  const projectName = await createIslandProject(page, 'Autosave Uc');
  const initialFloor = await readStoredFloorType(page, projectName);
  expect(initialFloor).not.toBe('hali');

  await page.locator('#floor-type').selectOption('hali');
  await page.clock.runFor(1500);
  await expect(page.locator('#project-status')).toContainText('3 dk içinde otomatik kaydedilecek');

  await page.clock.fastForward(170000);
  expect(await readStoredFloorType(page, projectName)).toBe(initialFloor);

  await page.clock.fastForward(15000);
  await expect(page.locator('#project-status')).toHaveText('Kaydedildi · Otomatik');
  expect(await readStoredFloorType(page, projectName)).toBe('hali');
  expect(pageErrors).toEqual([]);
});

test('Kapalı disables timed autosave, manual save still works, and choice survives reload', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.clock.install();
  await page.goto('/');

  const select = page.locator('#autosave-interval');
  await select.selectOption('0');
  const projectName = await createIslandProject(page, 'Autosave Kapali');
  const initialFloor = await readStoredFloorType(page, projectName);

  await page.locator('#floor-type').selectOption('hali');
  await page.clock.runFor(1500);
  await expect(page.locator('#project-status')).toHaveText('Kaydedilmemiş değişiklik var · otomatik kayıt kapalı');

  await page.clock.fastForward(11 * 60000);
  expect(await readStoredFloorType(page, projectName)).toBe(initialFloor);

  await page.locator('#save-project').click();
  await expect.poll(() => readStoredFloorType(page, projectName)).toBe('hali');

  await page.reload();
  await expect(page.locator('#autosave-interval')).toHaveValue('0');
  expect(pageErrors).toEqual([]);
});

test('switching from Kapalı to 5 minutes schedules the pending change', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');

  await page.locator('#autosave-interval').selectOption('0');
  await createIslandProject(page, 'Autosave Bes');
  await page.locator('#floor-type').selectOption('hali');
  await page.clock.runFor(1500);
  await expect(page.locator('#project-status')).toContainText('otomatik kayıt kapalı');

  await page.locator('#autosave-interval').selectOption('5');
  await expect(page.locator('#project-status')).toContainText('5 dk içinde otomatik kaydedilecek');
});

// Otomatik kayıt kapalıyken proje yalnız Kaydet ile kaydedilir: görsel yükleme, sekme gizleme ve
// proje işlemleri kayıt yapmaz; Aç kaydedilmemiş değişikliğin kaybolacağını sorar.
test('Kapalı: image upload, hidden tab, Aç and ← Standlar never save; only Kaydet saves', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/');
  await page.locator('#autosave-interval').selectOption('0');
  const projectName = await createIslandProject(page, 'Autosave Yalniz Kaydet');
  const initialFloor = await readStoredFloorType(page, projectName);
  expect(initialFloor).not.toBe('hali');

  await page.locator('#floor-type').selectOption('hali');
  await page.locator('#surface-image').setInputFiles({
    name: 'e2e-yalniz-kaydet.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    ),
  });
  await expect(page.locator('#asset-status')).toContainText('e2e-yalniz-kaydet.png');

  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    delete document.visibilityState;
  });
  await page.waitForTimeout(800);
  expect(await readStoredFloorType(page, projectName)).toBe(initialFloor);

  const dialogs = [];
  let acceptDialog = false;
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    void (acceptDialog ? dialog.accept() : dialog.dismiss());
  });
  await page.locator('#open-project').click();
  await expect.poll(() => dialogs.length).toBe(1);
  expect(dialogs[0]).toContain('Kaydedilmemiş değişiklikler kaybolacak');
  expect(await readStoredFloorType(page, projectName)).toBe(initialFloor);

  // "← Standlar" (CRM'in kenar çubuğuna eklediği sayfa içi geçiş): önce onay sorar.
  await page.evaluate(() => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sidebar-back';
    button.textContent = '← Standlar';
    button.addEventListener('click', () => { window.__leftEditor = (window.__leftEditor ?? 0) + 1; });
    document.querySelector('#sidebar').prepend(button);
  });
  await page.locator('.sidebar-back').click();
  await expect.poll(() => dialogs.length).toBe(2);
  expect(dialogs[1]).toContain('Kaydetmeden çıkılsın mı?');
  expect(await page.evaluate(() => window.__leftEditor ?? 0)).toBe(0);
  acceptDialog = true;
  await page.locator('.sidebar-back').click();
  await expect.poll(() => page.evaluate(() => window.__leftEditor ?? 0)).toBe(1);
  expect(await readStoredFloorType(page, projectName)).toBe(initialFloor);
  acceptDialog = false;

  await page.locator('#save-project').click();
  await expect.poll(() => readStoredFloorType(page, projectName)).toBe('hali');
  expect(pageErrors).toEqual([]);
});
