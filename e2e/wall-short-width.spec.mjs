import { test, expect } from '@playwright/test';
import { chooseCatalogWidth } from './helpers/catalogWidth.mjs';

// Kısa panel katalogda Tek Sıra / Çift Sıra için birer kartla gelir (migration 0079); kart 100 cm
// bırakılır, genişlik Özellikler panelinden seçilir ve seçilen genişliğin Item'ıyla kaydedilir (0086). Sağ tık başlığı
// sahnedeki öğenin kendi adını yazar (gizli genişlik / dikme boyu "Modül" görünmez).

async function exposeScene(page) {
  await page.route('**/src/scene3d.js*', async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace(
        'const controls = new OrbitControls(camera, renderer.domElement);',
        'const controls = new OrbitControls(camera, renderer.domElement); window.__sceneCamera = camera;',
      )
      .replace('  let surfaceMeshes = [];', '  let surfaceMeshes = []; window.__sceneSurfaces = () => surfaceMeshes;');
    await route.fulfill({ response, body });
  });
}

function readLatestProject(page) {
  return page.evaluate(async () => {
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
    return projects.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0] ?? null;
  });
}

async function saveAndReadProject(page) {
  await page.locator('#save-project').click();
  await expect(page.locator('#save-project')).toBeEnabled();
  return readLatestProject(page);
}

async function createIslandProject(page, name, modules) {
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('5');
  await page.locator('#stand-size-y').fill('5');
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill(name);
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  await page.locator('#save-project').click();
  await expect(page.locator('#save-project')).toBeEnabled();
  const projectId = await page.evaluate(async (specs) => {
    const designState = await import('/src/designState.js');
    const placement = await import('/src/modulePlacement.js');
    const built = specs.map(({ itemKey, place }) => {
      const state = designState.createModuleStateFromCatalogKey(itemKey);
      state.placement = placement.createModulePlacement(place);
      return state;
    });
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('fair-stand-configurator', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const projects = await new Promise((resolve) => {
      const request = db.transaction('projects', 'readonly').objectStore('projects').getAll();
      request.onsuccess = () => resolve(request.result ?? []);
    });
    const project = projects.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0];
    project.modules = built;
    project.updatedAt = Date.now();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      tx.objectStore('projects').put(project);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return project.id;
  }, modules);
  await page.reload();
  await page.locator('#project-select').evaluate((select, id) => { select.value = id; }, projectId);
  await page.locator('#open-project').click();
  await expect(page.locator('#project-status')).toContainText('Açıldı:');
}

function moduleScreenPoint(page, moduleId) {
  return page.evaluate((id) => {
    const surface = window.__sceneSurfaces().find((mesh) => mesh.userData.moduleId === id);
    const canvas = document.querySelector('#viewport > canvas').getBoundingClientRect();
    surface.updateMatrixWorld(true);
    surface.geometry.computeBoundingBox();
    const box = surface.geometry.boundingBox.clone().applyMatrix4(surface.matrixWorld);
    const center = box.getCenter(surface.position.clone()).project(window.__sceneCamera);
    return {
      x: canvas.left + ((center.x + 1) / 2) * canvas.width,
      y: canvas.top + ((1 - center.y) / 2) * canvas.height,
    };
  }, moduleId);
}

