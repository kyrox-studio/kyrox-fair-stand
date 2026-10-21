import { test, expect } from '@playwright/test';

// Profil ↑/↓ ile dikey taşınır ve zemin/tavan uzaklığı gösterilir; dikme bırakılırken boy
// sorulur, "Bir daha sorma" işaretlenince sorulmaz, sağ tık "Dikme yüksekliği…" çentiği kaldırır.

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
  await page.locator('#stand-size-x').fill('500');
  await page.locator('#stand-size-y').fill('500');
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

test('profil ↑/↓ ile dikey taşınır; zemin ve tavan uzaklığı gösterilir', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await exposeScene(page);
  await createIslandProject(page, 'E2E Profil Dikey', [
    { itemKey: 'profile_190', place: { xCm: 150, yCm: 250, zCm: 200, rotationZDeg: 0, wallId: 'free' } },
  ]);
  const profile = (await readLatestProject(page)).modules[0];
  const point = await moduleScreenPoint(page, profile.id);
  await page.mouse.dblclick(point.x, point.y);

  // Ölçüler sahne ölçüsünden (sceneDimensions): profile_190 sahnede 200 cm; dikey öğede zemin ve tavan uzaklığı.
  const sceneWidthCm = await page.evaluate(async () => {
    const items = await import('/src/items.js');
    return items.resolveSceneDimensions(items.getItem('profile_190')).widthCm;
  });
  expect(sceneWidthCm).toBe(200);
  await expect(page.locator('.scene-measure-label.is-size').first()).toHaveText(`${sceneWidthCm} cm`);
  await expect(page.locator('.scene-measure-label.is-height')).toHaveCount(2);
  const before = await page.locator('.scene-measure-label.is-height').allTextContents();
  expect(before[0]).toBe('2.00 m');

  await page.keyboard.press('ArrowUp');
  const moved = await saveAndReadProject(page);
  expect(moved.modules[0].placement.zCm).toBe(210);
  await expect(page.locator('.scene-measure-label.is-height').first()).toHaveText('2.10 m');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  const lowered = await saveAndReadProject(page);
  expect(lowered.modules[0].placement.zCm).toBe(190);
  expect(errors).toEqual([]);
});

test('dikme boyu sorulur; "Bir daha sorma" hatırlanır; sağ tık çentiği kaldırır', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await exposeScene(page);
  await createIslandProject(page, 'E2E Dikme Boyu', []);
  await page.evaluate(() => localStorage.removeItem('fairStand.uprightHeightItemKey'));

  const open = page.locator('#open-module-catalog');
  await page.locator('details', { has: open }).locator(':scope > summary').click();
  const card = page.locator('.module-drag-card[data-module-key="upright_346_5"]').first();
  const group = page.locator('.module-drag-group', { has: card });
  if (!(await group.getAttribute('open'))) await group.locator(':scope > summary').click();

  const dialog = page.getByRole('dialog', { name: 'Dikme yüksekliği' });
  await dropCatalogCard(page, 'upright_346_5');
  await expect(dialog).toBeVisible();
  // Varsayılan seçili duvarın (350) dikmesi; çentik boş.
  await expect(dialog.locator('select')).toHaveValue('upright_346_5');
  await expect(dialog.getByRole('checkbox')).not.toBeChecked();
  await dialog.locator('select').selectOption('upright_297');
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Uygula' }).click();
  await expect(dialog).toBeHidden();
  let project = await saveAndReadProject(page);
  expect(project.modules.map((module) => module.itemKey)).toEqual(['upright_297']);
  // Sahnede dikme duvar hattı boyunda çizilir (sceneDimensions): upright_297 → 300 cm.
  expect(project.modules[0].heightCm).toBe(300);

  // İkinci dikme sormadan 297 gelir.
  await dropCatalogCard(page, 'upright_346_5');
  await expect.poll(async () => (await saveAndReadProject(page)).modules.length).toBe(2);
  await expect(dialog).toBeHidden();
  project = await readLatestProject(page);
  expect(project.modules.map((module) => module.itemKey)).toEqual(['upright_297', 'upright_297']);

  // Sağ tık: pencere çentikli açılır; çentik kaldırılıp 346,5 seçilir.
  const first = await moduleScreenPoint(page, project.modules[0].id);
  await page.mouse.click(first.x, first.y, { button: 'right' });
  const menu = page.getByRole('menu', { name: 'Modül işlemleri' });
  await menu.locator('[data-module-action="upright-height"]').click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('select')).toHaveValue('upright_297');
  await expect(dialog.getByRole('checkbox')).toBeChecked();
  await dialog.locator('select').selectOption('upright_346_5');
  await dialog.getByRole('checkbox').uncheck();
  await dialog.getByRole('button', { name: 'Uygula' }).click();
  project = await saveAndReadProject(page);
  expect(project.modules.map((module) => module.itemKey).sort()).toEqual(['upright_297', 'upright_346_5']);
  expect(await page.evaluate(() => localStorage.getItem('fairStand.uprightHeightItemKey'))).toBeNull();

  // Çentik kalkınca yine sorulur.
  await dropCatalogCard(page, 'upright_346_5');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'İptal' }).click();
  expect(errors).toEqual([]);
});
