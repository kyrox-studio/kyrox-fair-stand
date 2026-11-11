import { test, expect } from '@playwright/test';
import { clickProjectAction, disableAutoFurniture, savedProject } from './helpers/standSetup.mjs';

// Proje profil rengi (Gelişmiş mod, Yerleşim kartı): siyah seçilince bütün çerçeveler siyah çizilir,
// stand kaydına `profileFinish` yazılır, proje yeniden açılınca korunur ve Ctrl+Z ile geri döner.

async function exposeScene(page) {
  // Gerçek sahne durumunu üretime debug API eklemeden okur.
  await page.route('**/src/scene3d.js*', async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      '  let surfaceMeshes = [];',
      '  let surfaceMeshes = []; window.__sceneSurfaces = () => surfaceMeshes;',
    );
    await route.fulfill({ response, body });
  });
}

// Alınlık dikmelerinin (yalnız profil çerçevesi) malzeme renkleri.
function uprightColors(page) {
  return page.evaluate(() => [...new Set(window.__sceneSurfaces()
    .filter((mesh) => mesh.userData.moduleType === 'upright')
    .map((mesh) => `#${mesh.material.color.getHexString()}`))]);
}

async function showProfileFinishField(page) {
  await page.locator('#editor-mode-advanced').click();
  const standSetup = page.locator('details.stand-setup-card');
  if (!(await standSetup.evaluate((element) => element.open))) await standSetup.locator('summary').click();
  await expect(page.locator('#profile-finish-field')).toBeVisible();
}

test('profil rengi Gelişmiş moddan siyah yapılır; kayıt, yeniden açılış ve geri al korunur', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await exposeScene(page);
  await page.goto('/');
  await disableAutoFurniture(page);
  const dialog = page.getByRole('dialog', { name: 'Yeni proje sihirbazı' });
  await dialog.getByRole('button', { name: 'İleri →' }).click();
  await dialog.getByRole('button', { name: 'Sırt Duvar' }).click();
  await dialog.getByRole('button', { name: 'İleri →' }).click();
  await dialog.locator('#wizard-size-x').fill('4');
  await dialog.locator('#wizard-size-y').fill('3');
  await dialog.locator('#wizard-fascia').check();
  await dialog.getByRole('button', { name: 'İleri →' }).click();
  await dialog.getByRole('button', { name: 'Oluştur' }).click();
  await page.locator('form input[name="projectName"]').fill('E2E Profil Rengi');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();

  const field = page.locator('#profile-finish-field');
  const select = page.locator('#profile-finish');
  // Basit modda gizli, Gelişmiş modda Yerleşim kartında.
  await expect(field).toBeHidden();
  await showProfileFinishField(page);
  await expect(select).toHaveValue('default');

  const defaultColors = await uprightColors(page);
  expect(defaultColors).toHaveLength(1);
  expect(defaultColors[0]).not.toBe('#1c1c1e');
  expect((await savedProject(page)).stand.profileFinish).toBe('default');

  await select.selectOption('black');
  await expect.poll(() => uprightColors(page)).toEqual(['#1c1c1e']);
  const saved = await savedProject(page);
  expect(saved.stand.profileFinish).toBe('black');

  // Proje yeniden açılınca siyah kalır.
  await page.reload();
  await expect(page.locator('#viewport-empty')).toBeVisible();
  await page.locator('#project-select').evaluate((element, id) => { element.value = id; }, saved.id);
  await clickProjectAction(page, 'open-project');
  await expect(page.locator('#project-status')).toContainText('Açıldı:');
  await expect.poll(() => uprightColors(page)).toEqual(['#1c1c1e']);
  await expect(select).toHaveValue('black');

  // Sahneyi Sıfırla stand seçimlerini korur; profil rengi de bunlardandır.
  await page.locator('#clear-wall').evaluate((button) => button.click());
  await expect.poll(() => uprightColors(page)).toEqual(['#1c1c1e']);
  expect((await savedProject(page)).stand.profileFinish).toBe('black');

  // Geri al varsayılana döndürür.
  await showProfileFinishField(page);
  await select.selectOption('default');
  await expect.poll(() => uprightColors(page)).toEqual(defaultColors);
  await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.keyboard.press('Control+z');
  await expect.poll(() => uprightColors(page)).toEqual(['#1c1c1e']);
  await expect(select).toHaveValue('black');
  expect(errors).toEqual([]);
});
