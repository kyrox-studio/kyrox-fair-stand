import { test, expect } from '@playwright/test';

// Kopyanın panelinin ekran noktası için sahne yüzeyleri ve kamera testte açılır.
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

async function stripScreenPoint(page, moduleId, stripIndex) {
  return page.evaluate(({ id, index }) => {
    const mesh = window.__sceneSurfaces().find((surface) => (
      surface.userData.moduleId === id && Number(surface.userData.stripIndex) === index
    ));
    const canvas = document.querySelector('#viewport > canvas').getBoundingClientRect();
    mesh.updateMatrixWorld(true);
    const screen = mesh.getWorldPosition(mesh.position.clone()).project(window.__sceneCamera);
    return {
      x: canvas.left + ((screen.x + 1) / 2) * canvas.width,
      y: canvas.top + ((1 - screen.y) / 2) * canvas.height,
    };
  }, { id: moduleId, index: stripIndex });
}

async function createBackWallStand(page, projectName) {
  await exposeScene(page);
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Sırt Duvar' }).click();
  await page.locator('#stand-size-x').fill('500');
  await page.locator('#stand-size-y').fill('500');
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

// Sabit ilk kamera açısında sırt duvarın sağ yarısının önü: kopya oraya oturur.
const COPY_DROP_POINT = { x: 830, y: 530 };

function topStrip(module) {
  return module.strips.find((strip) => strip.stripIndex === module.strips.length - 1);
}

test('duplicating a panel with a metal separator gives the copy its own metal group', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('dialog', (dialog) => dialog.accept());
  await createBackWallStand(page, 'metal-cogaltma');

  // Otomatik sırt duvarında yalnız ilk modülü bırak; sağ tarafta çoğaltma için yer aç.
  const initialProject = await saveAndReadProject(page);
  for (const moduleState of initialProject.modules.slice(1)) {
    await page.evaluate((moduleId) => {
      window.dispatchEvent(new CustomEvent('fair-stand:delete-selected-module', {
        detail: { moduleId },
      }));
    }, moduleState.id);
  }

  const menu = page.getByRole('menu', { name: 'Modül işlemleri' });
  const metalToggle = menu.locator('[data-module-action="toggle-metal-separator"]');

  // Sabit ilk kamera açısında ilk modülün en üst paneli.
  await page.mouse.click(650, 145, { button: 'right' });
  await expect(menu).toBeVisible();
  // Panel dönüşümleri sade menüde "Gelişmiş" altında; kapalıysa aç.
  const advancedToggle = menu.locator('.module-context-advanced-toggle');
  // Sade menü: dönüşüm kapalı başlar.
  await expect(advancedToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(metalToggle).toBeHidden();
  await advancedToggle.click();
  await expect(metalToggle).toHaveText('Metal Separatöre Çevir');
  await metalToggle.click();

  // Seçim çubuğundaki Kopyala: hafızaya alır; orijinalin sağındaki boş duvar önüne tıklamak kopyayı oraya bırakır.
  await page.mouse.click(650, 145);
  await page.getByRole('toolbar', { name: 'Seçim işlemleri' }).getByRole('button', { name: /Kopyala/ }).click();
  await expect(page.locator('.viewport-wrap')).toHaveClass(/catalog-place-armed/);
  await page.mouse.click(COPY_DROP_POINT.x, COPY_DROP_POINT.y);
  await page.keyboard.press('Escape');
  await expect(page.locator('.viewport-wrap')).not.toHaveClass(/catalog-place-armed/);

  const duplicated = await saveAndReadProject(page);
  expect(duplicated.modules).toHaveLength(2);
  const [original, copy] = duplicated.modules.map(topStrip);
  expect(original.isMetalSeparator).toBe(true);
  expect(copy.isMetalSeparator).toBe(true);
  expect(original.metalSeparatorGroupId).toMatch(/^metal-/);
  expect(copy.metalSeparatorGroupId).toMatch(/^metal-/);
  expect(copy.metalSeparatorGroupId).not.toBe(original.metalSeparatorGroupId);

  // Kopyada separatörü kapatmak orijinali etkilememeli.
  const copyModule = duplicated.modules.find((module) => module.id !== initialProject.modules[0].id);
  const copyTop = await stripScreenPoint(page, copyModule.id, copyModule.strips.length - 1);
  await page.mouse.click(copyTop.x, copyTop.y, { button: 'right' });
  await expect(menu).toBeVisible();
  // "Gelişmiş" açık kaldı (oturum boyunca hatırlanır).
  await expect(menu.locator('.module-context-advanced-toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(metalToggle).toHaveText('Normal Panele Çevir');
  await metalToggle.click();

  const afterToggle = await saveAndReadProject(page);
  const [originalAfter, copyAfter] = afterToggle.modules.map(topStrip);
  expect(copyAfter.isMetalSeparator).toBe(false);
  expect(originalAfter.isMetalSeparator).toBe(true);
  expect(originalAfter.metalSeparatorGroupId).toBe(original.metalSeparatorGroupId);
  expect(errors).toEqual([]);
});
