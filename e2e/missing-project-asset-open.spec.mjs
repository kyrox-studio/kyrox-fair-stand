import { showSurfaceControls } from './helpers/surfaceControls.mjs';
import { openEditorSettings } from './helpers/editorSettings.mjs';
import { test, expect } from '@playwright/test';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const CUSTOMER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MISSING_ASSET_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function exposeScene(page) {
  // Gerçek renderer durumunu üretime debug API eklemeden okur.
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

async function dropBoxBlock(page) {
  const openCatalogButton = page.locator('.module-drag-catalog');
  const modulePanel = page.locator('details', { has: openCatalogButton });
  await modulePanel.locator(':scope > summary').click();
  const card = page.locator('.module-drag-card[data-module-key="box_block"]');
  const group = page.locator('.module-drag-group', { has: card });
  if (!(await group.getAttribute('open'))) await group.locator(':scope > summary').click();
  await card.scrollIntoViewIfNeeded();
  const viewport = await page.locator('#viewport').boundingBox();
  await card.dragTo(page.locator('#viewport'), {
    targetPosition: { x: Math.round(viewport.width * 0.5), y: Math.round(viewport.height * 0.7) },
  });
  await expect(page.locator('#box-block-size-title')).toBeVisible();
  await page.locator('input[name="opacity"]').fill('1');
  await page.getByRole('button', { name: 'Uygula' }).click();
  await expect(page.locator('#box-block-size-title')).toHaveCount(0);
}

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

function faceState(page, slot) {
  return page.evaluate((faceSlot) => {
    const mesh = window.__sceneSurfaces()
      .find((item) => item.userData.moduleType === 'box-block' && item.userData.faceSlot === faceSlot);
    if (!mesh) return null;
    const state = mesh.userData.surfaceState;
    return {
      imageAssetId: state?.imageAssetId ?? null,
      hasTexture: Boolean(mesh.material?.map),
      colorHex: `#${mesh.material.color.getHexString()}`,
      stateColor: String(state?.color ?? '#ffffff').toLowerCase(),
    };
  }, slot);
}

function detail(store) {
  const payload = store.project.payload || { stand: null, modules: [] };
  return {
    ...store.project,
    stand: payload.stand,
    modules: payload.modules || [],
    revisions: [],
  };
}

test('sunucuda dosyası olmayan görsel projeyi açmayı engellemez', async ({ page }) => {
  test.setTimeout(90_000);
  const store = { project: null, missingAssetRequests: 0 };

  await page.addInitScript((orgId) => {
    globalThis.__FAIR_STAND_CATALOG_HEADERS__ = {
      Authorization: 'Bearer e2e-missing-asset',
      'X-Organization-Id': orgId,
    };
  }, ORG_ID);

  await page.route('**/api/v1/fair-stand/projects**', async (route) => {
    const request = route.request();
    const parts = new URL(request.url()).pathname.split('/').filter(Boolean);
    const method = request.method();

    if (method === 'GET' && parts.at(-2) === 'assets') {
      if (parts.at(-1) === MISSING_ASSET_ID) store.missingAssetRequests += 1;
      await route.fulfill({ status: 404, json: { detail: 'Asset file missing' } });
      return;
    }
    if (method === 'POST' && parts.at(-1) === 'assets') {
      await route.fulfill({ json: { id: 'uploaded' } });
      return;
    }
    if (method === 'PUT') {
      const body = request.postDataJSON();
      const now = Date.now();
      store.project = {
        id: parts.at(-1),
        organizationId: ORG_ID,
        name: body.name,
        customerId: body.customerId || CUSTOMER_ID,
        version: body.version || 1,
        createdAt: store.project?.createdAt || now,
        updatedAt: now,
        createdBy: null,
        payload: body.payload,
        assets: store.project?.assets || [],
      };
      await route.fulfill({ json: detail(store) });
      return;
    }
    if (method === 'GET') {
      if (!store.project) {
        await route.fulfill({ status: 404, json: { detail: 'Project not found' } });
        return;
      }
      await route.fulfill({ json: detail(store) });
      return;
    }
    await route.fulfill({ status: 204, body: '' });
  });

  await exposeScene(page);
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('5');
  await page.locator('#stand-size-y').fill('5');
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill('EksikGorsel');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  await openEditorSettings(page);
  await page.locator('#autosave-interval').selectOption('0');
  await dropBoxBlock(page);

  const face = await visibleBoxFace(page);
  expect(face).not.toBeNull();
  await page.mouse.click(face.x, face.y);
  await showSurfaceControls(page);
  await page.locator('#surface-image').setInputFiles({ name: 'e2e-missing.png', mimeType: 'image/png', buffer: PNG });
  await expect.poll(async () => (await faceState(page, face.slot))?.hasTexture).toBe(true);
  const { imageAssetId } = await faceState(page, face.slot);
  await page.locator('#save-project').click();
  await expect(page.locator('#project-status')).toContainText('Kaydedildi:');

  // Sunucu kaydı bir görsele bağlantı ve asset satırı taşır, ama dosyası yoktur.
  const payloadJson = JSON.stringify(store.project.payload);
  expect(payloadJson.includes(imageAssetId)).toBe(true);
  store.project.payload = JSON.parse(payloadJson.split(imageAssetId).join(MISSING_ASSET_ID));
  store.project.assets = [{ id: MISSING_ASSET_ID, name: 'logo.png', type: 'image/png', createdAt: Date.now() }];

  await page.reload();
  await expect(page.locator('#viewport-empty')).toBeVisible();
  const projectSelect = page.locator('#project-select');
  const projectId = await projectSelect.locator('option', { hasText: 'EksikGorsel' }).getAttribute('value');
  await projectSelect.evaluate((select, id) => { select.value = id; }, projectId);
  await page.locator('#open-project').click();

  await expect(page.locator('#project-status')).toContainText('Açıldı:');
  await expect(page.locator('#project-status')).toContainText('1 görsel bulunamadı');
  await expect(page.locator('#viewport-empty')).toBeHidden();
  expect(store.missingAssetRequests).toBeGreaterThan(0);

  // Görseli bulunamayan yüzey dokusuz, kendi rengiyle çizilir; bağlantı korunur.
  const missingFace = await faceState(page, face.slot);
  expect(missingFace).toMatchObject({ imageAssetId: MISSING_ASSET_ID, hasTexture: false });
  expect(missingFace.colorHex).toBe(missingFace.stateColor);

  // Sahne kurulduğu için geri al çalışır.
  const floorSelect = page.locator('#floor-type');
  const before = await floorSelect.inputValue();
  await floorSelect.evaluate((select) => {
    const next = [...select.options].find((option) => option.value !== select.value);
    select.value = next.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(floorSelect).not.toHaveValue(before);
  await page.locator('#floor-type').blur();
  await page.keyboard.press('Control+z');
  await expect(floorSelect).toHaveValue(before);
});
