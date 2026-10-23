import { test, expect } from '@playwright/test';

async function createNamedStand(page, standName, projectName, xCm, yCm) {
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: standName }).click();
  await page.locator('#stand-size-x').fill(String(xCm / 100));
  await page.locator('#stand-size-y').fill(String(yCm / 100));
  await page.locator('#create-stage').click();
  const projectNameInput = page.locator('form input[name="projectName"]');
  await expect(projectNameInput).toBeVisible();
  await projectNameInput.fill(projectName);
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
}

async function saveAndReadProject(page) {
  const saveButton = page.locator('#save-project');
  await saveButton.click();
  await expect(saveButton).toBeEnabled();
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('fair-stand-configurator', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const projects = await new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readonly');
      const request = tx.objectStore('projects').getAll();
      request.onsuccess = () => resolve(request.result ?? []);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return projects.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0] ?? null;
  });
}

function wallIds(project) {
  return [...new Set(project.modules.map((moduleState) => moduleState.placement?.wallId).filter(Boolean))];
}

test('U Stand otomatik duvar reflow sağ duvarda 270 derece orientation üretir', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await createNamedStand(page, 'U Stand', 'E2E U Reflow', 500, 400);

  const project = await saveAndReadProject(page);
  expect(project.stand.standType).toBe('u-stand');
  const walls = project.modules.filter((moduleState) => moduleState.type === 'flat-panel');
  const lamps = project.modules.filter((moduleState) => moduleState.type === 'led-floodlight');
  expect(walls.map((moduleState) => moduleState.widthCm)).toEqual([200, 200, 200, 200, 100, 200, 200]);
  expect(wallIds({ modules: walls }).sort()).toEqual(['back', 'left', 'right']);
  expect(lamps).toHaveLength(7);
  expect(lamps.every((moduleState) => moduleState.itemKey === 'led_floodlight')).toBe(true);
  expect(lamps.map((moduleState) => moduleState.placement?.wallId)).toEqual([
    'left', 'left', 'back', 'back', 'back', 'right', 'right',
  ]);
  expect(project.modules).toHaveLength(walls.length + lamps.length);

  const rightWall = walls.filter((moduleState) => moduleState.placement?.wallId === 'right');
  const rightLamps = lamps.filter((moduleState) => moduleState.placement?.wallId === 'right');
  expect(rightWall.map((moduleState) => moduleState.widthCm)).toEqual([200, 200]);
  expect(rightWall.every((moduleState) => moduleState.placement.rotationZDeg === 270)).toBe(true);
  expect(rightLamps).toHaveLength(2);
  expect(rightLamps.every((moduleState) => moduleState.placement.rotationZDeg === 270)).toBe(true);
  expect(pageErrors).toEqual([]);
});

test('L Stand Sağ otomatik inşa sağ duvar orientation’ını 270 tutar', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await createNamedStand(page, 'L Stand Sağ', 'E2E L Right Reflow', 500, 400);

  const project = await saveAndReadProject(page);
  expect(project.stand.standType).toBe('l-right');
  const walls = project.modules.filter((moduleState) => moduleState.type === 'flat-panel');
  const lamps = project.modules.filter((moduleState) => moduleState.type === 'led-floodlight');
  expect(wallIds({ modules: walls }).sort()).toEqual(['back', 'right']);
  expect(lamps).toHaveLength(5);
  expect(lamps.map((moduleState) => moduleState.placement?.wallId)).toEqual([
    'back', 'back', 'back', 'right', 'right',
  ]);
  const rightWall = walls.filter((moduleState) => moduleState.placement?.wallId === 'right');
  const rightLamps = lamps.filter((moduleState) => moduleState.placement?.wallId === 'right');
  expect(rightWall.length).toBeGreaterThan(0);
  expect(rightWall.every((moduleState) => moduleState.placement.rotationZDeg === 270)).toBe(true);
  expect(rightLamps.every((moduleState) => moduleState.placement.rotationZDeg === 270)).toBe(true);
  expect(project.modules).toHaveLength(walls.length + lamps.length);
  expect(pageErrors).toEqual([]);
});

test('L Stand Sol otomatik inşa sol ve sırt duvar üretir', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await createNamedStand(page, 'L Stand Sol', 'E2E L Left Reflow', 500, 400);

  const project = await saveAndReadProject(page);
  expect(project.stand.standType).toBe('l-left');
  const walls = project.modules.filter((moduleState) => moduleState.type === 'flat-panel');
  const lamps = project.modules.filter((moduleState) => moduleState.type === 'led-floodlight');
  expect(wallIds({ modules: walls }).sort()).toEqual(['back', 'left']);
  expect(lamps).toHaveLength(5);
  expect(lamps.map((moduleState) => moduleState.placement?.wallId)).toEqual([
    'left', 'left', 'back', 'back', 'back',
  ]);
  expect(project.modules).toHaveLength(walls.length + lamps.length);
  expect(page.locator('#viewport > canvas')).toHaveCount(1);
  expect(pageErrors).toEqual([]);
});
