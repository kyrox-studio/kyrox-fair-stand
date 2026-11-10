import { test, expect } from '@playwright/test';
import { disableAutoFurniture, keepWallLock, savedProject, createStageFromWizard } from './helpers/standSetup.mjs';

// Kurulu standda yerleşim değişimi (yeniden boyutlandırma motoru): bir şey kalkacaksa önizleme
// açılır, kalkmıyorsa hemen uygulanır; Uygula'da kalan duvar yerinde kalır, kalkan kenarın duvarı gider, yeni kenara boş duvar
// gelir; Vazgeç'te hiçbir şey değişmez; Geri al eski yerleşime döner.

function wallIds(project) {
  return [...new Set(project.modules
    .filter((module) => module.type === 'flat-panel' && !module.autoFascia
      && ['back', 'left', 'right'].includes(module.placement?.wallId))
    .map((module) => module.placement.wallId))].sort();
}

test('open stand: layout change previews, applies, saves and undoes', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'U Stand' }).click();
  await page.locator('#stand-size-x').fill('5');
  await page.locator('#stand-size-y').fill('4');
  await disableAutoFurniture(page);
  await createStageFromWizard(page);
  await page.locator('form input[name="projectName"]').fill('E2E Yerleşim Değişimi');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await keepWallLock(page);
  await expect(page.locator('#viewport-toolbar')).toBeVisible();

  const initial = await savedProject(page);
  expect(wallIds(initial)).toEqual(['back', 'left', 'right']);
  const dialog = page.getByRole('dialog', { name: /Yerleşim/ });
  const lStandLeft = standSetup.getByRole('button', { name: 'L Stand Sol' });

  // Vazgeç: yerleşim ve sahne değişmez.
  await lStandLeft.click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('U Stand → L Stand Sol');
  await expect(dialog).toContainText('Sağ duvar kalkacak');
  await dialog.getByRole('button', { name: 'İptal' }).click();
  await expect(dialog).toBeHidden();
  await expect(standSetup.getByRole('button', { name: 'U Stand' })).toHaveAttribute('aria-pressed', 'true');
  expect(wallIds(await savedProject(page))).toEqual(['back', 'left', 'right']);

  // Uygula: sağ duvar kalkar, sırt ve sol duvar aynı modüllerle kalır.
  await lStandLeft.click();
  await dialog.getByRole('button', { name: 'Uygula' }).click();
  await expect(dialog).toBeHidden();
  await expect(lStandLeft).toHaveAttribute('aria-pressed', 'true');
  const lLeft = await savedProject(page);
  expect(lLeft.stand.standType).toBe('l-left');
  expect(wallIds(lLeft)).toEqual(['back', 'left']);
  const keptIds = initial.modules
    .filter((module) => ['back', 'left'].includes(module.placement?.wallId))
    .map((module) => module.id);
  expect(keptIds.every((id) => lLeft.modules.some((module) => module.id === id))).toBe(true);

  // Sırt Duvar → U: yan kenarlara boş duvar gelir.
  await standSetup.getByRole('button', { name: 'Sırt Duvar' }).click();
  await dialog.getByRole('button', { name: 'Uygula' }).click();
  // Hiçbir şey kalkmıyor: pencere açılmadan uygulanır.
  await standSetup.getByRole('button', { name: 'U Stand' }).click();
  await expect(dialog).toBeHidden();
  await expect(standSetup.getByRole('button', { name: 'U Stand' })).toHaveAttribute('aria-pressed', 'true');
  expect(wallIds(await savedProject(page))).toEqual(['back', 'left', 'right']);

  // Ada: bütün kenar duvarları kalkar.
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await dialog.getByRole('button', { name: 'Uygula' }).click();
  const island = await savedProject(page);
  expect(island.stand.standType).toBe('island');
  expect(wallIds(island)).toEqual([]);

  // Geri al: U'ya döner.
  await page.locator('#design-undo').click();
  await expect(standSetup.getByRole('button', { name: 'U Stand' })).toHaveAttribute('aria-pressed', 'true');
  expect(wallIds(await savedProject(page))).toEqual(['back', 'left', 'right']);
  expect(errors).toEqual([]);
});

test('open stand: depot, depot contents, fascia and furniture change at once; removal asks first', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'U Stand' }).click();
  await page.locator('#stand-size-x').fill('6');
  await page.locator('#stand-size-y').fill('4');
  await disableAutoFurniture(page);
  await createStageFromWizard(page);
  await page.locator('form input[name="projectName"]').fill('E2E Yapı Ayarları');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await keepWallLock(page);
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  const dialog = page.getByRole('dialog');
  const count = (project, test) => project.modules.filter(test).length;

  // Depo ekle: sormaz.
  await page.locator('#auto-depot-size').selectOption('100x100');
  await expect(dialog).toBeHidden();
  let project = await savedProject(page);
  expect(project.stand.depot).toEqual({ enabled: true, sizeKey: '100x100', includeContents: false });
  expect(count(project, (module) => module.autoDepot)).toBeGreaterThan(0);

  // Ekipman ekle: sormaz; kaldır: sorar.
  await page.locator('#auto-depot-contents').check();
  await expect(dialog).toBeHidden();
  project = await savedProject(page);
  expect(count(project, (module) => module.type === 'mini-fridge')).toBe(1);
  await page.locator('#auto-depot-contents').uncheck();
  await expect(dialog).toContainText('depo ekipmanı kaldırılacak');
  await dialog.getByRole('button', { name: 'Uygula' }).click();
  project = await savedProject(page);
  expect(count(project, (module) => module.type === 'mini-fridge')).toBe(0);

  // Alınlık ekle: sormaz.
  await page.locator('#auto-fascia-rows').selectOption('1');
  await expect(dialog).toBeHidden();
  project = await savedProject(page);
  expect(count(project, (module) => module.autoFascia)).toBeGreaterThan(0);

  // Mobilya ekle: sormaz; kaldır: sorar, İptal'de kutu geri işaretlenir.
  await page.locator('#auto-furniture').check();
  await expect(dialog).toBeHidden();
  project = await savedProject(page);
  const withFurniture = project.modules.length;
  await page.locator('#auto-furniture').uncheck();
  await expect(dialog).toContainText('stand mobilyası kaldırılacak');
  await dialog.getByRole('button', { name: 'İptal' }).click();
  await expect(page.locator('#auto-furniture')).toBeChecked();
  await page.locator('#auto-furniture').uncheck();
  await dialog.getByRole('button', { name: 'Uygula' }).click();
  project = await savedProject(page);
  expect(project.modules.length).toBeLessThan(withFurniture);
  expect(project.stand.furniture).toEqual({ enabled: false });

  // Depoyu kaldır: sorar.
  await page.locator('#auto-depot-size').selectOption('');
  await expect(dialog).toContainText('Depo ve içindekiler kaldırılacak');
  await dialog.getByRole('button', { name: 'Uygula' }).click();
  project = await savedProject(page);
  expect(count(project, (module) => module.autoDepot)).toBe(0);

  await page.locator('#design-undo').click();
  await expect(page.locator('#auto-depot-size')).toHaveValue('100x100');
  expect(errors).toEqual([]);
});
