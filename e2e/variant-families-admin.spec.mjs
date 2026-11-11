import { test, expect } from '@playwright/test';
import { createStageFromWizard } from './helpers/standSetup.mjs';

// 0095: varyant ailesi CRM admin'den yönetilir; editör aile tanımını bootstrap `variantFamilies`
// kaydından okur. Admin'de değişen başlık / kart adı / üyelik, katalog kartına, Özellikler
// panelindeki varyant düğmelerine ve profil boy penceresine yansır. Arşivdeki aile gönderilmez;
// üyeleri ailesiz (tek başına) davranır.

async function routeBootstrap(page, edit) {
  await page.route('**/api/v1/fair-stand/catalog/bootstrap', async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    edit(payload);
    await route.fulfill({ response, json: payload });
  });
}

async function createIslandStage(page, name) {
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('5');
  await page.locator('#stand-size-y').fill('5');
  await createStageFromWizard(page);
  await page.locator('form input[name="projectName"]').fill(name);
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  const open = page.locator('.module-drag-catalog');
  await page.locator('details', { has: open }).locator(':scope > summary').click();
}

async function openCardGroup(page, itemKey) {
  const card = page.locator(`.module-drag-card[data-module-key="${itemKey}"]`).first();
  const group = page.locator('.module-drag-group', { has: card });
  if (!(await group.getAttribute('open'))) await group.locator(':scope > summary').click();
  return card;
}

async function dropCatalogCard(page, itemKey) {
  await page.locator('#viewport > canvas').focus().catch(() => {});
  await page.keyboard.press('h');
  await page.waitForTimeout(400);
  await page.evaluate((key) => {
    const card = document.querySelector(`.module-drag-card[data-module-key="${key}"]`);
    const viewport = document.querySelector('#viewport');
    const canvas = viewport?.querySelector(':scope > canvas');
    if (!card || !viewport || !canvas) throw new Error('katalog kartı veya viewport yok');
    const dataTransfer = new DataTransfer();
    card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer }));
    const fire = (type, xRatio, yRatio) => {
      const rect = viewport.getBoundingClientRect();
      viewport.dispatchEvent(new DragEvent(type, {
        bubbles: true, cancelable: true, dataTransfer,
        clientX: rect.left + rect.width * xRatio,
        clientY: rect.top + rect.height * yRatio,
      }));
    };
    for (let x = 0.3; x <= 0.8; x += 0.05) {
      for (let y = 0.35; y <= 0.85; y += 0.05) {
        fire('dragover', x, y);
        if (canvas.dataset.placementGhost === 'valid') {
          fire('drop', x, y);
          card.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer }));
          return;
        }
      }
    }
    throw new Error(`geçerli ghost bulunamadı: ${canvas.dataset.placementGhost ?? 'yok'}`);
  }, itemKey);
}

test('admin ailesi: başlık, kart adı ve üyelik editöre yansır', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await routeBootstrap(page, (payload) => {
    const panel = payload.variantFamilies.find((family) => family.key === 'wall-panel');
    Object.assign(panel, { title: 'Panel ölçüsü (E2E)', tabLabel: 'Ölçü', cardLabel: 'Duvar Paneli' });
    payload.variantFamilies.find((family) => family.key === 'profile').title = 'Profil uzunluğu (E2E)';
    // profile_388 aileden çıkarıldı (admin'de Varyant alanı boşaltıldı).
    payload.items.find((item) => item.itemKey === 'profile_388').variant = null;
  });
  await page.addInitScript(() => localStorage.removeItem('fairStand.profileLengthItemKey'));
  await createIslandStage(page, 'E2E Varyant Aileleri');

  const panelCard = await openCardGroup(page, 'wall_100_350');
  await expect(panelCard.locator('strong')).toHaveText('Duvar Paneli');
  await dropCatalogCard(page, 'wall_100_350');
  const variants = page.locator('.selection-property-variants');
  await expect(variants).toBeVisible();
  await expect(variants.locator('.selection-property-variant-header')).toContainText('Panel ölçüsü (E2E)');
  await expect(variants.locator('.selection-property-variant')).toHaveText(['50 cm', '100 cm', '150 cm', '200 cm']);

  await openCardGroup(page, 'profile_289');
  await dropCatalogCard(page, 'profile_289');
  const dialog = page.getByRole('dialog', { name: 'Profil uzunluğu (E2E)' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('option[value="profile_388"]')).toHaveCount(0);
  await expect(dialog.locator('option[value="profile_487"]')).toHaveCount(1);
  await dialog.getByRole('button', { name: 'İptal' }).click();
  expect(errors).toEqual([]);
});

test('arşivdeki aile gönderilmez: kart Item adını yazar, panelde varyant düğmesi yok', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await routeBootstrap(page, (payload) => {
    payload.variantFamilies = payload.variantFamilies.filter((family) => family.key !== 'wall-panel');
  });
  await createIslandStage(page, 'E2E Arşiv Aile');

  const panelCard = await openCardGroup(page, 'wall_100_350');
  await expect(panelCard.locator('strong')).toHaveText('Panel 100');
  await dropCatalogCard(page, 'wall_100_350');
  // Öğe tek başına konur (kart Item'ı); varyant düğmesi çıkmaz.
  await page.locator('#save-project').click();
  await expect(page.locator('#save-project')).toBeEnabled();
  const itemKeys = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('fair-stand-configurator', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const projects = await new Promise((resolve) => {
      const request = db.transaction('projects', 'readonly').objectStore('projects').getAll();
      request.onsuccess = () => resolve(request.result ?? []);
    });
    db.close();
    const latest = projects.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0];
    return latest.modules.map((module) => module.itemKey);
  });
  expect(itemKeys).toContain('wall_100_350');
  await expect(page.locator('.selection-property-variant')).toHaveCount(0);
  expect(errors).toEqual([]);
});
