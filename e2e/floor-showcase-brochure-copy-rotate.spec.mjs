import { openProductionDetails } from './helpers/productionDetails.mjs';
import { openEditorSettings } from './helpers/editorSettings.mjs';
import { test, expect } from '@playwright/test';

// Ayaklı vitrin ve broşürlük sahneye gelir, üretim listesine 1 adet yazılır; kopyalarken
// Shift+R yalnız kopyayı döndürür, seçili kalan asıl öğe dönmez.

async function exposeScene(page) {
  await page.route('**/src/scene3d.js*', async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace(
        'const controls = new OrbitControls(camera, renderer.domElement);',
        'const controls = new OrbitControls(camera, renderer.domElement); window.__sceneCamera = camera; window.__testScene = scene;',
      )
      .replace(
        '  let surfaceMeshes = [];',
        '  let surfaceMeshes = []; window.__sceneSurfaces = () => surfaceMeshes;',
      );
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

function moduleScreenPoint(page, moduleId) {
  return page.evaluate((id) => {
    const proxy = window.__sceneSurfaces().find((mesh) => mesh.userData.moduleId === id);
    const canvas = document.querySelector('#viewport > canvas').getBoundingClientRect();
    proxy.updateMatrixWorld(true);
    const screen = proxy.getWorldPosition(proxy.position.clone()).project(window.__sceneCamera);
    return {
      x: canvas.left + ((screen.x + 1) / 2) * canvas.width,
      y: canvas.top + ((1 - screen.y) / 2) * canvas.height,
    };
  }, moduleId);
}

function faceScreenPoint(page, moduleId, role) {
  return page.evaluate(({ id, surfaceRole }) => {
    const face = window.__sceneSurfaces().find((mesh) => mesh.userData.moduleId === id && mesh.userData.surfaceRole === surfaceRole);
    const canvas = document.querySelector('#viewport > canvas').getBoundingClientRect();
    face.updateMatrixWorld(true);
    const screen = face.getWorldPosition(face.position.clone()).project(window.__sceneCamera);
    return {
      x: canvas.left + ((screen.x + 1) / 2) * canvas.width,
      y: canvas.top + ((1 - screen.y) / 2) * canvas.height,
    };
  }, { id: moduleId, surfaceRole: role });
}

function floorScreenPoint(page, xCm, yCm) {
  return page.evaluate(({ x, y }) => {
    const camera = window.__sceneCamera;
    const point = camera.position.clone().set(x / 100, 0.05, y / 100).project(camera);
    const canvas = document.querySelector('#viewport > canvas').getBoundingClientRect();
    return {
      x: canvas.left + ((point.x + 1) / 2) * canvas.width,
      y: canvas.top + ((1 - point.y) / 2) * canvas.height,
    };
  }, { x: xCm, y: yCm });
}

test('vitrin ve broşürlük 1 adet üretilir; kopyada Shift+R yalnız kopyayı döndürür', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await exposeScene(page);
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('5');
  await page.locator('#stand-size-y').fill('5');
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill('E2E Vitrin Broşür');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  await page.locator('#save-project').click();
  await expect(page.locator('#save-project')).toBeEnabled();

  const projectId = await page.evaluate(async () => {
    const designState = await import('/src/designState.js');
    const placement = await import('/src/modulePlacement.js');
    const showcase = designState.createModuleStateFromCatalogKey('floor_showcase_100');
    showcase.placement = placement.createModulePlacement({ xCm: 150, yCm: 250, zCm: 0, rotationZDeg: 0, wallId: 'free' });
    const brochure = designState.createModuleStateFromCatalogKey('brochure_stand');
    brochure.placement = placement.createModulePlacement({ xCm: 350, yCm: 250, zCm: 0, rotationZDeg: 0, wallId: 'free' });
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
    project.modules = [showcase, brochure];
    project.updatedAt = Date.now();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      tx.objectStore('projects').put(project);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return project.id;
  });
  await page.reload();
  await page.locator('#project-select').evaluate((select, id) => { select.value = id; }, projectId);
  await page.locator('#open-project').click();
  await expect(page.locator('#project-status')).toContainText('Açıldı:');
  const opened = await readLatestProject(page);
  const showcaseId = opened.modules.find((module) => module.itemKey === 'floor_showcase_100').id;

  // İkisi de sahnede çizilir: vitrin seçim kutusu + ön/sol/sağ yüz, broşürlük seçim kutusu.
  await expect.poll(() => page.evaluate(() => window.__sceneSurfaces()
    .filter((mesh) => ['floor-showcase', 'brochure-stand'].includes(mesh.userData.moduleType)).length)).toBe(5);

  // Vitrinin ön yüzü düzenlenebilir: sağ tıkta Lightbox var; uygulanınca yüz durumu kaydedilir.
  const menu = page.getByRole('menu', { name: 'Modül işlemleri' });
  const front = await faceScreenPoint(page, showcaseId, 'front');
  await page.mouse.click(front.x, front.y, { button: 'right' });
  await expect(menu).toBeVisible();
  const advanced = menu.locator('.module-context-advanced-toggle');
  if (await advanced.isVisible() && (await advanced.getAttribute('aria-expanded')) === 'false') await advanced.click();
  const lightbox = menu.locator('[data-module-action="toggle-fabric"]');
  await expect(lightbox).toHaveText('Lightbox Kumaşa Çevir');
  await lightbox.click();
  const withLightbox = await saveAndReadProject(page);
  const showcaseState = withLightbox.modules.find((module) => module.id === showcaseId);
  expect(Object.keys(showcaseState.faces)).toEqual(['front', 'left', 'right']);
  expect(showcaseState.faces.front.fabricGroupId).toBeTruthy();
  expect(showcaseState.faces.left.fabricGroupId ?? null).toBeNull();
  await page.keyboard.press('Escape');
  const emptyFloor = await page.locator('#viewport > canvas').boundingBox();
  await page.mouse.click(emptyFloor.x + emptyFloor.width * 0.1, emptyFloor.y + emptyFloor.height * 0.9);

  // Vitrini çift tıkla bütün olarak seç, Kopyala; Shift+R iki kez (180°) ve boş zemine bırak.
  const showcasePoint = await moduleScreenPoint(page, showcaseId);
  await page.mouse.dblclick(showcasePoint.x, showcasePoint.y);
  // Seçili öğenin taban alanı ölçüleri: genişlik, derinlik, yükseklik.
  await expect(page.locator('#editor-mode-advanced')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.scene-measure-label')).toHaveCount(0);
  await page.locator('#editor-mode-advanced').click();
  await expect(page.locator('#editor-mode-advanced')).toHaveAttribute('aria-pressed', 'true');
  const sizeLabels = page.locator('.scene-measure-label.is-size');
  await expect(sizeLabels).toHaveCount(3);
  await expect(sizeLabels).toHaveText(['100 cm', '40 cm', '100 cm']);
  await openEditorSettings(page);
  await page.locator('#show-measurements').uncheck();
  await expect(page.locator('.scene-measure-label')).toHaveCount(0);
  await page.locator('#editor-mode-simple').click();
  await page.locator('#editor-mode-advanced').click();
  await expect(page.locator('.scene-measure-label')).toHaveCount(0);
  await page.locator('#show-measurements').check();
  await expect(sizeLabels).toHaveCount(3);
  await page.getByRole('toolbar', { name: 'Seçim işlemleri' }).getByRole('button', { name: /Kopyala/ }).click();
  await expect(page.locator('.viewport-wrap')).toHaveClass(/catalog-place-armed/);
  const drop = await floorScreenPoint(page, 250, 120);
  await page.mouse.move(drop.x, drop.y);
  // Taşırken stand kenarlarına uzaklık etiketleri; seçim ölçüleri gizlenir.
  await expect(page.locator('.scene-measure-label.is-distance')).toHaveCount(4);
  await expect(sizeLabels).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__testScene.getObjectByName('stand-floor-grid')?.visible)).toBe(true);
  await page.locator('#editor-mode-simple').click();
  await expect(page.locator('.scene-measure-label')).toHaveCount(0);
  await page.mouse.move(drop.x, drop.y);
  await expect.poll(() => page.evaluate(() => window.__testScene.getObjectByName('stand-floor-grid')?.visible)).toBe(true);
  await page.locator('#editor-mode-advanced').click();
  await page.mouse.move(drop.x, drop.y);
  await expect(page.locator('.scene-measure-label.is-distance')).toHaveCount(4);
  // Köşeye yaslı hayalet: yaslı iki kenara uzaklık çizilmez (hayaletin çizim payı hesaba girmez).
  const corner = await floorScreenPoint(page, 448, 478);
  await page.mouse.move(corner.x, corner.y);
  await expect(page.locator('.scene-measure-label.is-distance')).toHaveCount(2);
  await expect(page.locator('.scene-measure-label.is-distance')).toHaveText(['4.00 m', '4.60 m']);
  await page.mouse.move(drop.x, drop.y);
  await expect(page.locator('.scene-measure-label.is-distance')).toHaveCount(4);
  await page.keyboard.press('Shift+R');
  await page.keyboard.press('Shift+R');
  await page.mouse.click(drop.x, drop.y);
  await page.keyboard.press('Escape');
  await expect(page.locator('.viewport-wrap')).not.toHaveClass(/catalog-place-armed/);
  await expect(page.locator('.scene-measure-label.is-distance')).toHaveCount(0);

  const saved = await saveAndReadProject(page);
  const showcases = saved.modules.filter((module) => module.itemKey === 'floor_showcase_100');
  expect(showcases).toHaveLength(2);
  const original = showcases.find((module) => module.id === showcaseId);
  const copy = showcases.find((module) => module.id !== showcaseId);
  expect(original.placement.rotationZDeg).toBe(0);
  expect(copy.placement.rotationZDeg).toBe(180);

  // Üretim listesi: tek kalem, adet.
  const canvasBox = await page.locator('#viewport > canvas').boundingBox();
  await page.mouse.click(canvasBox.x + canvasBox.width * 0.1, canvasBox.y + canvasBox.height * 0.9);
  await openProductionDetails(page);
  await page.locator('#toggle-production-bom').click();
  const totals = page.locator('#production-bom-panel [data-bom-collapse-key="__totals__"]');
  await totals.locator('summary').click();
  await expect(totals.locator('li[data-item-key="floor_showcase_100"]')).toHaveText(/^2 × .* · adet$/);
  await expect(totals.locator('li[data-item-key="brochure_stand"]')).toHaveText(/^1 × .* · adet$/);
  expect(errors).toEqual([]);
});
