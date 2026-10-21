import { test, expect } from '@playwright/test';

// Çift tık / çift dokunuş modülün tamamını seçer (turuncu); Ctrl+tık seçilenin çoğulu:
// modül seçiliyse modül ekler/çıkarır, yüzey (panel, banko yüzü) seçiliyse yüzey çoğulu.
// Shift+tık ile modül seçimi yoktur.
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
  await page.locator('#stand-size-x').fill(String(x));
  await page.locator('#stand-size-y').fill(String(y));
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill(`E2E Cift Tik ${standType}`);
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  await page.locator('#autosave-interval').selectOption('0');
  await page.waitForTimeout(400);
}

// Yüzeyler: modül, tür, sıra, ekran noktası, seçili mi.
async function surfaces(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('#viewport > canvas').getBoundingClientRect();
    return window.__sceneSurfaces().map((mesh) => {
      mesh.updateMatrixWorld(true);
      const screen = mesh.getWorldPosition(mesh.position.clone()).project(window.__sceneCamera);
      return {
        surfaceId: mesh.userData.surfaceId,
        moduleId: mesh.userData.moduleId,
        moduleType: mesh.userData.moduleType,
        selectionMode: mesh.userData.selectionMode,
        stripIndex: Number(mesh.userData.stripIndex),
        x: canvas.left + ((screen.x + 1) / 2) * canvas.width,
        y: canvas.top + ((1 - screen.y) / 2) * canvas.height,
        selected: mesh.userData.selectionFrame?.visible === true,
      };
    });
  });
}

async function wallPanelsByModule(page, stripIndex) {
  const panels = (await surfaces(page)).filter((s) => s.selectionMode === 'panel' && s.stripIndex === stripIndex);
  return [...new Map(panels.map((panel) => [panel.moduleId, panel])).values()].sort((a, b) => a.x - b.x);
}

async function ctrlClick(page, point) {
  await page.keyboard.down('Control');
  await page.mouse.click(point.x, point.y);
  await page.keyboard.up('Control');
}

const toolbar = (page) => page.getByRole('toolbar', { name: 'Seçim işlemleri' });

test('double click selects the whole wall module; Ctrl+click adds and removes modules; menu offers group and lock', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await createStand(page, 'Sırt Duvar', 600, 300);
  const [first, second] = await wallPanelsByModule(page, 3);

  // Tek tık paneli seçer (mavi).
  await page.mouse.click(first.x, first.y);
  await expect(toolbar(page).getByRole('button', { name: 'Çoklu panel' })).toBeVisible();
  expect((await surfaces(page)).filter((s) => s.selected).map((s) => s.surfaceId)).toEqual([first.surfaceId]);

  // Çift tık modülün tamamını seçer (turuncu): panel seçimi kalkar.
  await page.mouse.dblclick(first.x, first.y);
  await expect(toolbar(page).getByRole('button', { name: 'Çoklu modül' })).toBeVisible();
  expect((await surfaces(page)).filter((s) => s.selected)).toEqual([]);

  // Ctrl+tık modül ekler, tekrar Ctrl+tık çıkarır.
  const info = page.locator('#selection-info');
  await ctrlClick(page, second);
  await expect(info).toContainText('2 öğe seçili');
  await ctrlClick(page, second);
  await expect(info).not.toContainText('2 öğe seçili');
  await ctrlClick(page, second);
  await expect(info).toContainText('2 öğe seçili');

  // Toplu menü: grup ve kilit.
  await page.mouse.click(second.x, second.y, { button: 'right' });
  const menu = page.getByRole('menu', { name: 'Modül işlemleri' });
  await expect(menu.locator('.module-context-title')).toContainText('2 öğe seçili');
  await expect(menu.getByRole('menuitem', { name: 'Grup oluştur…' })).toBeVisible();
  await expect(menu.locator('.module-context-title')).toContainText('2 kilitli');
  await expect(menu.getByRole('menuitem', { name: 'Seçilenlerin kilidini aç' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Seçilenleri sil' })).toBeDisabled();
  await menu.getByRole('menuitem', { name: 'Seçilenlerin kilidini aç' }).click();
  await page.mouse.click(second.x, second.y, { button: 'right' });
  await expect(menu.getByRole('menuitem', { name: 'Seçilenleri kilitle' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('with a panel selected, Ctrl+click still selects the panel rectangle across modules', async ({ page }) => {
  await createStand(page, 'Sırt Duvar', 600, 300);
  const row = await wallPanelsByModule(page, 3);
  await page.mouse.click(row[0].x, row[0].y);
  await ctrlClick(page, row[2]);
  await expect.poll(async () => (await surfaces(page)).filter((s) => s.selected).map((s) => s.surfaceId).sort())
    .toEqual(row.slice(0, 3).map((panel) => panel.surfaceId).sort());
  await expect(page.locator('#selection-info')).not.toContainText('öğe seçili');
});

test('Shift+click no longer adds a module to the selection', async ({ page }) => {
  await createStand(page, 'Sırt Duvar', 600, 300);
  const [first, second] = await wallPanelsByModule(page, 3);
  await page.mouse.dblclick(first.x, first.y);
  await page.keyboard.down('Shift');
  await page.mouse.click(second.x, second.y);
  await page.keyboard.up('Shift');
  await expect(page.locator('#selection-info')).not.toContainText('2 öğe seçili');
});

test('banko: Ctrl+click on a face still adds faces of the same counter', async ({ page }) => {
  await createStand(page, 'Ada Stand', 500, 500);
  const openCatalogButton = page.locator('#open-module-catalog');
  const modulePanel = page.locator('details', { has: openCatalogButton });
  if (!(await modulePanel.evaluate((el) => el.open))) await modulePanel.locator(':scope > summary').click();
  const card = page.locator('.module-drag-card[data-module-key="desk_banko_200"]');
  const group = page.locator('.module-drag-group', { has: card });
  if (!(await group.evaluate((el) => el.open))) await group.locator(':scope > summary').click();
  await card.scrollIntoViewIfNeeded();
  const box = await page.locator('#viewport').boundingBox();
  await card.dragTo(page.locator('#viewport'), {
    targetPosition: { x: Math.round(box.width * 0.62), y: Math.round(box.height * 0.92) },
  });
  await expect.poll(async () => (await surfaces(page)).filter((s) => s.moduleType === 'counter').length).toBeGreaterThan(1);

  const faces = (await surfaces(page)).filter((s) => s.moduleType === 'counter'
    && s.x > box.x && s.x < box.x + box.width && s.y > box.y && s.y < box.y + box.height);
  await page.mouse.click(faces[0].x, faces[0].y);
  for (const face of faces.slice(1)) {
    if ((await surfaces(page)).filter((s) => s.selected && s.moduleType === 'counter').length >= 2) break;
    await ctrlClick(page, face);
  }
  const selected = (await surfaces(page)).filter((s) => s.selected);
  expect(selected.length).toBeGreaterThanOrEqual(2);
  expect(selected.every((s) => s.moduleType === 'counter')).toBe(true);
  await expect(page.locator('#selection-info')).not.toContainText('öğe seçili');
});

test('tablet: double tap selects the whole module', async ({ page }) => {
  await createStand(page, 'Sırt Duvar', 600, 300);
  const [first] = await wallPanelsByModule(page, 3);
  await page.touchscreen.tap(first.x, first.y);
  await page.touchscreen.tap(first.x, first.y);
  await expect(toolbar(page).getByRole('button', { name: 'Çoklu modül' })).toBeVisible();
  expect((await surfaces(page)).filter((s) => s.selected)).toEqual([]);
});