async function dropCatalogCard(page, itemKey) {
  // Ana görünüm: önceki bırakma kamerayı öğeye yaklaştırabilir.
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

test('kısa panel kartı tek; genişlik panelden seçilir, seçilen genişliğin Item’ıyla kaydedilir', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await exposeScene(page);
  await createIslandProject(page, 'E2E Kısa Panel Genişliği', []);

  const open = page.locator('.module-drag-catalog');
  await page.locator('details', { has: open }).locator(':scope > summary').click();
  const card = page.locator('.module-drag-card[data-module-key="wall_100_short_1"]').first();
  const group = page.locator('.module-drag-group', { has: card });
  if (!(await group.getAttribute('open'))) await group.locator(':scope > summary').click();
  // Kart başlığı ölçüsüzdür.
  await expect(card.locator('strong')).toHaveText('Panel Tek Sıra');
  await expect(page.locator('.module-drag-card[data-module-key="wall_100_short_2"] strong')).toHaveText('Panel Çift Sıra');
  // Diğer genişliklerin kartı yoktur.
  for (const itemKey of ['wall_50_short_1', 'wall_150_short_1', 'wall_200_short_1', 'wall_50_short_2', 'wall_150_short_2', 'wall_200_short_2']) {
    await expect(page.locator(`.module-drag-card[data-module-key="${itemKey}"]`)).toHaveCount(0);
  }

  // Bırakınca pencere açılmaz; öğe seçilir ve panelde yalnız Tek Sıra'nın 4 genişliği görünür.
  await dropCatalogCard(page, 'wall_100_short_1');
  await expect(page.locator('.item-size-dialog')).toHaveCount(0);
  const variants = page.locator('.selection-property-variants');
  await expect(variants.locator('.selection-property-variant')).toHaveText(['50 cm', '100 cm', '150 cm', '200 cm']);
  await expect(variants.locator('[data-variant-key="wall_100_short_1"]')).toHaveAttribute('aria-pressed', 'true');
  await chooseCatalogWidth(page, 'wall_200_short_1');
  let project = await saveAndReadProject(page);
  expect(project.modules.map((module) => [module.itemKey, module.widthCm])).toEqual([['wall_200_short_1', 200]]);

  // Sağ tık başlığı seçilen genişliğin adını yazar.
  const menu = page.getByRole('menu', { name: 'Modül işlemleri' });
  const placed = await moduleScreenPoint(page, project.modules[0].id);
  await page.mouse.click(placed.x, placed.y, { button: 'right' });
  await expect(menu.locator('.module-context-title')).toContainText('Panel Tek Sıra 200');
  await page.keyboard.press('Escape');

  // Çift Sıra kartı da varsayılan 100 ile konur; panelde Çift Sıra genişlikleri görünür.
  await dropCatalogCard(page, 'wall_100_short_2');
  await expect(variants.locator('.selection-property-variant')).toHaveCount(4);
  await expect(variants.locator('[data-variant-key="wall_100_short_2"]')).toHaveAttribute('aria-pressed', 'true');
  project = await saveAndReadProject(page);
  expect(project.modules.map((module) => module.itemKey).sort()).toEqual(['wall_100_short_2', 'wall_200_short_1']);
  expect(errors).toEqual([]);
});

test('boy penceresinden gelen dikmede sağ tık başlığı dikmenin kendi adını yazar', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await exposeScene(page);
  await createIslandProject(page, 'E2E Dikme Başlığı', []);
  await page.evaluate(() => localStorage.removeItem('fairStand.uprightHeightItemKey'));

  const open = page.locator('.module-drag-catalog');
  await page.locator('details', { has: open }).locator(':scope > summary').click();
  const card = page.locator('.module-drag-card[data-module-key="upright_346_5"]').first();
  const group = page.locator('.module-drag-group', { has: card });
  if (!(await group.getAttribute('open'))) await group.locator(':scope > summary').click();

  const dialog = page.getByRole('dialog', { name: 'Dikme yüksekliği' });
  await dropCatalogCard(page, 'upright_346_5');
  await expect(dialog).toBeVisible();
  // Kart dışındaki (katalogda gizli) bir boy seçilir.
  const option = dialog.locator('option:not([value="upright_346_5"])').first();
  const itemKey = await option.getAttribute('value');
  await dialog.locator('select').selectOption(itemKey);
  await dialog.getByRole('button', { name: 'Uygula' }).click();
  await expect(dialog).toBeHidden();
  const project = await saveAndReadProject(page);
  expect(project.modules.map((module) => module.itemKey)).toEqual([itemKey]);
  const name = await page.evaluate(async (key) => (await import('/src/items.js')).getItem(key)?.name ?? null, itemKey);

  const placed = await moduleScreenPoint(page, project.modules[0].id);
  await page.mouse.click(placed.x, placed.y, { button: 'right' });
  const title = page.getByRole('menu', { name: 'Modül işlemleri' }).locator('.module-context-title');
  await expect(title).toContainText(String(name));
  await expect(title).not.toContainText(' · Modül');
  expect(errors).toEqual([]);
});
