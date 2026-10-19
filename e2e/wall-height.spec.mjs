import { test, expect } from '@playwright/test';

// Stand kurulumunda seçilen duvar yüksekliği: otomatik duvar o yükseklikteki düz duvardır
// (wall_*_250), sahnede o boyda çizilir ve projeyle kaydedilir.

async function exposeScene(page) {
  await page.route('**/src/scene3d.js*', async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      '  let surfaceMeshes = [];',
      '  let surfaceMeshes = []; window.__sceneSurfaces = () => surfaceMeshes;',
    );
    await route.fulfill({ response, body });
  });
}

async function createBackWallStand(page, { wallHeight, projectName }) {
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Sırt Duvar' }).click();
  await page.locator('#stand-size-x').fill('500');
  await page.locator('#stand-size-y').fill('500');
  if (wallHeight) await page.locator('#wall-height').selectOption(String(wallHeight));
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill(projectName);
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
}

async function savedProject(page) {
  await page.locator('#save-project').click();
  await expect(page.locator('#save-project')).toBeEnabled();
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
    return projects.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0] ?? null;
  });
}

// Duvar panellerinin dünya koordinatında en üst noktası (m).
function wallTopMeters(page) {
  return page.evaluate(() => {
    let top = -Infinity;
    for (const mesh of window.__sceneSurfaces()) {
      if (mesh.userData.moduleType !== 'flat-panel') continue;
      mesh.updateMatrixWorld(true);
      mesh.geometry.computeBoundingBox();
      const box = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
      top = Math.max(top, box.max.y);
    }
    return top;
  });
}

test('250 cm stand builds 250 cm walls with 5 bands and keeps the height', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await exposeScene(page);
  await createBackWallStand(page, { wallHeight: 250, projectName: 'E2E Duvar 250' });

  const project = await savedProject(page);
  expect(project.stand.wallHeightCm).toBe(250);
  const walls = project.modules.filter((module) => Array.isArray(module.strips));
  expect(walls.length).toBeGreaterThan(0);
  for (const wall of walls) {
    expect(wall.itemKey).toMatch(/^wall_(50|100|150|200)_250$/);
    expect(wall.heightCm).toBe(250);
    expect(wall.strips).toHaveLength(5);
  }
  expect(await wallTopMeters(page)).toBeCloseTo(2.5, 1);
  expect(errors).toEqual([]);
});

test('default stand stays 350 cm', async ({ page }) => {
  await exposeScene(page);
  await createBackWallStand(page, { projectName: 'E2E Duvar 350' });
  await expect(page.locator('#wall-height')).toHaveValue('350');
  const project = await savedProject(page);
  const walls = project.modules.filter((module) => Array.isArray(module.strips));
  for (const wall of walls) {
    expect(wall.itemKey).toMatch(/^wall_(50|100|150|200)_350$/);
    expect(wall.strips).toHaveLength(7);
  }
  expect(await wallTopMeters(page)).toBeCloseTo(3.5, 1);
});

test('250 cm stand: door and showcases from the catalog take the stand height', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await createBackWallStand(page, { wallHeight: 250, projectName: 'E2E Duvar 250 Kapı' });
  const initial = await savedProject(page);
  // Otomatik sırt duvarında yer açmak için iki parça silinir.
  for (const wall of initial.modules.filter((module) => Array.isArray(module.strips)).slice(0, 2)) {
    page.once('dialog', (dialog) => dialog.accept());
    await page.evaluate((moduleId) => {
      window.dispatchEvent(new CustomEvent('fair-stand:delete-selected-module', { detail: { moduleId } }));
    }, wall.id);
  }
  const open = page.locator('#open-module-catalog');
  await page.locator('details', { has: open }).locator(':scope > summary').click();
  await open.click();
  const picker = page.locator('.module-picker-backdrop');
  await picker.locator('summary', { hasText: 'Raf & Vitrin' }).click();
  await picker.locator('[data-module-key="wall_showcase_100_2_350"]').click();
  await picker.locator('[data-module-key="wall_showcase_100_3_350"]').click();
  await picker.locator('summary', { hasText: 'Panel & Duvar' }).click();
  await picker.locator('[data-module-key="wall_door_100_350"]').click();
  await picker.locator('.module-picker-add').click();
  await expect(picker).toBeHidden();

  const project = await savedProject(page);
  const byKey = Object.fromEntries(project.modules.filter((m) => Array.isArray(m.strips)).map((m) => [m.itemKey, m]));
  expect(byKey.wall_showcase_100_2_250?.heightCm).toBe(250);
  expect(byKey.wall_showcase_100_3_250?.heightCm).toBe(250);
  // Kapı kanadı 4 bant tutar; 250 cm'de üstte 1 panel.
  expect(byKey.wall_door_100_250?.strips).toHaveLength(1);
  expect(Object.keys(byKey).some((key) => key.endsWith('_350'))).toBe(false);
  expect(errors).toEqual([]);
});

