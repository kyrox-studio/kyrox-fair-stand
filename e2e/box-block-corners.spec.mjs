import { test, expect } from '@playwright/test';

// Kutu blok yüz plakaları kutunun dış sınırına oturur ve her kenarda sıfır açıklıkla kavuşur:
// gövde rengi hiçbir köşede çizgi olarak görünmez.
async function exposeScene(page) {
  await page.route('**/src/scene3d.js*', async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace(
        'const controls = new OrbitControls(camera, renderer.domElement);',
        'const controls = new OrbitControls(camera, renderer.domElement); window.__sceneCamera = camera;',
      )
      .replace(
        '  let fabricOverlayMeshes = [];',
        '  let fabricOverlayMeshes = []; window.__sceneFabric = () => fabricOverlayMeshes;',
      )
      .replace(
        '  let surfaceMeshes = [];',
        '  let surfaceMeshes = []; window.__sceneSurfaces = () => surfaceMeshes;',
      );
    await route.fulfill({ response, body });
  });
}

async function faceScreenPoint(page, slot) {
  return page.evaluate((faceSlot) => {
    const face = window.__sceneSurfaces().find((mesh) => mesh.userData.faceSlot === faceSlot);
    const canvas = document.querySelector('#viewport > canvas').getBoundingClientRect();
    face.updateMatrixWorld(true);
    const screen = face.getWorldPosition(face.position.clone()).project(window.__sceneCamera);
    return {
      x: canvas.left + ((screen.x + 1) / 2) * canvas.width,
      y: canvas.top + ((1 - screen.y) / 2) * canvas.height,
    };
  }, slot);
}

