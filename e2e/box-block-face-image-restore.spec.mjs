import { showSurfaceControls } from './helpers/surfaceControls.mjs';
import { test, expect } from '@playwright/test';
import { disableAutoFurniture, keepWallLock } from './helpers/standSetup.mjs';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function exposeScene(page) {
  // Read the real renderer state without adding a production debug API.
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

async function createIslandStand(page, projectName) {
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('5');
  await page.locator('#stand-size-y').fill('5');
  await disableAutoFurniture(page);
  await page.locator('#create-stage').click();
  const projectNameInput = page.locator('form input[name="projectName"]');
  await expect(projectNameInput).toBeVisible();
  await projectNameInput.fill(projectName);
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await keepWallLock(page);
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
}

async function dropBoxBlock(page) {
  const openCatalogButton = page.locator('.module-drag-catalog');
  const modulePanel = page.locator('details', { has: openCatalogButton });
  await modulePanel.locator(':scope > summary').click();
  const card = page.locator('.module-drag-card[data-module-key="box_block"]');
  const group = page.locator('.module-drag-group', { has: card });
  if (!(await group.getAttribute('open'))) await group.locator(':scope > summary').click();
  await card.scrollIntoViewIfNeeded();
  await expect(card).toBeVisible();
  const viewport = await page.locator('#viewport').boundingBox();
  await card.dragTo(page.locator('#viewport'), {
    targetPosition: { x: Math.round(viewport.width * 0.5), y: Math.round(viewport.height * 0.7) },
  });
  await expect(page.locator('#box-block-size-title')).toBeVisible();
  await page.locator('input[name="opacity"]').fill('1');
  await page.getByRole('button', { name: 'Uygula' }).click();
  await expect(page.locator('#box-block-size-title')).toHaveCount(0);
}

// Screen point of the box face that looks most directly at the camera.
function visibleBoxFace(page) {
  return page.evaluate(() => {
    const camera = window.__sceneCamera;
    const canvas = document.querySelector('#viewport > canvas').getBoundingClientRect();
    const faces = window.__sceneSurfaces().filter((mesh) => mesh.userData.moduleType === 'box-block' && mesh.userData.faceSlot);
    const scored = faces.map((face) => {
      face.updateMatrixWorld(true);
      const center = face.getWorldPosition(face.position.clone());
      const normal = face.getWorldDirection(face.position.clone());
      const toCamera = camera.position.clone().sub(center).normalize();
      const screen = center.clone().project(camera);
      return {
        slot: face.userData.faceSlot,
        facing: normal.dot(toCamera),
        x: canvas.left + ((screen.x + 1) / 2) * canvas.width,
        y: canvas.top + ((1 - screen.y) / 2) * canvas.height,
      };
    });
    return scored.sort((a, b) => b.facing - a.facing)[0] ?? null;
  });
}

function faceImage(page, slot) {
  return page.evaluate((faceSlot) => {
    const face = window.__sceneSurfaces()
      .find((mesh) => mesh.userData.moduleType === 'box-block' && mesh.userData.faceSlot === faceSlot);
    if (!face) return null;
    return {
      imageAssetId: face.userData.surfaceState?.imageAssetId ?? null,
      hasTexture: Boolean(face.material?.map),
    };
  }, slot);
}

test('box block face image is drawn again after save, reload and open', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await exposeScene(page);

  await createIslandStand(page, 'E2E Box Face Image');
  await dropBoxBlock(page);

  const face = await visibleBoxFace(page);
  expect(face).not.toBeNull();
  expect(face.facing).toBeGreaterThan(0);
  await page.mouse.click(face.x, face.y);
  await expect.poll(() => page.evaluate((slot) => window.__sceneSurfaces()
    .find((mesh) => mesh.userData.faceSlot === slot)?.userData.selectionFrame?.visible === true, face.slot)).toBe(true);

  await showSurfaceControls(page);
  await page.locator('#surface-image').setInputFiles({ name: 'e2e-box-face.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.locator('#asset-status')).toContainText('e2e-box-face.png');
  await expect.poll(async () => (await faceImage(page, face.slot))?.hasTexture).toBe(true);
  const { imageAssetId } = await faceImage(page, face.slot);
  expect(imageAssetId).toBeTruthy();

  await page.locator('#save-project').click();
  await expect(page.locator('#project-status')).toContainText('Kaydedildi:');
  const projectId = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('fair-stand-configurator', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const projects = await new Promise((resolve, reject) => {
      const request = db.transaction('projects', 'readonly').objectStore('projects').getAll();
      request.onsuccess = () => resolve(request.result ?? []);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return projects.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0]?.id ?? null;
  });
  expect(projectId).toBeTruthy();

  await page.reload();
  await expect(page.locator('#viewport-empty')).toBeVisible();
  const projectSelect = page.locator('#project-select');
  await expect(projectSelect.locator(`option[value="${projectId}"]`)).toHaveCount(1);
  await projectSelect.evaluate((select, id) => { select.value = id; }, projectId);
  await page.locator('#open-project').click();
  await expect(page.locator('#project-status')).toContainText('Açıldı:');

  // The saved state alone is not enough: the face must draw its image again.
  await expect.poll(() => faceImage(page, face.slot)).toEqual({ imageAssetId, hasTexture: true });
  expect(pageErrors).toEqual([]);
});
