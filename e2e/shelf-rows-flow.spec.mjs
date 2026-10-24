import { test, expect } from '@playwright/test';
import { chooseCatalogWidth } from './helpers/catalogWidth.mjs';

// Raf kartları (Tekli / 2 / 3 sıralı) gerçek kullanıcı akışında: proje uygulamanın kendi koduyla
// kayda yazılır ve açılır; üretim listesi, eski proje, 50'lik ve duvar dışı ret, taşımada genişlik,
// bütün sıralarda ışık ve tablet boyutu sahnede doğrulanır.

async function exposeScene(page) {
  await page.route('**/src/scene3d.js*', async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace(
        'const controls = new OrbitControls(camera, renderer.domElement);',
        'const controls = new OrbitControls(camera, renderer.domElement); window.__sceneCamera = camera;',
      )
      .replace(
        '  let surfaceMeshes = [];',
        '  let surfaceMeshes = []; window.__sceneSurfaces = () => surfaceMeshes;',
      );
    await route.fulfill({ response, body });
  });
}

function openDatabase(page, callback, arg) {
  return page.evaluate(async ({ source, value }) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('fair-stand-configurator', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      // eslint-disable-next-line no-new-func
      return await new Function('db', 'value', `return (${source})(db, value);`)(db, value);
    } finally {
      db.close();
    }
  }, { source: callback.toString(), value: arg });
}

async function readLatestProject(page) {
  return openDatabase(page, async (db) => {
    const projects = await new Promise((resolve, reject) => {
      const request = db.transaction('projects', 'readonly').objectStore('projects').getAll();
      request.onsuccess = () => resolve(request.result ?? []);
      request.onerror = () => reject(request.error);
    });
    return projects.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0] ?? null;
  });
}

async function saveAndReadProject(page) {
  const save = page.locator('#save-project');
  await save.click();
  await expect(save).toBeEnabled();
  return readLatestProject(page);
}

