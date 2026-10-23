import { test, expect } from '@playwright/test';

async function seedProjectsAndAssets(page) {
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('fair-stand-configurator', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const now = Date.now();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['projects', 'image-assets'], 'readwrite');
      const projects = tx.objectStore('projects');
      const assets = tx.objectStore('image-assets');

      projects.put({
        id: 'f023-target-project',
        name: 'F023 Silinecek',
        version: 1,
        createdAt: now,
        updatedAt: now + 10,
        stand: null,
        modules: [],
      });
      projects.put({
        id: 'f023-survivor-project',
        name: 'F023 Kalacak',
        version: 1,
        createdAt: now,
        updatedAt: now,
        stand: null,
        modules: [],
      });

      assets.put({
        id: 'f023-target-asset',
        projectId: 'f023-target-project',
        name: 'target.png',
        type: 'image/png',
        blob: new Blob(['target'], { type: 'image/png' }),
        createdAt: now,
      });
      assets.put({
        id: 'f023-survivor-asset',
        projectId: 'f023-survivor-project',
        name: 'survivor.png',
        type: 'image/png',
        blob: new Blob(['survivor'], { type: 'image/png' }),
        createdAt: now,
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  });
}

async function readStoredIds(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('fair-stand-configurator', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const [projects, assets] = await Promise.all([
      new Promise((resolve, reject) => {
        const tx = db.transaction('projects', 'readonly');
        const request = tx.objectStore('projects').getAll();
        request.onsuccess = () => resolve(request.result ?? []);
        request.onerror = () => reject(request.error);
      }),
      new Promise((resolve, reject) => {
        const tx = db.transaction('image-assets', 'readonly');
        const request = tx.objectStore('image-assets').getAll();
        request.onsuccess = () => resolve(request.result ?? []);
        request.onerror = () => reject(request.error);
      }),
    ]);

    db.close();
    return {
      projectIds: projects.map((project) => project.id),
      assetIds: assets.map((asset) => asset.id),
    };
  });
}

test('deleting a project removes its record and assets without touching another project', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await seedProjectsAndAssets(page);
  await page.reload();

  const projectSelect = page.locator('#project-select');
  await expect(projectSelect.locator('option')).toHaveCount(2);
  await projectSelect.evaluate((select) => {
    select.value = 'f023-target-project';
  });
  await expect(projectSelect).toHaveValue('f023-target-project');

  page.once('dialog', async (dialog) => dialog.accept());
  await page.locator('#delete-project').click();
  await expect(page.locator('#project-status')).toHaveText('Proje silindi.');

  const stored = await readStoredIds(page);
  expect(stored.projectIds).not.toContain('f023-target-project');
  expect(stored.assetIds).not.toContain('f023-target-asset');
  expect(stored.projectIds).toContain('f023-survivor-project');
  expect(stored.assetIds).toContain('f023-survivor-asset');
  expect(pageErrors).toEqual([]);
});

test('deleting the open project returns to the first-open empty scene without a page reload', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('5');
  await page.locator('#stand-size-y').fill('5');
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill('F023 Open Delete');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  await expect(page.locator('#project-status')).toContainText('Oluşturuldu ve kaydedildi');

  let loadCount = 0;
  page.on('load', () => {
    loadCount += 1;
  });

  page.once('dialog', async (dialog) => dialog.accept());
  await page.locator('#delete-project').click();

  await expect(page.locator('#viewport-empty')).toBeVisible();
  await expect(page.locator('#viewport-toolbar')).toBeHidden();
  await expect(page.locator('#project-name-display')).toHaveText('Adsız Proje');
  await expect(page.locator('#project-status')).toHaveText('Aktif proje henüz kaydedilmedi.');
  await expect(page.locator('#create-stage')).toBeDisabled();
  expect(loadCount).toBe(0);
  expect(pageErrors).toEqual([]);
});
