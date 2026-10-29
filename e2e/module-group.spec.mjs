import { openEditorSettings } from './helpers/editorSettings.mjs';
import { test, expect } from '@playwright/test';

async function exposeScene(page) {
  // Gerçek sahne durumunu üretime debug API eklemeden okur.
  await page.route('**/src/scene3d.js*', async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace(
        'const controls = new OrbitControls(camera, renderer.domElement);',
        'const controls = new OrbitControls(camera, renderer.domElement); window.__sceneCamera = camera; window.__sceneGridVisible = () => scene.getObjectByName("stand-floor-grid")?.visible;',
      )
      .replace(
        '  let surfaceMeshes = [];',
        '  let surfaceMeshes = []; window.__sceneSurfaces = () => surfaceMeshes;',
      );
    await route.fulfill({ response, body });
  });
}

async function createIslandStand(page) {
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('6');
  await page.locator('#stand-size-y').fill('5');
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill('E2E Grup');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  await openEditorSettings(page);
  await page.locator('#autosave-interval').selectOption('0');
  // Üstten görünüm: stand ekranın ortasında, sürükleme yönleri net.
  await page.locator('body').press('t');
  await page.waitForTimeout(400);
}

async function dropBoxBlock(page, xRatio) {
  const openCatalogButton = page.locator('.module-drag-catalog');
  const modulePanel = page.locator('details', { has: openCatalogButton });
  if (!(await modulePanel.evaluate((el) => el.open))) await modulePanel.locator(':scope > summary').click();
  const card = page.locator('.module-drag-card[data-module-key="box_block"]');
  const group = page.locator('.module-drag-group', { has: card });
  if (!(await group.evaluate((el) => el.open))) await group.locator(':scope > summary').click();
  await card.scrollIntoViewIfNeeded();
  const viewport = await page.locator('#viewport').boundingBox();
  await card.dragTo(page.locator('#viewport'), {
    targetPosition: { x: Math.round(viewport.width * xRatio), y: Math.round(viewport.height * 0.5) },
  });
  await expect(page.locator('#box-block-size-title')).toBeVisible();
  await page.locator('input[name="opacity"]').fill('1');
  await page.getByRole('button', { name: 'Uygula' }).click();
  await expect(page.locator('#box-block-size-title')).toHaveCount(0);
}

// Her kutu bloğun kameraya en dönük yüzünün ekran noktası, modül kimliğine göre.
function boxScreenPoints(page) {
  return page.evaluate(() => {
    const camera = window.__sceneCamera;
    const canvas = document.querySelector('#viewport > canvas').getBoundingClientRect();
    const byModule = new Map();
    window.__sceneSurfaces()
      .filter((mesh) => mesh.userData.moduleType === 'box-block' && mesh.userData.faceSlot)
      .forEach((face) => {
        face.updateMatrixWorld(true);
        const center = face.getWorldPosition(face.position.clone());
        const normal = face.getWorldDirection(face.position.clone());
        const facing = normal.dot(camera.position.clone().sub(center).normalize());
        const screen = center.clone().project(camera);
        const point = {
          facing,
          x: canvas.left + ((screen.x + 1) / 2) * canvas.width,
          y: canvas.top + ((1 - screen.y) / 2) * canvas.height,
        };
        const moduleId = face.userData.moduleId;
        if (!byModule.has(moduleId) || byModule.get(moduleId).facing < facing) byModule.set(moduleId, point);
      });
    return Object.fromEntries(byModule);
  });
}

async function storedModules(page) {
  await page.locator('#save-project').click();
  await expect(page.locator('#project-status')).toContainText('Kaydedildi');
  return page.evaluate(async () => {
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
    return projects.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0]?.modules ?? [];
  });
}

