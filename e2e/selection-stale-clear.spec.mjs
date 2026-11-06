import { test, expect } from '@playwright/test';
import { openEditorSettings } from './helpers/editorSettings.mjs';
import { catalogCardKeyFor, chooseCatalogWidth } from './helpers/catalogWidth.mjs';
import { disableAutoFurniture, keepWallLock } from './helpers/standSetup.mjs';

// Normal tık önceki seçimin bütün izlerini kaldırır: yüzey çerçevesi, parlama, modül çerçevesi.
test.use({ viewport: { width: 1280, height: 860 } });

async function exposeScene(page) {
  await page.route('**/src/scene3d.js*', async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace(
        'const controls = new OrbitControls(camera, renderer.domElement);',
        'const controls = new OrbitControls(camera, renderer.domElement); window.__sceneCamera = camera; window.__sceneRoot = scene;',
      )
      .replace('  let surfaceMeshes = [];', '  let surfaceMeshes = []; window.__sceneSurfaces = () => surfaceMeshes;');
    await route.fulfill({ response, body });
  });
}

async function createStand(page) {
  await exposeScene(page);
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('6');
  await page.locator('#stand-size-y').fill('6');
  await disableAutoFurniture(page);
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill('E2E Secim Temizleme');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await keepWallLock(page);
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  await openEditorSettings(page);
  await page.locator('#autosave-interval').selectOption('0');
  await page.waitForTimeout(400);
}

async function dropCard(page, itemKey, ratioX, ratioY) {
  const key = catalogCardKeyFor(itemKey);
  const openCatalogButton = page.locator('.module-drag-catalog');
  const modulePanel = page.locator('details', { has: openCatalogButton });
  if (!(await modulePanel.evaluate((el) => el.open))) await modulePanel.locator(':scope > summary').click();
  const card = page.locator(`.module-drag-card[data-module-key="${key}"]`);
  const group = page.locator('.module-drag-group', { has: card });
  if (!(await group.evaluate((el) => el.open))) await group.locator(':scope > summary').click();
  await card.scrollIntoViewIfNeeded();
  const box = await page.locator('#viewport').boundingBox();
  await card.dragTo(page.locator('#viewport'), {
    targetPosition: { x: Math.round(box.width * ratioX), y: Math.round(box.height * ratioY) },
  });
}

// Sahnedeki bütün seçim izleri ve her yüzeyin ekran noktası.
async function sceneState(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('#viewport > canvas').getBoundingClientRect();
    const glowing = [];
    const frames = [];
    window.__sceneRoot.traverse((object) => {
      // Yüzeyin kendi çerçevesi de aynı bayrağı taşır; burada yalnız modül çerçevesi sayılır.
      if (object.userData?.isModuleSelectionVisual && object.visible && object.parent?.userData?.kind !== 'surface') frames.push(object.parent?.userData?.moduleId ?? 'module');
    });
    const surfaces = window.__sceneSurfaces().map((mesh) => {
      mesh.updateMatrixWorld(true);
      const screen = mesh.getWorldPosition(mesh.position.clone()).project(window.__sceneCamera);
      const framed = mesh.userData.selectionFrame?.visible === true;
      const glow = (mesh.material?.emissiveIntensity ?? 0) > 0 && mesh.material?.emissive?.getHex?.() !== 0;
      if (framed || glow) glowing.push(`${mesh.userData.moduleType}:${framed ? 'cerceve' : ''}${glow ? 'parlama' : ''}`);
      return {
        moduleId: mesh.userData.moduleId,
        moduleType: mesh.userData.moduleType,
        x: canvas.left + ((screen.x + 1) / 2) * canvas.width,
        y: canvas.top + ((1 - screen.y) / 2) * canvas.height,
      };
    });
    return { glowing, frames, surfaces };
  });
}