// Katalog kartı (wall_100_350) sürüklenince standın yüksekliğine çevrilir ve bırakılır.
for (const wallHeight of [250, 300, 350, 400, 450, 500]) {
  test(`catalog drag drops a wall on a ${wallHeight} cm island stand`, async ({ page }) => {
    await page.goto('/');
    const standSetup = page.locator('details.stand-setup-card');
    await standSetup.locator('summary').click();
    await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
    await page.locator('#stand-size-x').fill('600');
    await page.locator('#stand-size-y').fill('600');
    await page.locator('#wall-height').selectOption(String(wallHeight));
    await page.locator('#create-stage').click();
    await page.locator('form input[name="projectName"]').fill(`E2E Sürükle ${wallHeight}`);
    await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
    await expect(page.locator('#viewport-toolbar')).toBeVisible();
    const modulePanel = page.locator('details', { has: page.locator('#open-module-catalog') });
    if (!(await modulePanel.evaluate((el) => el.open))) await modulePanel.locator(':scope > summary').click();
    const card = page.locator('.module-drag-card[data-module-key="wall_100_350"]');
    const group = page.locator('.module-drag-group', { has: card });
    if (!(await group.evaluate((el) => el.open))) await group.locator(':scope > summary').click();
    await card.scrollIntoViewIfNeeded();
    // Yüksek duvarda kamera geri çekilir; zemine isabet eden ilk noktaya bırakılır.
    const viewport = await page.locator('#viewport').boundingBox();
    const expected = `wall_100_${wallHeight}`;
    let project = null;
    for (const [x, y] of [[0.7, 0.85], [0.75, 0.92], [0.65, 0.95], [0.55, 0.75], [0.5, 0.65], [0.6, 0.6]]) {
      await card.dragTo(page.locator('#viewport'), {
        targetPosition: { x: Math.round(viewport.width * x), y: Math.round(viewport.height * y) },
      });
      project = await savedProject(page);
      if (project.modules.some((module) => module.itemKey === expected)) break;
    }
    expect(project.modules.map((module) => module.itemKey)).toContain(expected);
    if (wallHeight !== 350) {
      expect(project.modules.some((module) => module.itemKey === 'wall_100_350')).toBe(false);
    }
  });
}

// Kapı kanadı 4 bant tutar; üstündeki her bant sahnede bir panel olarak çizilir (500 → 6).
for (const wallHeight of [250, 300, 350, 400, 450, 500]) {
  test(`door shows ${wallHeight / 50 - 4} upper panels on a ${wallHeight} cm stand`, async ({ page }) => {
    await exposeScene(page);
    await createBackWallStand(page, { wallHeight, projectName: `E2E Kapı ${wallHeight}` });
    const initial = await savedProject(page);
    const wall = initial.modules.find((module) => Array.isArray(module.strips));
    page.once('dialog', (dialog) => dialog.accept());
    await page.evaluate((moduleId) => {
      window.dispatchEvent(new CustomEvent('fair-stand:delete-selected-module', { detail: { moduleId } }));
    }, wall.id);
    const open = page.locator('#open-module-catalog');
    await page.locator('details', { has: open }).locator(':scope > summary').click();
    await open.click();
    const picker = page.locator('.module-picker-backdrop');
    await picker.locator('summary', { hasText: 'Panel & Duvar' }).click();
    await picker.locator('[data-module-key="wall_door_100_350"]').click();
    await picker.locator('.module-picker-add').click();
    await expect(picker).toBeHidden();
    const upperPanels = await page.evaluate(() => window.__sceneSurfaces()
      .filter((mesh) => mesh.userData.moduleType === 'door' && mesh.userData.surfaceRole === 'upper-panel').length);
    expect(upperPanels).toBe(wallHeight / 50 - 4);
  });
}
