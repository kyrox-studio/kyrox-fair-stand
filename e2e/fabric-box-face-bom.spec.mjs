import { test, expect } from '@playwright/test';
import { disableAutoFurniture, keepWallLock, createStageFromWizard } from './helpers/standSetup.mjs';
import { dropCatalogCard } from './helpers/catalogDrop.mjs';
import { openPanelTab } from './helpers/surfaceControls.mjs';

// Lightbox / Mesh baza ve banko yüzüne atanır; kumaş kaldırılan panelin yerine konur (kullanıcı kararı
// 2026-11-20): Üretim Listesi'nde o yüzün paneli, iki tekli aparatı ve (alt yüzde) iki başlangıcı düşer.
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

async function createStand(page) {
  await page.goto('/');
  const setup = page.locator('details.stand-setup-card');
  await setup.locator('summary').click();
  await setup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('6');
  await page.locator('#stand-size-y').fill('5');
  await disableAutoFurniture(page);
  await createStageFromWizard(page);
  await page.locator('form input[name="projectName"]').fill('E2E Kumaş Baza Banko');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await keepWallLock(page);
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
}

// Bazada yüz `surfaceRole` (front / left / right); bankoda `surfaceRole` + `panelLevel` (front:lower).
async function faceScreenPoint(page, role) {
  return page.evaluate((surfaceRole) => {
    const matches = (mesh, key) => {
      const [face, level] = key.split(':');
      return mesh.userData.surfaceRole === face && (!level || mesh.userData.panelLevel === level);
    };
    const face = window.__sceneSurfaces().find((mesh) => matches(mesh, surfaceRole));
    const canvas = document.querySelector('#viewport > canvas').getBoundingClientRect();
    face.updateMatrixWorld(true);
    const screen = face.getWorldPosition(face.position.clone()).project(window.__sceneCamera);
    return { x: canvas.left + ((screen.x + 1) / 2) * canvas.width, y: canvas.top + ((1 - screen.y) / 2) * canvas.height };
  }, role);
}

async function totals(page) {
  await page.locator('#toggle-production-bom').click();
  const box = page.locator('#production-bom-panel [data-bom-collapse-key="__totals__"]');
  if (!(await box.evaluate((node) => node.open))) await box.locator('summary').click();
  const result = await box.locator('li[data-item-key]').evaluateAll((items) => Object.fromEntries(items.map((item) => [
    item.dataset.itemKey, Number(String(item.textContent).split('×')[0].trim().replace(',', '.')),
  ])));
  await page.locator('#toggle-production-bom').click();
  return result;
}

const panelTotal = (lines) => Object.entries(lines).filter(([key]) => /^panel_/.test(key)).reduce((sum, [, value]) => sum + value, 0);

for (const [card, role, fabric, startDrop] of [
  ['base_100', 'front', 'toggle-fabric', 2],
  ['desk_banko_100', 'front:lower', 'toggle-mesh', 2],
  ['desk_banko_100', 'front:upper', 'toggle-fabric', 0],
]) {
  test(`${card} ${role} yüzüne ${fabric === 'toggle-mesh' ? 'Mesh' : 'Lightbox'} atanır, listede panel ve aparat düşer`, async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await exposeScene(page);
    await createStand(page);
    await dropCatalogCard(page, card);
    await page.keyboard.press('Escape');
    const before = await totals(page);

    await page.locator('body').press('2');
    await page.waitForTimeout(800);
    const point = await faceScreenPoint(page, role);
    await page.mouse.click(point.x, point.y);
    const faceState = (key) => page.evaluate((surfaceRole) => {
      const [face, level] = surfaceRole.split(':');
      const mesh = window.__sceneSurfaces().find((entry) => entry.userData.surfaceRole === face
        && (!level || entry.userData.panelLevel === level));
      return { selected: mesh?.userData.selectionFrame?.visible === true, fabric: Boolean(mesh?.userData.surfaceState?.fabricGroupId) };
    }, key);
    await expect.poll(async () => (await faceState(role)).selected).toBe(true);
    await page.mouse.click(point.x, point.y, { button: 'right' });
    await openPanelTab(page, 'more');
    await page.locator(`[data-module-action="${fabric}"]`).click();
    await expect.poll(async () => (await faceState(role)).fabric).toBe(true);

    const after = await totals(page);
    expect(panelTotal(before) - panelTotal(after)).toBe(1);
    expect((before.connector_single ?? 0) - (after.connector_single ?? 0)).toBe(2);
    expect((before.connector_start ?? 0) - (after.connector_start ?? 0)).toBe(startDrop);
    expect(after[fabric === 'toggle-mesh' ? 'mesh_fabric' : 'lightbox_fabric']).toBeGreaterThan(0);
    expect(pageErrors).toEqual([]);
  });
}
