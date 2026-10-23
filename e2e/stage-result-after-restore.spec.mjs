import { test, expect } from '@playwright/test';
import JSZip from 'jszip';
import { PROJECT_ARCHIVE_VERSION } from '../src/projectImportValidation.js';

test('Aç sonrası #stage-result create-stage stand özetini gösterir', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('5');
  await page.locator('#stand-size-y').fill('5');
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill('E2E Stage Result Restore');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  await expect(page.locator('#stage-result')).toContainText('Ada Stand · 500 × 500 cm');

  await page.locator('#save-project').click();
  await expect(page.locator('#project-status')).toContainText('Kaydedildi:');
  const projectId = await page.locator('#project-select').inputValue();

  await page.reload();
  await expect(page.locator('#viewport-empty')).toBeVisible();
  await page.locator('#project-select').evaluate((select, id) => {
    select.value = id;
  }, projectId);
  await page.locator('#open-project').click();
  await expect(page.locator('#project-status')).toContainText('Açıldı:');
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  expect(pageErrors).toEqual([]);

  // Production bug reproducer: restoreProject toolbar’ı açar, #stage-result stale kalır.
  await expect(page.locator('#stage-result')).toContainText('Ada Stand · 500 × 500 cm');
});

test('geçerli import sonrası #stage-result create-stage stand özetini gösterir', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/');

  const zip = new JSZip();
  zip.file('project.json', JSON.stringify({
    archiveVersion: PROJECT_ARCHIVE_VERSION,
    project: {
      id: 'e2e-stage-result-import',
      name: 'E2E Stage Result Import',
      version: PROJECT_ARCHIVE_VERSION,
      stand: { standType: 'island', xCm: 500, yCm: 500, itemKey: 'karolaj' },
      modules: [],
    },
  }));
  await page.locator('#import-project-file').setInputFiles({
    name: 'stage-result-import.zip',
    mimeType: 'application/zip',
    buffer: await zip.generateAsync({ type: 'nodebuffer' }),
  });
  await expect(page.locator('#project-status')).toContainText('İçe aktarıldı');
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  expect(pageErrors).toEqual([]);

  await expect(page.locator('#stage-result')).toContainText('Ada Stand · 500 × 500 cm');
});

test('geçersiz import #stage-result’a success yazmaz', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#stage-result')).toContainText(
    'Stand tipi ile X ve Y ölçülerinin üçü de tamamlanmadan sahne oluşmaz.',
  );

  const zip = new JSZip();
  zip.file('project.json', JSON.stringify({
    archiveVersion: PROJECT_ARCHIVE_VERSION,
    project: {
      id: 'e2e-stage-result-invalid',
      name: 'E2E Stage Result Invalid',
      version: PROJECT_ARCHIVE_VERSION,
      modules: [{ id: 'm1', type: 'not-a-module' }],
    },
  }));
  await page.locator('#import-project-file').setInputFiles({
    name: 'invalid-stage-result.zip',
    mimeType: 'application/zip',
    buffer: await zip.generateAsync({ type: 'nodebuffer' }),
  });
  await expect(page.locator('#project-status')).toContainText('Proje ZIP içe aktarılamadı');
  await expect(page.locator('#viewport-empty')).toBeVisible();
  await expect(page.locator('#stage-result')).toHaveText(
    'Stand tipi ile X ve Y ölçülerinin üçü de tamamlanmadan sahne oluşmaz.',
  );
  expect(pageErrors).toEqual([]);
});
