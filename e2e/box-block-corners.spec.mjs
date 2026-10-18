import { test, expect } from '@playwright/test';

// Kutu blok yan plakaları köşede birbirine kavuşur: gövde rengi köşede çizgi olarak görünmez.
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

test('box block side faces meet at every vertical corner', async ({ page }) => {
  await exposeScene(page);
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('500');
  await page.locator('#stand-size-y').fill('500');
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill('E2E Kose');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();

  const openCatalogButton = page.locator('#open-module-catalog');
  const modulePanel = page.locator('details', { has: openCatalogButton });
  await modulePanel.locator(':scope > summary').click();
  const card = page.locator('.module-drag-card[data-module-key="box_block"]');
  const group = page.locator('.module-drag-group', { has: card });
  if (!(await group.evaluate((el) => el.open))) await group.locator(':scope > summary').click();
  await card.scrollIntoViewIfNeeded();
  const viewport = await page.locator('#viewport').boundingBox();
  await card.dragTo(page.locator('#viewport'), {
    targetPosition: { x: Math.round(viewport.width * 0.5), y: Math.round(viewport.height * 0.7) },
  });
  await expect(page.locator('#box-block-size-title')).toBeVisible();
  await page.locator('input[name="opacity"]').fill('1');
  await page.getByRole('button', { name: 'Uygula' }).click();
  await expect(page.locator('#box-block-size-title')).toHaveCount(0);

  // Her yan plakanın iki dikey kenarı (yerel ±W/2), komşu plakanın düzlemine ulaşmalı.
  const gaps = await page.evaluate(() => {
    const faces = window.__sceneSurfaces().filter((mesh) => mesh.userData.moduleType === 'box-block' && mesh.userData.faceSlot);
    const bySlot = Object.fromEntries(faces.map((face) => [face.userData.faceSlot, face]));
    const group = bySlot.front.parent;
    group.updateMatrixWorld(true);
    const toGroup = group.matrixWorld.clone().invert();
    const edgesInGroup = (face) => {
      face.updateMatrixWorld(true);
      const halfWidth = face.geometry.parameters.width / 2;
      return [-halfWidth, halfWidth].map((x) => face.localToWorld(face.position.clone().set(x, 0, 0)).applyMatrix4(toGroup));
    };
    const planeOf = (face) => face.position.clone();
    const front = edgesInGroup(bySlot.front);
    const back = edgesInGroup(bySlot.back);
    const right = planeOf(bySlot.right).x;
    const left = planeOf(bySlot.left).x;
    const frontZ = planeOf(bySlot.front).z;
    const backZ = planeOf(bySlot.back).z;
    const side = (face) => edgesInGroup(face).map((point) => point.z);
    // Ön/arka plakanın en dış kenarı sağ/sol düzlemine, sağ/sol plakanın kenarı ön/arka düzlemine ne kadar uzak?
    return [
      Math.max(...front.map((p) => p.x)) - right,
      left - Math.min(...front.map((p) => p.x)),
      Math.max(...back.map((p) => p.x)) - right,
      left - Math.min(...back.map((p) => p.x)),
      Math.max(...side(bySlot.right)) - frontZ,
      backZ - Math.min(...side(bySlot.right)),
      Math.max(...side(bySlot.left)) - frontZ,
      backZ - Math.min(...side(bySlot.left)),
    ];
  });
  // Negatif değer köşede açıklık demektir; plaka kenarı komşu düzleme en az ulaşmalı.
  for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(-1e-6);

  // Üst yüz: yatay, yukarı bakar, yan plakaların üst kenarını örter ve renk alır.
  const top = await page.evaluate(() => {
    const faces = window.__sceneSurfaces().filter((mesh) => mesh.userData.moduleType === 'box-block' && mesh.userData.faceSlot);
    const bySlot = Object.fromEntries(faces.map((face) => [face.userData.faceSlot, face]));
    const face = bySlot.top;
    if (!face) return null;
    face.updateMatrixWorld(true);
    const normal = face.getWorldDirection(face.position.clone());
    const group = face.parent;
    return {
      normalY: normal.y,
      width: face.geometry.parameters.width,
      depth: face.geometry.parameters.height,
      y: face.position.y,
      bodyHeight: group.userData.heightCm / 100,
      bodyWidth: group.userData.widthCm / 100,
      bodyDepth: group.userData.depthCm / 100,
      rightX: bySlot.right.position.x,
      frontZ: bySlot.front.position.z,
    };
  });
  expect(top).not.toBeNull();
  expect(top.normalY).toBeGreaterThan(0.999);
  expect(top.y).toBeGreaterThan(top.bodyHeight);
  expect(top.width / 2).toBeGreaterThanOrEqual(top.rightX - 1e-6);
  expect(top.depth / 2).toBeGreaterThanOrEqual(top.frontZ - 1e-6);

  // Üstten görünümde üst yüze tıkla, renk ver; kayıtta faces.top.color değişir.
  await page.locator('body').press('t');
  await page.waitForTimeout(400);
  const point = await page.evaluate(() => {
    const top = window.__sceneSurfaces().find((mesh) => mesh.userData.faceSlot === 'top');
    const canvas = document.querySelector('#viewport > canvas').getBoundingClientRect();
    top.updateMatrixWorld(true);
    const screen = top.getWorldPosition(top.position.clone()).project(window.__sceneCamera);
    return {
      x: canvas.left + ((screen.x + 1) / 2) * canvas.width,
      y: canvas.top + ((1 - screen.y) / 2) * canvas.height,
    };
  });
  await page.mouse.click(point.x, point.y);
  const selectedSlot = await page.evaluate(() => window.__sceneSurfaces()
    .find((mesh) => mesh.userData.faceSlot === 'top')?.userData.selectionFrame?.visible === true);
  expect(selectedSlot).toBe(true);
  const panel = page.locator('details', { has: page.locator('#apply-color') });
  if (!(await panel.evaluate((el) => el.open))) await panel.locator(':scope > summary').click();
  await page.locator('#color-hex').fill('#1E40AF');
  await page.locator('#color-hex').press('Enter');
  await page.locator('#apply-color').click();
  await page.locator('#save-project').click();
  await expect(page.locator('#project-status')).toContainText('Kaydedildi');
  const storedTop = await page.evaluate(async () => {
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
    const project = projects.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0];
    return project?.modules?.find((module) => module.type === 'box-block')?.faces?.top ?? null;
  });
  expect(storedTop).not.toBeNull();
  expect(String(storedTop.color).toLowerCase()).toBe('#1e40af');
});