test('normal tıklar önceki seçimi bırakmaz: banko, başka öğe, boş alan', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await createStand(page);
  await dropCard(page, 'desk_banko_200', 0.45, 0.8);
  await chooseCatalogWidth(page, 'desk_banko_200');
  await dropCard(page, 'base_100', 0.64, 0.92);
  await chooseCatalogWidth(page, 'base_100');
  await expect.poll(async () => (await sceneState(page)).surfaces.filter((s) => s.moduleType === 'base').length).toBeGreaterThan(0);

  const state = await sceneState(page);
  const box = await page.locator('#viewport').boundingBox();
  const inView = (s) => s.x > box.x && s.x < box.x + box.width - 320 && s.y > box.y + 120 && s.y < box.y + box.height;
  const counter = state.surfaces.find((s) => s.moduleType === 'counter' && inView(s));
  const other = state.surfaces.find((s) => s.moduleType === 'base' && s.y > box.y + 600 && s.y < box.y + box.height && s.x < box.x + box.width);
  expect(counter).toBeTruthy();
  expect(other).toBeTruthy();

  await page.mouse.click(counter.x, counter.y);
  await expect.poll(async () => (await sceneState(page)).glowing.some((item) => item.startsWith('counter'))).toBe(true);
  await page.mouse.click(other.x, other.y);
  await page.waitForTimeout(300);
  const afterOther = await sceneState(page);
  expect(afterOther.glowing.filter((item) => item.startsWith('counter'))).toEqual([]);
  expect(afterOther.frames.filter((id) => id === counter.moduleId)).toEqual([]);

  // Boş alan: stand dışındaki salon zemini.
  await page.mouse.click(box.x + 20, box.y + box.height - 20);
  await page.waitForTimeout(300);
  const afterEmpty = await sceneState(page);
  expect(afterEmpty.glowing).toEqual([]);
  expect(afterEmpty.frames).toEqual([]);
  expect(errors).toEqual([]);
});

test('çift tıkla seçilen öğe boş alana tıklayınca çerçevesini bırakır', async ({ page }) => {
  await createStand(page);
  await dropCard(page, 'desk_banko_200', 0.45, 0.8);
  await chooseCatalogWidth(page, 'desk_banko_200');
  await expect.poll(async () => (await sceneState(page)).surfaces.filter((s) => s.moduleType === 'counter').length).toBeGreaterThan(0);
  const box = await page.locator('#viewport').boundingBox();
  const counter = (await sceneState(page)).surfaces.find((s) => s.moduleType === 'counter'
    && s.x > box.x && s.x < box.x + box.width - 320 && s.y > box.y + 120 && s.y < box.y + box.height);
  await page.mouse.dblclick(counter.x, counter.y);
  await expect.poll(async () => (await sceneState(page)).frames.length).toBeGreaterThan(0);
  await page.mouse.click(box.x + 20, box.y + box.height - 20);
  await page.waitForTimeout(300);
  const after = await sceneState(page);
  expect(after.frames).toEqual([]);
  expect(after.glowing).toEqual([]);
});

for (const [name, itemKey, moduleType] of [['banko', 'desk_banko_200', 'counter'], ['baza', 'base_100', 'base']]) {
  test(`${name}: yüz seçilince Çoklu panel çıkar; Ctrl+tık ve dokunuş yüzleri tek tek seçer`, async ({ page }) => {
    await createStand(page);
    await dropCard(page, itemKey, 0.45, 0.8);
    await chooseCatalogWidth(page, itemKey);
    await expect.poll(async () => (await sceneState(page)).surfaces.filter((s) => s.moduleType === moduleType).length).toBeGreaterThan(1);
    const box = await page.locator('#viewport').boundingBox();
    const faces = (await sceneState(page)).surfaces.filter((s) => s.moduleType === moduleType
      && s.x > box.x && s.x < box.x + box.width - 320 && s.y > box.y + 120 && s.y < box.y + box.height);
    expect(faces.length).toBeGreaterThan(1);
    const count = async () => (await sceneState(page)).glowing.filter((item) => item.startsWith(moduleType)).length;

    await page.mouse.click(faces[0].x, faces[0].y);
    await expect.poll(count).toBe(1);
    const multi = page.locator('[data-selection-action="multi"]');
    await expect(multi).toHaveText('Çoklu panel');
    // Tek yüz seçimi bütün modülün çerçevesini açmaz.
    expect((await sceneState(page)).frames).toEqual([]);

    await page.keyboard.down('Control');
    await page.mouse.click(faces[1].x, faces[1].y);
    await page.keyboard.up('Control');
    await expect.poll(count).toBe(2);

    // Düğme: dokunulan yüz seçimden çıkar, seçilene dokunmak seçimi bozmaz.
    await multi.click();
    await page.mouse.click(faces[1].x, faces[1].y);
    await expect.poll(count).toBe(1);

    // Çift tık bütün modülü seçer; düğme Çoklu modül olur.
    await page.mouse.dblclick(faces[0].x, faces[0].y);
    await expect(multi).toHaveText('Çoklu modül');
  });
}
