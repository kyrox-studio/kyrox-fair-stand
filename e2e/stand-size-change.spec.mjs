import { test, expect } from '@playwright/test';
import { disableAutoFurniture, keepWallLock, savedProject, createStageFromWizard } from './helpers/standSetup.mjs';

// Kurulu standda genişlik / derinlik (yeniden boyutlandırma motoru): önizleme onaylanınca
// sırt duvarı açık uçtan uzar / kısalır, stand kaydedilir, Geri al eski ölçüye döndürür;
// vazgeçilirse ölçü alanı eski değere döner.

async function createBackWallStand(page, projectName) {
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Sırt Duvar' }).click();
  await page.locator('#stand-size-x').fill('5');
  await page.locator('#stand-size-y').fill('4');
  await disableAutoFurniture(page);
  await createStageFromWizard(page);
  await page.locator('form input[name="projectName"]').fill(projectName);
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await keepWallLock(page);
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
}

function backWallLength(project) {
  return project.modules
    .filter((module) => module.type === 'flat-panel' && module.placement?.wallId === 'back')
    .reduce((sum, module) => sum + Number(module.widthCm), 0);
}

async function changeWidth(page, meters) {
  const input = page.locator('#stand-size-x');
  await input.fill(meters);
  await input.press('Enter');
}

test('open stand: width change applies at once, asks only when something is removed, saves and undoes', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await createBackWallStand(page, 'E2E Ölçü Değişimi');
  const initial = await savedProject(page);
  expect(backWallLength(initial)).toBe(500);

  // Önizleme uygulamanın kendi penceresidir (tarayıcı confirm'i değil); yalnız bir şey kalkacaksa açılır.
  const dialog = page.getByRole('dialog', { name: /Stand ölçüsü/ });
  const widthUp = page.getByRole('button', { name: 'Genişliği 1 m artır' });

  // ▲: pencere açılmadan 1 m büyür.
  await widthUp.click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('#stand-size-x')).toHaveValue('6');
  await expect(page.locator('#stand-summary-chip')).toContainText('6 × 4 m');

  // Elle 0,5 m adımlı değer yazılır; ▲ ondan 1 m ileri gider.
  await changeWidth(page, '6,5');
  await expect(page.locator('#stand-summary-chip')).toContainText('6,5 × 4 m');
  await widthUp.click();
  await expect(page.locator('#stand-size-x')).toHaveValue('7,5');
  await expect(page.locator('#stand-summary-chip')).toContainText('7,5 × 4 m');

  // Yazıp Enter: büyütmede de pencere açılmaz; sırt duvarı yeni genişliği kaplar.
  await changeWidth(page, '8');
  await expect(dialog).toBeHidden();
  await expect(page.locator('#stand-summary-chip')).toContainText('8 × 4 m');
  const widened = await savedProject(page);
  expect(widened.stand.xCm).toBe(800);
  expect(backWallLength(widened)).toBe(800);
  // Paneller ve öğeler kalır; boyu değişen sırt duvarın projektörleri kurulum kuralıyla yeniden dizilir
  // (150 cm başına bir, yukarı yuvarlanır: 800 cm → 6).
  const initialIds = initial.modules.filter((module) => module.type !== 'led-floodlight').map((module) => module.id);
  expect(initialIds.every((id) => widened.modules.some((module) => module.id === id))).toBe(true);
  expect(widened.modules.filter((module) => module.type === 'led-floodlight' && module.placement?.wallId === 'back')).toHaveLength(6);

  // Daraltma panel kaldırır: önce sorar. İptal'de ölçü eski değere döner.
  await changeWidth(page, '3');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('8 × 4 m → 3 × 4 m');
  await expect(dialog).toContainText('duvar paneli kaldırılacak');
  await dialog.getByRole('button', { name: 'İptal' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('#stand-size-x')).toHaveValue('8');
  await expect(page.locator('#stand-summary-chip')).toContainText('8 × 4 m');

  await changeWidth(page, '3');
  await dialog.getByRole('button', { name: 'Uygula' }).click();
  await expect(page.locator('#stand-summary-chip')).toContainText('3 × 4 m');
  const narrowed = await savedProject(page);
  expect(backWallLength(narrowed)).toBe(300);

  await page.locator('#design-undo').click();
  await expect(page.locator('#stand-summary-chip')).toContainText('8 × 4 m');
  await expect(page.locator('#stand-size-x')).toHaveValue('8');
  expect(errors).toEqual([]);
});