async function applyLightboxToFace(page, slot, viewKey) {
  await page.locator('body').press(viewKey);
  await page.waitForTimeout(400);
  const point = await faceScreenPoint(page, slot);
  await page.mouse.click(point.x, point.y);
  await expect.poll(() => page.evaluate((faceSlot) => window.__sceneSurfaces()
    .find((mesh) => mesh.userData.faceSlot === faceSlot)?.userData.selectionFrame?.visible === true, slot)).toBe(true);
  await page.mouse.click(point.x, point.y, { button: 'right' });
  // Panel dönüşümleri sade menüde "Gelişmiş" altında; kapalıysa aç.
  const advancedToggle = page.getByRole('menu', { name: 'Modül işlemleri' }).locator('.module-context-advanced-toggle');
  if ((await advancedToggle.getAttribute('aria-expanded')) !== 'true') await advancedToggle.click();
  await page.locator('[data-module-action="toggle-fabric"]').click();
  await expect.poll(() => page.evaluate((faceSlot) => Boolean(window.__sceneSurfaces()
    .find((mesh) => mesh.userData.faceSlot === faceSlot)?.userData.surfaceState?.fabricGroupId), slot)).toBe(true);
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
  // Negatif değer köşede açıklık, pozitif değer taşma demektir; ikisi de sıfır olmalı.
  for (const gap of gaps) expect(Math.abs(gap)).toBeLessThan(1e-6);

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
      // Yan plakaların üst kenarı (yerel +H/2) üst plakanın düzlemine ulaşmalı.
      sideTops: ['front', 'right', 'back', 'left'].map((slot) => {
        const side = bySlot[slot];
        side.updateMatrixWorld(true);
        const edge = side.localToWorld(side.position.clone().set(0, side.geometry.parameters.height / 2, 0));
        return edge.applyMatrix4(group.matrixWorld.clone().invert()).y;
      }),
      sideBottoms: ['front', 'right', 'back', 'left'].map((slot) => bySlot[slot].position.y - bySlot[slot].geometry.parameters.height / 2),
      bodyBox: (() => {
        const body = group.children.find((child) => child.userData?.selectionMode === 'module');
        const p = body.geometry.parameters;
        return { width: p.width, height: p.height, depth: p.depth, y: body.position.y };
      })(),
    };
  });
  expect(top).not.toBeNull();
  expect(top.normalY).toBeGreaterThan(0.999);
  // Kutu tam ölçüdedir: üst plaka tepede, kenarları yan plakaların düzleminde.
  expect(Math.abs(top.y - top.bodyHeight)).toBeLessThan(1e-6);
  expect(Math.abs(top.width / 2 - top.rightX)).toBeLessThan(1e-6);
  expect(Math.abs(top.depth / 2 - top.frontZ)).toBeLessThan(1e-6);
  expect(Math.abs(top.rightX - top.bodyWidth / 2)).toBeLessThan(1e-6);
  expect(Math.abs(top.frontZ - top.bodyDepth / 2)).toBeLessThan(1e-6);
  for (const sideTop of top.sideTops) expect(Math.abs(sideTop - top.y)).toBeLessThan(1e-6);
  for (const sideBottom of top.sideBottoms) expect(Math.abs(sideBottom)).toBeLessThan(1e-6);
  // Gövde plakaların içinde kalır; aynı düzlemde titreşmez ve dışarı taşmaz.
  expect(top.bodyBox.width).toBeLessThan(top.bodyWidth);
  expect(top.bodyBox.depth).toBeLessThan(top.bodyDepth);
  expect(top.bodyBox.y + top.bodyBox.height / 2).toBeLessThan(top.y);

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

  // Lightbox bezi yüz düzlemine oturur: kenarda komşu bezle sıfır açıklıkla kavuşur, kutudan taşmaz.
  await applyLightboxToFace(page, 'top', 't');
  await applyLightboxToFace(page, 'front', 'f');
  const fabric = await page.evaluate(() => {
    const overlays = window.__sceneFabric();
    const faces = window.__sceneSurfaces().filter((mesh) => mesh.userData.moduleType === 'box-block' && mesh.userData.faceSlot);
    const bySlot = Object.fromEntries(faces.map((face) => [face.userData.faceSlot, face]));
    const group = bySlot.front.parent;
    group.updateMatrixWorld(true);
    const toGroup = group.matrixWorld.clone().invert();
    const corners = (mesh) => {
      mesh.updateMatrixWorld(true);
      const { width, height } = mesh.geometry.parameters;
      return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => mesh
        .localToWorld(mesh.position.clone().set((sx * width) / 2, (sy * height) / 2, 0))
        .applyMatrix4(toGroup));
    };
    return {
      count: overlays.length,
      overlays: overlays.map((overlay) => corners(overlay).map((p) => [p.x, p.y, p.z])),
      box: { w: group.userData.widthCm / 100, d: group.userData.depthCm / 100, h: group.userData.heightCm / 100 },
    };
  });
  expect(fabric.count).toBe(2);
  const { w, d, h } = fabric.box;
  const flat = fabric.overlays.flat();
  // Hiçbir bez köşesi kutunun dış sınırını aşmaz.
  for (const [x, y, z] of flat) {
    expect(Math.abs(x)).toBeLessThan(w / 2 + 1e-6);
    expect(Math.abs(z)).toBeLessThan(d / 2 + 1e-6);
    expect(y).toBeLessThan(h + 1e-6);
    expect(y).toBeGreaterThan(-1e-6);
  }
  // Üst bez tam tepede, ön bez tam ön düzlemde; ön-üst kenar iki bezde aynı çizgidir.
  const topOverlay = fabric.overlays.find((corners) => corners.every(([, y]) => Math.abs(y - h) < 1e-6));
  const frontOverlay = fabric.overlays.find((corners) => corners.every(([, , z]) => Math.abs(z - d / 2) < 1e-6));
  expect(topOverlay).toBeTruthy();
  expect(frontOverlay).toBeTruthy();
  const topFrontEdge = topOverlay.filter(([, , z]) => Math.abs(z - d / 2) < 1e-6);
  const frontTopEdge = frontOverlay.filter(([, y]) => Math.abs(y - h) < 1e-6);
  expect(topFrontEdge.length).toBe(2);
  expect(frontTopEdge.length).toBe(2);
});
