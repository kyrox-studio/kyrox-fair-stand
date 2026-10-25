import { openEditorSettings } from './helpers/editorSettings.mjs';
import { test, expect } from '@playwright/test';
import { disableAutoFurniture, keepWallLock } from './helpers/standSetup.mjs';

// Tablette çoklu panel: seçim çubuğunda "Çoklu panel"e basıp parmağı bir panelden diğerine
// kaydırmak, Ctrl + tık ile aynı dikdörtgeni seçer (komşu modüller ve köşe dahil). Tek seferliktir.
test.use({ viewport: { width: 1180, height: 820 }, hasTouch: true });

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

async function createStand(page, standType, x, y) {
  await exposeScene(page);
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: standType }).click();
  await page.locator('#stand-size-x').fill(String(x / 100));
  await page.locator('#stand-size-y').fill(String(y / 100));
  await disableAutoFurniture(page);
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill(`E2E Panel Tarama ${standType}`);
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await keepWallLock(page);
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  await openEditorSettings(page);
  await page.locator('#autosave-interval').selectOption('0');
  await page.waitForTimeout(400);
}

async function moduleWalls(page) {
  await page.locator('#save-project').click();
  await expect(page.locator('#save-project')).toBeEnabled();
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
    const project = projects.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0];
    return Object.fromEntries((project?.modules ?? []).map((module) => [module.id, module.placement?.wallId ?? null]));
  });
}

// Panel yüzeyleri: modül, sıra, ekran noktası, seçili mi, Lightbox grubu.
async function panels(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('#viewport > canvas').getBoundingClientRect();
    return window.__sceneSurfaces()
      .filter((mesh) => mesh.userData.selectionMode === 'panel' && Number.isInteger(Number(mesh.userData.stripIndex)))
      .map((mesh) => {
        mesh.updateMatrixWorld(true);
        const screen = mesh.getWorldPosition(mesh.position.clone()).project(window.__sceneCamera);
        return {
          surfaceId: mesh.userData.surfaceId,
          moduleId: mesh.userData.moduleId,
          stripIndex: Number(mesh.userData.stripIndex),
          x: canvas.left + ((screen.x + 1) / 2) * canvas.width,
          y: canvas.top + ((1 - screen.y) / 2) * canvas.height,
          selected: mesh.userData.selectionFrame?.visible === true,
          fabricGroupId: mesh.userData.surfaceState?.fabricGroupId ?? null,
        };
      });
  });
}

// Gerçek dokunuş (Chromium dokunmatik girişi): bas, adım adım kaydır, kaldır.
async function sweep(page, from, to) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y, id: 1 }] });
  for (let step = 1; step <= 12; step += 1) {
    const t = step / 12;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, id: 1 }],
    });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

async function startPanelSweep(page, panel) {
  const toolbar = page.getByRole('toolbar', { name: 'Seçim işlemleri' });
  await page.touchscreen.tap(panel.x, panel.y);
  await expect(toolbar).toBeVisible();
  const multi = toolbar.getByRole('button', { name: 'Çoklu panel' });
  await multi.tap();
  await expect(multi).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.viewport-wrap')).toHaveClass(/multi-select-panel/);
  return { toolbar, multi };
}

test('finger sweep selects the middle two rows across three wall modules and converts them to Lightbox', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await createStand(page, 'Sırt Duvar', 600, 300);

  const all = await panels(page);
  // Sırt duvarı soldan sağa: ilk üç modül.
  const modules = [...new Set(all.map((panel) => panel.moduleId))]
    .map((moduleId) => ({ moduleId, x: all.find((panel) => panel.moduleId === moduleId).x }))
    .sort((a, b) => a.x - b.x)
    .slice(0, 3)
    .map((entry) => entry.moduleId);
  expect(modules).toHaveLength(3);
  const at = (moduleId, stripIndex) => all.find((panel) => panel.moduleId === moduleId && panel.stripIndex === stripIndex);
  const from = at(modules[0], 2);
  const to = at(modules[2], 3);

  const { toolbar, multi } = await startPanelSweep(page, from);
  await sweep(page, from, to);

  const expected = modules.flatMap((moduleId) => [2, 3].map((stripIndex) => at(moduleId, stripIndex).surfaceId)).sort();
  await expect.poll(async () => (await panels(page)).filter((panel) => panel.selected).map((panel) => panel.surfaceId).sort())
    .toEqual(expected);

  // Tek seferlik: mod kapandı, çerçeve gitti; seçim kaldı.
  await expect(multi).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.viewport-wrap')).not.toHaveClass(/multi-select-panel/);

  // Tarama bitince Özellikler paneli açılır.
  const menu = page.getByRole('menu', { name: 'Modül işlemleri' });
  await expect(menu).toBeVisible();
  await menu.locator('[data-module-action="toggle-fabric"]').click();

  // 6 panel tek Lightbox grubunda; diğer paneller dokunulmadı.
  await expect.poll(async () => {
    const groups = (await panels(page))
      .filter((panel) => expected.includes(panel.surfaceId))
      .map((panel) => panel.fabricGroupId);
    return groups.every(Boolean) && new Set(groups).size === 1;
  }).toBe(true);
  const others = (await panels(page)).filter((panel) => !expected.includes(panel.surfaceId));
  expect(others.every((panel) => !panel.fabricGroupId)).toBe(true);
  expect(errors).toEqual([]);
});