// Kutuların sahne nesneleri (modül kimliği → uuid). Grup işlemi sahneyi baştan kurmazsa aynı kalır.
function bodyUuids(page) {
  return page.evaluate(() => Object.fromEntries(window.__sceneSurfaces()
    .filter((mesh) => mesh.userData.moduleType === 'box-block' && mesh.userData.selectionMode === 'module')
    .map((mesh) => [mesh.userData.moduleId, mesh.uuid])));
}

function boxes(modules) {
  return modules.filter((module) => module.type === 'box-block');
}

function selectionFrames(page) {
  return page.evaluate(() => {
    let root = window.__sceneSurfaces()[0];
    while (root.parent) root = root.parent;
    const frames = [];
    root.traverse(object => {
      if (object.visible && object.isLineSegments && object.userData.isModuleSelectionVisual) {
        object.geometry.computeBoundingBox();
        const box = object.geometry.boundingBox;
        frames.push({ group: object.name === 'group-selection-bounds',
          dashed: Boolean(object.material.isLineDashedMaterial), color: object.material.color.getHex(),
          width: box.max.x - box.min.x });
      }
    });
    return frames;
  });
}

test('öğeden bağımsız grup: oluştur, birlikte taşı, kilitle, çoğalt, sil, çöz', async ({ page }) => {
  test.setTimeout(process.env.CI ? 240_000 : 120_000);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await exposeScene(page);
  await createIslandStand(page);
  await dropBoxBlock(page, 0.38);
  await dropBoxBlock(page, 0.62);

  // Tek öğe sürüklemesi de aynı ızgara kuralını izler.
  const singlePoints = Object.values(await boxScreenPoints(page));
  await page.mouse.move(singlePoints[0].x, singlePoints[0].y);
  await page.mouse.down();
  await page.mouse.move(singlePoints[0].x + 35, singlePoints[0].y + 10, { steps: 6 });
  await expect.poll(() => page.evaluate(() => window.__sceneGridVisible())).toBe(true);
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__sceneGridVisible())).toBe(false);
  const initial = boxes(await storedModules(page));
  expect(initial).toHaveLength(2);
  const [first, second] = initial;

  // Çift tık + Ctrl+tık ile iki kutuyu seç, sağ tık > Grup oluştur.
  const bodiesBeforeGroup = await bodyUuids(page);
  expect(Object.keys(bodiesBeforeGroup)).toHaveLength(2);
  const points = await boxScreenPoints(page);
  await page.mouse.dblclick(points[first.id].x, points[first.id].y);
  await expect.poll(() => selectionFrames(page)).toEqual([
    { group: false, dashed: true, color: 0x2563eb, width: expect.any(Number) },
  ]);
  await page.keyboard.down('Control');
  await page.mouse.click(points[second.id].x, points[second.id].y);
  await page.keyboard.up('Control');
  page.once('dialog', (dialog) => dialog.accept('Sağ duvar'));
  await page.mouse.click(points[second.id].x, points[second.id].y, { button: 'right' });
  const menu = page.getByRole('menu', { name: 'Modül işlemleri' });
  await menu.getByRole('menuitem', { name: 'Grup oluştur…' }).click();
  await expect(page.locator('#selection-info')).toContainText('“Sağ duvar” grubu oluşturuldu · 2 parça');
  await page.mouse.click(points[first.id].x, points[first.id].y);
  await expect.poll(async () => (await selectionFrames(page)).map(({ group, dashed, color }) => ({ group, dashed, color })))
    .toEqual([{ group: true, dashed: true, color: 0xf97316 }]);
  const [groupFrame] = await selectionFrames(page);
  expect(groupFrame.width).toBeGreaterThan(first.widthCm / 100 + 0.02);
  await page.screenshot({ path: 'test-results/group-dashed-selection.png' });

  await page.locator('#editor-mode-advanced').click();
  const groupsCard = page.locator('#module-groups-card');
  if (!(await groupsCard.evaluate((el) => el.open))) await groupsCard.locator(':scope > summary').click();
  const row = groupsCard.locator('.module-group-row', { hasText: 'Sağ duvar' });
  await expect(row.locator('.module-group-meta')).toHaveText('2 parça');
  await row.locator('summary').click();
  await row.getByRole('button', { name: 'Seç', exact: true }).click();
  await row.locator('summary').click();
  // Grup oluşturmak kutuları yeniden yaratmaz.
  expect(await bodyUuids(page)).toEqual(bodiesBeforeGroup);

  let grouped = boxes(await storedModules(page));
  expect(grouped.every((module) => module.group?.name === 'Sağ duvar')).toBe(true);

  // Bir üyeden sürükleyince ikisi de aynı kaydırmayla taşınır.
  const dragPoints = await boxScreenPoints(page);
  const start = dragPoints[first.id];
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 40, start.y + 10, { steps: 6 });
  await page.mouse.move(start.x + 80, start.y + 20, { steps: 6 });
  await expect.poll(() => page.evaluate(() => window.__sceneGridVisible())).toBe(true);
  await expect(page.locator('.scene-measure-label')).toHaveCount(0);
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__sceneGridVisible())).toBe(false);
  const moved = boxes(await storedModules(page));
  const deltaOf = (before, after) => ({
    dx: after.placement.xCm - before.placement.xCm,
    dy: after.placement.yCm - before.placement.yCm,
  });
  const movedFirst = moved.find((module) => module.id === first.id);
  const movedSecond = moved.find((module) => module.id === second.id);
  const firstDelta = deltaOf(grouped.find((m) => m.id === first.id), movedFirst);
  const secondDelta = deltaOf(grouped.find((m) => m.id === second.id), movedSecond);
  expect(Math.abs(firstDelta.dx) + Math.abs(firstDelta.dy)).toBeGreaterThan(0);
  expect(secondDelta).toEqual(firstDelta);

  // Gelişmiş modda ölçüler kapalı olsa da taşıma ızgarası çalışır.
  await page.locator('#editor-mode-advanced').click();
  await openEditorSettings(page);
  await page.locator('#show-measurements').uncheck();
  // Çok uzağa sürükleme stand dışına taşırmaz.
  const farPoints = await boxScreenPoints(page);
  const farStart = farPoints[first.id];
  await page.mouse.move(farStart.x, farStart.y);
  await page.mouse.down();
  await page.mouse.move(farStart.x + 2000, farStart.y, { steps: 10 });
  await page.mouse.up();
  const clamped = boxes(await storedModules(page));
  for (const module of clamped) {
    expect(module.placement.xCm).toBeGreaterThanOrEqual(0);
    expect(module.placement.xCm + module.widthCm).toBeLessThanOrEqual(600);
  }

  // Shift+R gruptaki öğede bütün grubu 45° döndürür; parçalar arası mesafe korunur, Ctrl+Z geri alır.
  const centerOf = (module) => {
    const rotation = ((Number(module.placement.rotationZDeg) % 360) + 360) % 360;
    const vertical = rotation === 90 || rotation === 270;
    return {
      x: module.placement.xCm + (vertical ? 0 : module.widthCm / 2),
      y: module.placement.yCm + (vertical ? module.widthCm / 2 : 0),
    };
  };
  const gap = (list) => {
    const [a, b] = list.map(centerOf);
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const beforeRotate = clamped;
  const rotatePoints = await boxScreenPoints(page);
  await page.mouse.click(rotatePoints[first.id].x, rotatePoints[first.id].y);
  await page.keyboard.press('Shift+R');
  const rotated = boxes(await storedModules(page));
  // Yön tek öğedeki Shift+R ile aynıdır; bütün üyeler aynı 45° kadar döner.
  const turns = rotated.map((module) => {
    const original = beforeRotate.find((m) => m.id === module.id);
    return (((Number(module.placement.rotationZDeg) - Number(original.placement.rotationZDeg)) % 360) + 360) % 360;
  });
  expect([45, 315]).toContain(turns[0]);
  expect(new Set(turns).size).toBe(1);
  expect(Math.abs(gap(rotated) - gap(beforeRotate))).toBeLessThan(0.5);
  await page.keyboard.press('Control+z');
  const undone = boxes(await storedModules(page));
  expect(undone.map((m) => m.placement.rotationZDeg)).toEqual(beforeRotate.map((m) => m.placement.rotationZDeg));

  // Kilitli grup taşınmaz.
  await row.locator('summary').click();
  await row.locator('[data-group-action="group-lock"]').click();
  await expect(row.locator('.module-group-meta')).toHaveText('2 parça · Kilitli');
  const lockedBefore = boxes(await storedModules(page));
  const lockedPoints = await boxScreenPoints(page);
  const lockedStart = lockedPoints[first.id];
  await page.mouse.move(lockedStart.x, lockedStart.y);
  await page.mouse.down();
  await page.mouse.move(lockedStart.x - 60, lockedStart.y, { steps: 6 });
  await page.mouse.up();
  const lockedAfter = boxes(await storedModules(page));
  expect(lockedAfter.map((m) => m.placement)).toEqual(lockedBefore.map((m) => m.placement));
  await expect(row.locator('[data-group-action="group-delete"]')).toBeDisabled();
  await row.locator('[data-group-action="group-lock"]').click();
  await expect(row.locator('.module-group-meta')).toHaveText('2 parça');

  // Çoğalt: yeni, kilitsiz kopya grup.
  const bodiesBeforeDuplicate = await bodyUuids(page);
  await row.locator('[data-group-action="group-duplicate"]').click();
  await expect(page.locator('#selection-info')).toContainText('yeni grup “Sağ duvar (kopya)”');
  const copyRow = groupsCard.locator('.module-group-row', { hasText: 'Sağ duvar (kopya)' });
  await expect(copyRow.locator('.module-group-meta')).toHaveText('2 parça');
  expect(boxes(await storedModules(page))).toHaveLength(4);
  // Kopyalar eklenir; asıl kutular aynı sahne nesnesi olarak kalır.
  const bodiesAfterDuplicate = await bodyUuids(page);
  expect(Object.keys(bodiesAfterDuplicate)).toHaveLength(4);
  for (const [moduleId, uuid] of Object.entries(bodiesBeforeDuplicate)) expect(bodiesAfterDuplicate[moduleId]).toBe(uuid);

  // Sil: onay sormaz, kopya grubun bütün parçaları gider (Geri al ile döner).
  const deleteDialogs = [];
  const onDeleteDialog = (dialog) => { deleteDialogs.push(dialog.message()); void dialog.dismiss(); };
  page.on('dialog', onDeleteDialog);
  await copyRow.locator('summary').click();
  await copyRow.locator('[data-group-action="group-delete"]').click();
  await expect(copyRow).toHaveCount(0);
  page.off('dialog', onDeleteDialog);
  expect(deleteDialogs).toEqual([]);
  expect(boxes(await storedModules(page))).toHaveLength(2);
  expect(await bodyUuids(page)).toEqual(bodiesBeforeDuplicate);

  // Çöz: parçalar yerinde kalır, grup bilgisi silinir.
  const rowAgain = groupsCard.locator('.module-group-row', { hasText: 'Sağ duvar' });
  if (!(await rowAgain.locator('details').evaluate((el) => el.open))) await rowAgain.locator('summary').click();
  await rowAgain.locator('[data-group-action="group-dissolve"]').click();
  await expect(groupsCard.locator('.module-group-row')).toHaveCount(0);
  expect(await bodyUuids(page)).toEqual(bodiesBeforeDuplicate);
  const dissolved = boxes(await storedModules(page));
  expect(dissolved.every((module) => !module.group)).toBe(true);
  expect(pageErrors).toEqual([]);
});
