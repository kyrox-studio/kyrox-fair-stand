import { test, expect } from '@playwright/test';
import JSZip from 'jszip';
import { PROJECT_ARCHIVE_VERSION } from '../src/projectImportValidation.js';

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

async function saveAndReadProject(page) {
  const saveButton = page.locator('#save-project');
  await saveButton.click();
  await expect(saveButton).toBeEnabled();
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

async function importZip(page, name, buffer) {
  await page.locator('#import-project-file').setInputFiles({
    name,
    mimeType: 'application/zip',
    buffer,
  });
}

test('geçerli ZIP içe aktarılır ve ada stand + free fridge state korunur', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/');

  const zip = new JSZip();
  zip.file('project.json', JSON.stringify({
    archiveVersion: PROJECT_ARCHIVE_VERSION,
    project: {
      id: 'e2e-valid-import',
      name: 'E2E Gecerli Import',
      version: PROJECT_ARCHIVE_VERSION,
      stand: {
        standType: 'island',
        xCm: 500,
        yCm: 500,
        itemKey: 'karolaj',
      },
      modules: [{
        id: 'e2e-valid-fridge',
        type: 'mini-fridge',
        itemKey: 'mini_fridge_avanti',
        placement: {
          wallId: 'free',
          xCm: 200,
          yCm: 200,
          zCm: 0,
          rotationZDeg: 0,
        },
      }],
    },
  }));
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  await importZip(page, 'valid-project.zip', buffer);

  await expect(page.locator('#project-status')).toContainText('İçe aktarıldı');
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  await expect(page.locator('#project-name-display')).toContainText('E2E Gecerli Import');

  const project = await saveAndReadProject(page);
  expect(project).not.toBeNull();
  expect(project.stand.standType).toBe('island');
  expect(project.stand.xCm).toBe(500);
  expect(project.stand.yCm).toBe(500);
  const fridge = project.modules.find((moduleState) => moduleState.itemKey === 'mini_fridge_avanti');
  expect(fridge).toBeTruthy();
  expect(fridge.placement.wallId).toBe('free');
  expect(fridge.placement.xCm).toBe(200);
  expect(fridge.placement.yCm).toBe(200);
  expect(pageErrors).toEqual([]);
});

test('desteklenmeyen archiveVersion içe aktarılmaz', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/');

  const zip = new JSZip();
  zip.file('project.json', JSON.stringify({
    archiveVersion: PROJECT_ARCHIVE_VERSION + 1,
    project: {
      id: 'e2e-unsupported-version',
      name: 'E2E Unsupported',
      version: PROJECT_ARCHIVE_VERSION + 1,
      stand: { standType: 'island', xCm: 500, yCm: 500, itemKey: 'karolaj' },
      modules: [],
    },
  }));
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  await importZip(page, 'unsupported-version.zip', buffer);

  await expect(page.locator('#project-status')).toContainText('Proje ZIP içe aktarılamadı');
  await expect(page.locator('#project-status')).toContainText('Desteklenmeyen proje paketi');
  await expect(page.locator('#viewport-empty')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('bozuk project.json uygulamayı düşürmez', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/');

  const zip = new JSZip();
  zip.file('project.json', '{not-json');
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  await importZip(page, 'malformed-project.zip', buffer);

  await expect(page.locator('#project-status')).toContainText('Proje ZIP içe aktarılamadı');
  await expect(page.locator('#viewport-empty')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('Kaydet → Dışarı Aktar → İçe Aktar proje kimliğini ve stand state’ini korur', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await createIslandStand(page, 'E2E Export Roundtrip');

  const before = await saveAndReadProject(page);
  expect(before).not.toBeNull();
  expect(before.stand.standType).toBe('island');

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-project').click();
  const download = await downloadPromise;
  await expect(page.locator('#project-status')).toContainText('Dışarı aktarıldı');

  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const exported = Buffer.concat(chunks);

  await importZip(page, download.suggestedFilename() || 'exported.zip', exported);
  await expect(page.locator('#project-status')).toContainText('İçe aktarıldı');
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  await expect(page.locator('#stage-result')).toContainText('Ada Stand · 500 × 500 cm');

  const after = await saveAndReadProject(page);
  expect(after.stand.standType).toBe(before.stand.standType);
  expect(after.stand.xCm).toBe(before.stand.xCm);
  expect(after.stand.yCm).toBe(before.stand.yCm);
  expect(after.stand.itemKey).toBe(before.stand.itemKey);
  expect(pageErrors).toEqual([]);
});
