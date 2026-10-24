import { test, expect } from '@playwright/test';
import { openEditorSettings } from './helpers/editorSettings.mjs';
import { dropCatalogCard } from './helpers/catalogDrop.mjs';
import { chooseCatalogWidth } from './helpers/catalogWidth.mjs';

// Varyant değişimi (0086): öğe yerinden oynamaz. Zincir dışındaki (ada) öğe bitiştiği (snap) kenara
// göre büyür; bitişik değilse ortası sabit kalır. Üretim listesi yeni varyantın Item'ından gelir.
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

function readModules(page) {
  return page.evaluate(async () => {
    const { getActiveAutosaveController } = await import('/src/autosaveController.js');
    await getActiveAutosaveController().flush();
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
    const latest = projects.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
    return latest?.modules ?? latest?.design?.modules ?? [];
  });
}

async function saveAndReadModules(page) {
  await page.locator('#save-project').click();
  await expect(page.locator('#project-status')).toContainText('Kaydedildi');
  return readModules(page);
}

function moduleScreenPoint(page, moduleId) {
  return page.evaluate((id) => {
    const surface = window.__sceneSurfaces().find((mesh) => mesh.userData.moduleId === id);
    const canvas = document.querySelector('#viewport > canvas').getBoundingClientRect();
    surface.updateMatrixWorld(true);
    const center = surface.getWorldPosition(surface.position.clone()).project(window.__sceneCamera);
    return { x: canvas.left + ((center.x + 1) / 2) * canvas.width, y: canvas.top + ((1 - center.y) / 2) * canvas.height };
  }, moduleId);
}

async function selectModule(page, moduleId) {
  await page.locator('body').press('Escape');
  const point = await moduleScreenPoint(page, moduleId);
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('.selection-property-variants')).toBeVisible();
}

async function createIslandStand(page, projectName) {
  await exposeScene(page);
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  // Geniş stand: paneller stand kenarına değmez (kenar da snap sayılır).
  await page.locator('#stand-size-x').fill('10');
  await page.locator('#stand-size-y').fill('10');
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill(projectName);
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  await openEditorSettings(page);
  await page.locator('#autosave-interval').selectOption('0');
}

// Özellikler panelinden "Ekle…" ile seçili panelin yanına (bitişik) bir Panel daha eklenir.
async function addPanelBeside(page) {
  await page.locator('.selection-property-panel [data-module-action="add"]').click();
  const picker = page.locator('.module-picker-backdrop');
  await expect(picker).toBeVisible();
  await picker.locator('.module-picker-tab', { hasText: 'Panel & Duvar' }).click();
  await picker.locator('[data-module-key="wall_100_350"]').click();
  await picker.locator('.module-picker-add').click();
  await expect(picker).toBeHidden();
}

const startOf = (moduleState) => Number(moduleState.placement.xCm);
const endOf = (moduleState) => startOf(moduleState) + Number(moduleState.widthCm);

test('tek başına duran panel ortası sabit büyür; seçim aynı öğede kalır', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await createIslandStand(page, 'E2E Varyant Tek');
  await dropCatalogCard(page, 'wall_100_350', { points: [[0.75, 0.88], [0.7, 0.92], [0.8, 0.85]] });
  const [panel] = await saveAndReadModules(page);
  expect(panel.itemKey).toBe('wall_100_350');
  expect(panel.placement.rotationZDeg % 180).toBe(0);

  await selectModule(page, panel.id);
  await chooseCatalogWidth(page, 'wall_150_350');
  await expect(page.locator('.selection-property-heading')).toHaveText('Panel 150');

  const [changed] = await saveAndReadModules(page);
  expect(changed.id).toBe(panel.id);
  expect(changed.widthCm).toBe(150);
  expect((startOf(changed) + endOf(changed)) / 2).toBeCloseTo((startOf(panel) + endOf(panel)) / 2, 3);
  expect(changed.placement.yCm).toBe(panel.placement.yCm);
  expect(errors).toEqual([]);
});

test('bitişik panelde snap kenarı sabit kalır, büyüme öteki yana gider ve sıra itilir', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await createIslandStand(page, 'E2E Varyant Sira');
  await dropCatalogCard(page, 'wall_100_350', { points: [[0.75, 0.88], [0.7, 0.92], [0.8, 0.85]] });
  const [first] = await saveAndReadModules(page);
  await selectModule(page, first.id);
  await addPanelBeside(page);
  let modules = await saveAndReadModules(page);
  expect(modules).toHaveLength(2);
  const [left, right] = [...modules].sort((a, b) => startOf(a) - startOf(b));
  expect(endOf(left)).toBeCloseTo(startOf(right), 3);

  // Sağdaki panelin yalnız sol kenarı bitişik: sol kenar sabit, sağa doğru büyür.
  await selectModule(page, right.id);
  await chooseCatalogWidth(page, 'wall_150_350');
  modules = await saveAndReadModules(page);
  let byId = Object.fromEntries(modules.map((moduleState) => [moduleState.id, moduleState]));
  expect(byId[right.id].widthCm).toBe(150);
  expect(startOf(byId[right.id])).toBeCloseTo(startOf(right), 3);
  expect(startOf(byId[left.id])).toBeCloseTo(startOf(left), 3);

  // Soldaki panelin yalnız sağ kenarı bitişik: sağ kenar sabit, sola doğru büyür; komşu yerinde kalır.
  await selectModule(page, left.id);
  await chooseCatalogWidth(page, 'wall_200_350');
  modules = await saveAndReadModules(page);
  byId = Object.fromEntries(modules.map((moduleState) => [moduleState.id, moduleState]));
  expect(byId[left.id].widthCm).toBe(200);
  expect(endOf(byId[left.id])).toBeCloseTo(endOf(left), 3);
  expect(startOf(byId[right.id])).toBeCloseTo(startOf(right), 3);

  // Üretim listesi yeni varyantın Item'ından gelir: aynı yerde kurulan taze Item ile birebir aynıdır.
  const same = await page.evaluate(async (saved) => {
    const { createModuleStateFromCatalogKey } = await import('/src/designState.js');
    const { resolveProjectBom } = await import('/src/projectBom.js');
    const fresh = saved.map((moduleState) => ({
      ...createModuleStateFromCatalogKey(moduleState.itemKey),
      id: moduleState.id,
      placement: moduleState.placement,
    }));
    return JSON.stringify(resolveProjectBom(saved)) === JSON.stringify(resolveProjectBom(fresh));
  }, modules);
  expect(same).toBe(true);
  expect(errors).toEqual([]);
});