test('finger sweep turns the corner of an L stand', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await createStand(page, 'L Stand Sol', 600, 400);
  const walls = await moduleWalls(page);
  const all = await panels(page);
  const onWall = (wallId) => all.filter((panel) => walls[panel.moduleId] === wallId);
  // Sol duvarda köşeden en uzak (ekranda en alttaki), arka duvarda köşeden en uzak (en sağdaki) modül.
  const leftPanel = onWall('left').filter((panel) => panel.stripIndex === 2).sort((a, b) => b.y - a.y)[0];
  const backPanel = onWall('back').filter((panel) => panel.stripIndex === 4).sort((a, b) => b.x - a.x)[0];
  expect(leftPanel).toBeTruthy();
  expect(backPanel).toBeTruthy();

  await startPanelSweep(page, leftPanel);
  await sweep(page, leftPanel, backPanel);

  await expect.poll(async () => {
    const selected = (await panels(page)).filter((panel) => panel.selected);
    return {
      rows: [...new Set(selected.map((panel) => panel.stripIndex))].sort(),
      walls: [...new Set(selected.map((panel) => walls[panel.moduleId]))].sort(),
      anchor: selected.some((panel) => panel.surfaceId === leftPanel.surfaceId),
      end: selected.some((panel) => panel.surfaceId === backPanel.surfaceId),
    };
  }).toEqual({ rows: [2, 3, 4], walls: ['back', 'left'], anchor: true, end: true });
  expect(errors).toEqual([]);
});

test('tapping a second panel in panel mode selects the rectangle like Ctrl + click', async ({ page }) => {
  await createStand(page, 'Sırt Duvar', 600, 300);
  const all = await panels(page);
  const modules = [...new Set(all.map((panel) => panel.moduleId))]
    .map((moduleId) => ({ moduleId, x: all.find((panel) => panel.moduleId === moduleId).x }))
    .sort((a, b) => a.x - b.x)
    .slice(0, 3)
    .map((entry) => entry.moduleId);
  const at = (moduleId, stripIndex) => all.find((panel) => panel.moduleId === moduleId && panel.stripIndex === stripIndex);

  // Panele dokun → Çoklu panel → diğer panele dokun (kaydırmadan).
  const { multi } = await startPanelSweep(page, at(modules[0], 2));
  const target = at(modules[2], 3);
  await page.touchscreen.tap(target.x, target.y);

  const expected = modules.flatMap((moduleId) => [2, 3].map((stripIndex) => at(moduleId, stripIndex).surfaceId)).sort();
  await expect.poll(async () => (await panels(page)).filter((panel) => panel.selected).map((panel) => panel.surfaceId).sort())
    .toEqual(expected);
  await expect(multi).toHaveAttribute('aria-pressed', 'false');
});

test('without the panel mode a finger drag does not select panels', async ({ page }) => {
  await createStand(page, 'Sırt Duvar', 600, 300);
  const all = await panels(page);
  const sorted = [...all].filter((panel) => panel.stripIndex === 2).sort((a, b) => a.x - b.x);
  await sweep(page, sorted[0], sorted[2]);
  const selected = (await panels(page)).filter((panel) => panel.selected);
  expect(selected.length).toBeLessThanOrEqual(1);
});
