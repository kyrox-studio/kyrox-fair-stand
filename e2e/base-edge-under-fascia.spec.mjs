import { test, expect } from '@playwright/test';
import { chooseCatalogWidth } from './helpers/catalogWidth.mjs';
import { dropCatalogCard } from './helpers/catalogDrop.mjs';
import { disableAutoFurniture, savedProject } from './helpers/standSetup.mjs';

// Baza tepedeki alınlık / profil yüzüne mıknatıslanmaz: açık kenarın üstünde alınlık varken
// kenara sürüklenen baza stand kenarına sıfır oturur (önceden 5 cm boşluk kalıyordu).

async function exposeScene(page) {
  // Gerçek sahne durumunu üretime debug API eklemeden okur.
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

// Bazanın üst yüzündeki nokta ve aynı yükseklikte plan üzerinde (dx, dy) cm kaydırılmış nokta (ekran).
function baseDragPoints(page, moduleId, dxCm, dyCm) {
  return page.evaluate(({ id, dx, dy }) => {
    const camera = window.__sceneCamera;
    const canvas = document.querySelector('#viewport > canvas').getBoundingClientRect();
    // Bazanın en üstteki yüzeyi (üst tabla) tutulur.
    const start = window.__sceneSurfaces()
      .filter((mesh) => mesh.userData.moduleId === id)
      .map((mesh) => {
        mesh.updateMatrixWorld(true);
        return mesh.getWorldPosition(mesh.position.clone());
      })
      .sort((a, b) => b.y - a.y)[0];
    const end = start.clone();
    end.x += dx / 100;
    end.z += dy / 100;
    const toScreen = (point) => {
      const screen = point.clone().project(camera);
      return {
        x: canvas.left + ((screen.x + 1) / 2) * canvas.width,
        y: canvas.top + ((1 - screen.y) / 2) * canvas.height,
      };
    };
    return { start: toScreen(start), end: toScreen(end) };
  }, { id: moduleId, dx: dxCm, dy: dyCm });
}

test('alınlık altındaki açık kenara sürüklenen baza kenara sıfır oturur', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await exposeScene(page);
  await page.goto('/');
  await disableAutoFurniture(page);
  const dialog = page.getByRole('dialog', { name: 'Yeni proje sihirbazı' });
  await dialog.getByRole('button', { name: 'İleri →' }).click();
  await dialog.getByRole('button', { name: 'Sırt Duvar' }).click();
  await dialog.getByRole('button', { name: 'İleri →' }).click();
  await dialog.locator('#wizard-size-x').fill('5');
  await dialog.locator('#wizard-size-y').fill('4');
  await dialog.locator('#wizard-fascia').check();
  await dialog.locator('#wizard-fascia-rows').selectOption('1');
  await dialog.getByRole('button', { name: 'İleri →' }).click();
  await dialog.getByRole('button', { name: 'Oluştur' }).click();
  const nameInput = page.locator('form input[name="projectName"]');
  await expect(nameInput).toBeVisible();
  await nameInput.fill('E2E Baza Alınlık');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();

  const withFascia = await savedProject(page);
  // Ön kenarın alınlığı tepede, merkez çizgisi stand kenarında (y = 400).
  const frontFascia = withFascia.modules.filter((module) => module.autoFascia === true
    && module.type !== 'upright' && Number(module.placement.yCm) === 400);
  expect(frontFascia.length).toBeGreaterThan(0);

  await dropCatalogCard(page, 'base_100');
  await chooseCatalogWidth(page, 'base_100');
  const dropped = (await savedProject(page)).modules.find((module) => module.type === 'base');
  expect(dropped).toBeTruthy();
  expect(Number(dropped.placement.rotationZDeg)).toBe(0);

  // Köşe dikmelerinden uzakta, kenarın ortasında: imleç ön kenara 5 cm kalana dek (y = 395) sürüklenir;
  // tepedeki alınlık yüzü (y = 370) değil stand kenarı kazanır.
  const centerXCm = Number(dropped.placement.xCm) + Number(dropped.widthCm) / 2;
  const { start, end } = await baseDragPoints(page, dropped.id, 250 - centerXCm, 395 - Number(dropped.placement.yCm));
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  // 4 adım: sonuç yalnız bırakılan son konuma bağlı. Başsız tarayıcı sahneyi yazılımla çizer; her
  // adım bir kare (~0,3 sn, yavaş CI makinesinde ~1,4 sn) olduğundan 16 adım 30 sn sınırını aşıyordu.
  await page.mouse.move(end.x, end.y, { steps: 4 });
  await page.mouse.up();

  const moved = (await savedProject(page)).modules.find((module) => module.id === dropped.id);
  expect(Number(moved.placement.xCm) + Number(moved.widthCm) / 2).toBe(250);
  expect(Number(moved.placement.yCm) + Number(moved.depthCm) / 2).toBe(400);
  expect(errors).toEqual([]);
});
