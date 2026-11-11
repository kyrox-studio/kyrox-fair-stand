import { test, expect } from '@playwright/test';
import { createStageFromWizard, clickProjectAction, savedProject } from './helpers/standSetup.mjs';
import { openEditorSettings } from './helpers/editorSettings.mjs';

// Dikme bazanın köşesine (bacağına) sürüklenince köşenin üstüne, iç köşeye oturur: bazanın iki dış
// yüzüyle hizalı, bazanın 49,5 köşe dikmesinin yerinde (kullanıcı kararı 2026-11-11). Önceden 10 cm
// serbest ızgara dikme merkezini 60'a koyuyor, bazayla arasında 5 cm boşluk kalıyordu.

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

// Dikmenin orta noktası ve plan üzerinde (dx, dy) cm kaydırılmış hali (ekran koordinatı).
function uprightDragPoints(page, moduleId, dxCm, dyCm) {
  return page.evaluate(({ id, dx, dy }) => {
    const camera = window.__sceneCamera;
    const canvas = document.querySelector('#viewport > canvas').getBoundingClientRect();
    const mesh = window.__sceneSurfaces().find((surface) => surface.userData.moduleId === id);
    mesh.updateMatrixWorld(true);
    const start = mesh.getWorldPosition(mesh.position.clone());
    start.y = 0.3;
    const end = start.clone();
    end.x += dx / 100;
    end.z += dy / 100;
    const toScreen = (point) => {
      const screen = point.clone().project(camera);
      return { x: canvas.left + ((screen.x + 1) / 2) * canvas.width, y: canvas.top + ((1 - screen.y) / 2) * canvas.height };
    };
    return { start: toScreen(start), end: toScreen(end) };
  }, { id: moduleId, dx: dxCm, dy: dyCm });
}

test('dikme bazanın köşesine sürüklenince köşenin üstüne oturur', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await exposeScene(page);
  await page.goto('/');
  const setup = page.locator('details.stand-setup-card');
  await setup.locator(':scope > summary').click();
  await setup.getByRole('button', { name: 'Ada Stand', exact: true }).click();
  await page.locator('#stand-size-x').fill('5');
  await page.locator('#stand-size-y').fill('5');
  await createStageFromWizard(page);
  await page.locator('form input[name="projectName"]').fill('Dikme baza köşesi');
  await page.getByRole('button', { name: 'Projeyi Oluştur', exact: true }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  await openEditorSettings(page);
  await page.locator('#autosave-interval').selectOption('0');
  const projectId = await page.locator('#project-select').inputValue();

  // Dikey baza x 200..250, y 150..350; dikme biraz uzakta (merkez 300, 300).
  await page.evaluate(async ({ id }) => {
    const { createModuleStateFromCatalogKey } = await import('/src/designState.js');
    const module = (key, moduleId, xCm, yCm, rotationZDeg) => {
      const state = createModuleStateFromCatalogKey(key);
      state.id = moduleId;
      state.placement = { xCm, yCm, zCm: 0, rotationZDeg, wallId: 'free' };
      return state;
    };
    const modules = [module('base_200', 'base', 225, 150, 270), module('upright_346_5', 'post', 300, 295, 270)];
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('fair-stand-configurator', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      const store = tx.objectStore('projects');
      const request = store.get(id);
      request.onsuccess = () => store.put({ ...request.result, modules });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, { id: projectId });

  await page.reload();
  await page.locator('#project-select').evaluate((select, id) => { select.value = id; }, projectId);
  await clickProjectAction(page, 'open-project');
  await expect(page.locator('#project-status')).toContainText('Açıldı:');
  await page.locator('body').press('t');
  await page.waitForTimeout(400);

  // İmleç bazanın ön köşesinin yanına (x 260, y 340) götürülür: ızgara 60/340 verirdi.
  const { start, end } = await uprightDragPoints(page, 'post', 260 - 300, 340 - 300);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 16 });
  await page.mouse.up();

  const post = (await savedProject(page)).modules.find((module) => module.id === 'post');
  const half = Number(post.widthCm) / 2;
  const rotation = ((Number(post.placement.rotationZDeg) % 360) + 360) % 360;
  const vertical = rotation === 90 || rotation === 270;
  const center = {
    x: Number(post.placement.xCm) + (vertical ? 0 : half),
    y: Number(post.placement.yCm) + (vertical ? half : 0),
  };
  // Merkez (245, 345): köşenin içinde, bazanın yan yüzü (x 250) ve ön kenarıyla (y 350) hizalı.
  expect(center).toEqual({ x: 250 - half, y: 350 - half });
  expect(errors).toEqual([]);
});