// Arka duvar: 100 | 150 | 200 | 50. Raflar uygulamanın snap koduyla birleşime yerleşir.
// `shelves`: [catalogKey, duvarIndex, birleşim cm]. Tekli raf eski projedeki gibi shelf_W olarak yazılır.
async function openProjectWithShelves(page, projectName, shelves) {
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Sırt Duvar' }).click();
  await page.locator('#stand-size-x').fill('5');
  await page.locator('#stand-size-y').fill('4');
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill(projectName);
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  await page.locator('#save-project').click();
  await expect(page.locator('#save-project')).toBeEnabled();

  const projectId = await page.evaluate(async (shelfList) => {
    const designState = await import('/src/designState.js');
    const placement = await import('/src/modulePlacement.js');
    const walls = ['wall_100_350', 'wall_150_350', 'wall_200_350', 'wall_50_350'];
    let xCm = 0;
    const wallStates = walls.map((itemKey) => {
      const state = designState.createModuleStateFromCatalogKey(itemKey);
      state.placement = placement.createModulePlacement({ xCm, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' });
      xCm += state.widthCm;
      return state;
    });
    const shelfStates = shelfList.map(([catalogKey, wallIndex, seamCm]) => {
      const host = wallStates[wallIndex];
      const result = placement.snapPanelSeamOverlayPlacement({
        moduleState: designState.createModuleStateFromDescriptor({ itemKey: catalogKey, type: 'shelf' }),
        modules: wallStates,
        wallPoint: {
          wallId: 'back',
          rotationZDeg: 0,
          pointerXCm: host.placement.xCm + host.widthCm / 2,
          pointerYCm: 0,
          absoluteHeightCm: seamCm,
        },
      });
      if (!result.ok) throw new Error(`raf yerleşmedi: ${catalogKey} → ${host.itemKey}`);
      return { ...result.resolvedModuleState, placement: result.placement };
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
    project.modules = [...wallStates, ...shelfStates];
    project.updatedAt = Date.now();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      tx.objectStore('projects').put(project);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return project.id;
  }, shelves);

  await page.reload();
  await expect(page.locator('#viewport-empty')).toBeVisible();
  await page.locator('#project-select').evaluate((select, id) => { select.value = id; }, projectId);
  await page.locator('#open-project').click();
  await expect(page.locator('#project-status')).toContainText('Açıldı:');
  return readLatestProject(page);
}

// Dünya noktası → ekran noktası (kameranın o anki görünümü).
function screenPoint(page, worldPointSource) {
  return page.evaluate((source) => {
    const point = new Function(`return (${source})();`)();
    const canvas = document.querySelector('#viewport > canvas').getBoundingClientRect();
    const screen = point.project(window.__sceneCamera);
    return {
      x: canvas.left + ((screen.x + 1) / 2) * canvas.width,
      y: canvas.top + ((1 - screen.y) / 2) * canvas.height,
    };
  }, worldPointSource);
}

// Duvar modülünün iki bandının ortak birleşimi (panel yüzünde) — raf bu noktaya bırakılır.
function wallSeamPoint(page, moduleId, lowerStripIndex) {
  return screenPoint(page, `() => {
    const strips = window.__sceneSurfaces().filter((mesh) => mesh.userData.moduleId === ${JSON.stringify(moduleId)});
    const lower = strips.find((mesh) => mesh.userData.stripIndex === ${lowerStripIndex});
    const upper = strips.find((mesh) => mesh.userData.stripIndex === ${lowerStripIndex + 1});
    lower.updateMatrixWorld(true); upper.updateMatrixWorld(true);
    const a = lower.getWorldPosition(lower.position.clone());
    const b = upper.getWorldPosition(upper.position.clone());
    return a.add(b).multiplyScalar(0.5);
  }`);
}

function shelfBoardPoint(page, moduleId) {
  return screenPoint(page, `() => {
    const board = window.__sceneSurfaces().find((mesh) => mesh.userData.moduleId === ${JSON.stringify(moduleId)});
    board.updateMatrixWorld(true);
    return board.getWorldPosition(board.position.clone());
  }`);
}

function shelfLightCount(page, moduleId) {
  return page.evaluate((id) => {
    const board = window.__sceneSurfaces().find((mesh) => mesh.userData.moduleId === id);
    let visible = 0;
    board.parent.traverse((object) => {
      if (object.userData?.role === 'shelf-under-led-strip' && object.visible) visible += 1;
    });
    return visible;
  }, moduleId);
}

test('eski tekli raflar aynen açılır; sıralı raflar her genişlikte reçetenin katı kadar BOM üretir', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await exposeScene(page);
  const opened = await openProjectWithShelves(page, 'E2E Raf BOM', [
    ['shelf_row_1', 0, 100], ['shelf_row_1', 1, 100], ['shelf_row_1', 2, 100],
    ['shelf_row_2', 0, 200], ['shelf_row_2', 1, 200], ['shelf_row_2', 2, 200],
    ['shelf_row_3', 0, 50], ['shelf_row_3', 1, 50], ['shelf_row_3', 2, 50],
  ]);
  const shelfKeys = opened.modules.filter((module) => module.type === 'shelf').map((module) => module.itemKey);
  expect(shelfKeys).toEqual([
    'shelf_100', 'shelf_150', 'shelf_200',
    'shelf_row_2_100', 'shelf_row_2_150', 'shelf_row_2_200',
    'shelf_row_3_100', 'shelf_row_3_150', 'shelf_row_3_200',
  ]);

  // Kaydet → aynı kimlikler (eski tekli raflar shelf_W olarak kalır).
  const saved = await saveAndReadProject(page);
  expect(saved.modules.filter((module) => module.type === 'shelf').map((module) => module.itemKey)).toEqual(shelfKeys);

  // Tahta: her genişlikte 1 + 2 + 3 = 6. Ayak: 100'de 2 × 6 = 12, 150 ve 200'de 3 × 6 = 18.
  await page.locator('#toggle-production-bom').click();
  const totals = page.locator('#production-bom-panel [data-bom-collapse-key="__totals__"]');
  await totals.locator('summary').click();
  for (const [itemKey, text] of [
    ['shelf_100_self', '6 × Raf 100 Tek · adet'],
    ['shelf_150_self', '6 × Raf 150 Tek · adet'],
    ['shelf_200_self', '6 × Raf 200 Tek · adet'],
    ['shelf_leg', '48 × Raf Ayağı · adet'],
  ]) {
    await expect(totals.locator(`li[data-item-key="${itemKey}"]`)).toHaveText(text);
  }
  expect(errors).toEqual([]);
});

test('raf taşınınca genişliği yeni duvardan alır', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await exposeScene(page);
  const opened = await openProjectWithShelves(page, 'E2E Raf Taşıma', [['shelf_row_2', 0, 100]]);
  const [wall100, , wall200, wall50] = opened.modules.filter((module) => module.type === 'flat-panel');
  const shelf = opened.modules.find((module) => module.type === 'shelf');
  expect(shelf.itemKey).toBe('shelf_row_2_100');

  // Taşı: 100'lük duvardaki ikili raf → 200'lük duvarın 100 cm birleşimi.
  const from = await shelfBoardPoint(page, shelf.id);
  const to = await wallSeamPoint(page, wall200.id, 1);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 20 });
  await expect.poll(() => page.evaluate(() => document.querySelector('#viewport > canvas').dataset.placementGhost)).toBe('valid');
  await page.mouse.up();
  const project = await saveAndReadProject(page);
  const moved = project.modules.find((module) => module.id === shelf.id);
  expect(moved.itemKey).toBe('shelf_row_2_200');
  expect(moved.widthCm).toBe(200);
  expect(moved.placement.xCm).toBe(wall200.placement.xCm);
  expect(wall100.widthCm).toBe(100);
  expect(errors).toEqual([]);
});

