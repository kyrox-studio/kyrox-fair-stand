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
