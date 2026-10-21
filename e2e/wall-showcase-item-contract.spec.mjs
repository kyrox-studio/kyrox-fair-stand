import { test, expect } from '@playwright/test';
import { installModuleUnlockFixture, unlockModuleForFixture } from './helpers/module-lock-fixture.mjs';

test.beforeEach(async ({ page }) => installModuleUnlockFixture(page));

async function createStand(page) {
  await page.goto('/');
  const setup = page.locator('details.stand-setup-card');
  await setup.locator('summary').click();
  await setup.getByRole('button', { name: 'Sırt Duvar' }).click();
  await page.locator('#stand-size-x').fill('500');
  await page.locator('#stand-size-y').fill('500');
  await page.locator('#create-stage').click();
  const input = page.locator('form input[name="projectName"]');
  await expect(input).toBeVisible();
  await input.fill('Wall Showcase Contract');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
}

async function saveAndReadProject(page) {
  const save = page.locator('#save-project');
  await save.click();
  await expect(save).toBeEnabled();
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
    return projects.sort((a,b) => Number(b.updatedAt||0)-Number(a.updatedAt||0))[0] ?? null;
  });
}

async function removeModules(page, modules) {
  for (const moduleState of modules) {
    await unlockModuleForFixture(page, moduleState);
    page.once('dialog', async (dialog) => dialog.accept());
    await page.evaluate((moduleId) => {
      window.dispatchEvent(new CustomEvent('fair-stand:delete-selected-module', {
        detail: { moduleId },
      }));
    }, moduleState.id);
  }
}

test('wall showcase catalog Items persist canonical identity and grouped body color state', async ({ page }) => {
  const errors=[]; page.on('pageerror', (error)=>errors.push(error.message));
  await createStand(page);

  // Otomatik 500 cm sırt duvarı baştan dolu. Katalog eklemeden önce gerçek silme
  // yoluyla tam iki 100 cm slot boşalt; yoksa picker kapasite hatasında açık kalır.
  const initialProject = await saveAndReadProject(page);
  expect(initialProject).not.toBeNull();
  expect(initialProject.modules.length).toBeGreaterThanOrEqual(2);
  // Ekleme planı kalan duvarı da kaydırabilir; düzenlenecek zincirin kilidini aç.
  for (const moduleState of initialProject.modules) await unlockModuleForFixture(page, moduleState);
  await removeModules(page, initialProject.modules.slice(0, 2));

  const open = page.locator('#open-module-catalog');
  const panel = page.locator('details', { has: open });
  await panel.locator(':scope > summary').click();
  await open.click();
  const picker=page.locator('.module-picker-backdrop');
  await expect(picker).toBeVisible();
  await picker.locator('summary', { hasText: 'Raf & Vitrin' }).click();
  await picker.locator('[data-module-key="wall_showcase_100_2_350"]').click();
  await picker.locator('[data-module-key="wall_showcase_100_3_350"]').click();
  await picker.locator('.module-picker-add').click();
  await expect(picker).toBeHidden();
  const project=await saveAndReadProject(page);
  const two=project.modules.find((m)=>m.itemKey==='wall_showcase_100_2_350');
  const three=project.modules.find((m)=>m.itemKey==='wall_showcase_100_3_350');
  expect(two).toBeTruthy(); expect(three).toBeTruthy();
  expect(two.itemKey).toBe('wall_showcase_100_2_350');
  expect(three.itemKey).toBe('wall_showcase_100_3_350');
  expect(two.bodySurface.color).toBe('#ffffff');
  expect(three.bodySurface.color).toBe('#ffffff');
  expect(two.eyeCount).toBe(2); expect(three.eyeCount).toBe(3);
  expect(errors).toEqual([]);
});