test('200 cm raftan 50 cm duvara taşıma reddedilir; kayıtlı raf korunur', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await exposeScene(page);
  const opened = await openProjectWithShelves(page, 'E2E Raf Dar Duvar', [['shelf_row_2', 2, 100]]);
  const [, , wall200, wall50] = opened.modules.filter((module) => module.type === 'flat-panel');
  const shelf = opened.modules.find((module) => module.type === 'shelf');
  expect(shelf.itemKey).toBe('shelf_row_2_200');

  // 50'lik duvara taşıma reddedilir: raf yerinde ve genişliğinde kalır.
  const back = await shelfBoardPoint(page, shelf.id);
  const onFifty = await wallSeamPoint(page, wall50.id, 1);
  await page.mouse.move(back.x, back.y);
  await page.mouse.down();
  await page.mouse.move(onFifty.x, onFifty.y, { steps: 20 });
  await expect.poll(() => page.evaluate(() => document.querySelector('#viewport > canvas').dataset.placementGhost)).not.toBe('valid');
  await page.mouse.up();
  const project = await saveAndReadProject(page);
  const moved = project.modules.find((module) => module.id === shelf.id);
  expect(moved.itemKey).toBe('shelf_row_2_200');
  expect(moved.widthCm).toBe(200);
  expect(moved.placement.xCm).toBe(wall200.placement.xCm);
  expect(moved.placement).toEqual(shelf.placement);
  expect(project.modules.filter((module) => module.type === 'shelf')).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('katalog rafı 50 cm duvara veya duvar dışına bırakılamaz', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await exposeScene(page);
  const opened = await openProjectWithShelves(page, 'E2E Raf Geçersiz Bırakma', [['shelf_row_2', 2, 100]]);
  const [wall100, , , wall50] = opened.modules.filter((module) => module.type === 'flat-panel');

  // Katalogdan 50'lik duvara ve boş zemine bırakma: raf eklenmez.
  await page.locator('details', { has: page.locator('.module-drag-catalog') }).locator(':scope > summary').click();
  const card = page.locator('.module-drag-card[data-module-key="shelf_row_1"]').first();
  const group = page.locator('.module-drag-group', { has: card });
  if (!(await group.getAttribute('open'))) await group.locator(':scope > summary').click();
  await card.scrollIntoViewIfNeeded();
  const floor = await screenPoint(page, `() => new (window.__sceneCamera.position.constructor)(2.5, 0.06, 3.2)`);
  for (const point of [await wallSeamPoint(page, wall50.id, 2), floor]) {
    const accepted = await page.evaluate(({ x, y }) => {
      const source = document.querySelector('.module-drag-card[data-module-key="shelf_row_1"]');
      const viewport = document.querySelector('#viewport');
      const canvas = viewport.querySelector(':scope > canvas');
      const dataTransfer = new DataTransfer();
      source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer }));
      viewport.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer, clientX: x, clientY: y }));
      const ghost = canvas.dataset.placementGhost ?? null;
      viewport.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer, clientX: x, clientY: y }));
      return ghost;
    }, point);
    expect(accepted).not.toBe('valid');
  }
  const project = await saveAndReadProject(page);
  expect(project.modules.filter((module) => module.type === 'shelf')).toHaveLength(1);
  expect(wall100.widthCm).toBe(100);
  expect(errors).toEqual([]);
});

