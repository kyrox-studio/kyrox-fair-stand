import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('project import validates and prepares archive before saving', () => {
  const handlerStart = source.indexOf("importProjectFileInput.addEventListener('change'");
  const handlerEnd = source.indexOf("openProjectButton.addEventListener('click'", handlerStart);
  assert.ok(handlerStart >= 0 && handlerEnd > handlerStart);
  const handler = source.slice(handlerStart, handlerEnd);

  assert.match(handler, /validateProjectArchiveManifest/);
  assert.match(handler, /validateImportedAssetRecord/);
  assert.match(handler, /const preparedAssets = \[\]/);
  assert.match(handler, /entry\.async\('blob'\)/);
  assert.ok(handler.indexOf("entry.async('blob')") < handler.indexOf('await saveProject(importedProject,'));
  // Remote SoT: local assets must exist before saveProject so dirty sync can upload them.
  assert.ok(
    handler.indexOf('await saveImportedImageAsset(importedProjectId, asset)')
      < handler.indexOf('await saveProject(importedProject,'),
  );
  assert.match(handler, /markAssetDirty\(importedProjectId, asset\.id\)/);
});

test('failed import rolls back project and assets atomically', () => {
  const handlerStart = source.indexOf("importProjectFileInput.addEventListener('change'");
  const handlerEnd = source.indexOf("openProjectButton.addEventListener('click'", handlerStart);
  const handler = source.slice(handlerStart, handlerEnd);

  assert.match(handler, /importStorageTouched/);
  assert.match(handler, /await deleteProjectWithAssets\(importedProjectId\)/);
  assert.doesNotMatch(handler, /deleteProjectImageAssets\(importedProjectId\)/);
  assert.doesNotMatch(handler, /await deleteProject\(importedProjectId\)/);
  assert.match(handler, /error\?\.message/);
});

test('project import remaps every persisted image-reference field before saving', () => {
  assert.match(source, /remapImageAssetReferences/);
  assert.doesNotMatch(source, /key === 'imageAssetId'/);
});

test('import without any customer shows guidance instead of a raw API error', () => {
  const handlerStart = source.indexOf("importProjectFileInput.addEventListener('change'");
  const handlerEnd = source.indexOf("openProjectButton.addEventListener('click'", handlerStart);
  const handler = source.slice(handlerStart, handlerEnd);
  assert.match(source, /const IMPORT_REQUIRES_CUSTOMER_MESSAGE = 'İçe aktarmak için proje bir müşteriye bağlı olmalı: Müşteriler → müşteri → Yeni Proje/);
  assert.match(handler, /if \(isProjectRemoteEnabled\(\) && !\(manifest\.project\.customerId \|\| activeCustomerId\)\) \{/);
  assert.match(handler, /projectStatus\.textContent = IMPORT_REQUIRES_CUSTOMER_MESSAGE;/);
  // Kontrol depolamaya dokunmadan önce yapılır; geri alınacak bir şey kalmaz.
  assert.ok(handler.indexOf('IMPORT_REQUIRES_CUSTOMER_MESSAGE') < handler.indexOf('importStorageTouched = true'));
  assert.ok(handler.indexOf('IMPORT_REQUIRES_CUSTOMER_MESSAGE') < handler.indexOf('await saveProject(importedProject,'));
});

test('restored project reports images whose files could not be loaded', () => {
  const restoreStart = source.indexOf('async function restoreProject');
  const restore = source.slice(restoreStart, source.indexOf('async function selectRevision', restoreStart));
  assert.ok(restore.indexOf('await loadAssetsForActiveProject();') < restore.indexOf('const missingImageCount = countMissingImageReferences();'));
  assert.match(restore, /'Açıldı: ' \+ \(project\.name \|\| 'Adsız Proje'\) \+ missingImageNotice\(missingImageCount\)/);
  assert.match(source, /collectImageAssetReferenceIds\(\[currentModules, currentStand\]\)/);
  assert.match(source, /görsel bulunamadı, ilgili yüzeyler kendi rengiyle gösteriliyor/);
});