test('raf altı aydınlatma açılınca üçlü rafın bütün sıralarında yanar', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await exposeScene(page);
  const opened = await openProjectWithShelves(page, 'E2E Raf Işık', [['shelf_row_3', 1, 100]]);
  const shelf = opened.modules.find((module) => module.type === 'shelf');
  expect(shelf.itemKey).toBe('shelf_row_3_150');
  expect(await shelfLightCount(page, shelf.id)).toBe(0);

  const point = await shelfBoardPoint(page, shelf.id);
  await page.mouse.click(point.x, point.y, { button: 'right' });
  const lightButton = page.locator('[data-module-action="toggle-shelf-light"]');
  await expect(lightButton).toBeVisible();
  await lightButton.click();
  await expect.poll(() => shelfLightCount(page, shelf.id)).toBe(3);
  const project = await saveAndReadProject(page);
  expect(project.modules.find((module) => module.id === shelf.id).shelfLightingOn).toBe(true);
  expect(errors).toEqual([]);
});

test('tablet boyutunda Raf kartı görünür, duvara takılır ve sıra panelden seçilir', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1024, height: 768 });
  await exposeScene(page);
  await openProjectWithShelves(page, 'E2E Raf Tablet', []);
  await page.locator('details', { has: page.locator('.module-drag-catalog') }).locator(':scope > summary').click();
  const first = page.locator('.module-drag-card[data-module-key="shelf_row_1"]').first();
  const group = page.locator('.module-drag-group', { has: first });
  if (!(await group.getAttribute('open'))) await group.locator(':scope > summary').click();
  // 0086: tek Raf kartı; 2 ve 3 sıralı raf Özellikler panelinde seçilir.
  await first.scrollIntoViewIfNeeded();
  await expect(first).toBeVisible();
  for (const key of ['shelf_row_2', 'shelf_row_3']) {
    await expect(page.locator(`.module-drag-card[data-module-key="${key}"]`)).toHaveCount(0);
  }
  const opened = await readLatestProject(page);
  const wall150 = opened.modules.find((module) => module.itemKey === 'wall_150_350');
  const target = await wallSeamPoint(page, wall150.id, 2);
  const ghost = await page.evaluate(({ x, y }) => {
    const source = document.querySelector('.module-drag-card[data-module-key="shelf_row_1"]');
    const viewport = document.querySelector('#viewport');
    const canvas = viewport.querySelector(':scope > canvas');
    const dataTransfer = new DataTransfer();
    source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer }));
    viewport.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer, clientX: x, clientY: y }));
    const state = canvas.dataset.placementGhost ?? null;
    viewport.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer, clientX: x, clientY: y }));
    return state;
  }, target);
  expect(ghost).toBe('valid');
  await chooseCatalogWidth(page, 'shelf_row_2');
  const project = await saveAndReadProject(page);
  const shelf = project.modules.find((module) => module.type === 'shelf');
  expect(shelf.itemKey).toBe('shelf_row_2_150');
  expect(shelf.widthCm).toBe(150);
  expect(errors).toEqual([]);
});
