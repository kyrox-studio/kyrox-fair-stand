import { openEditorSettings } from './helpers/editorSettings.mjs';
import { test, expect } from '@playwright/test';
import { disableAutoFurniture, keepWallLock } from './helpers/standSetup.mjs';

// Seçime göre Özellikler paneli: öğeye / yüzeye tek tık paneli açar (⋯ düğmesi yok); açık
// panel yeni seçime göre güncellenir, boş alana tık paneli kapatır. Renk / görsel kontrolleri tek kaynaktır: panel açıkken
// panelde, kapanınca soldaki Seçili yüzey kartında.
test.use({ viewport: { width: 1280, height: 820 } });

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
      )
      .replace(
        '  const groupSelectionFrame = createSelectionBoundsFrame(GROUP_SELECTION_COLOR);',
        '  const groupSelectionFrame = createSelectionBoundsFrame(GROUP_SELECTION_COLOR); window.__groupFrame = groupSelectionFrame;',
      );
    await route.fulfill({ response, body });
  });
}

async function createBackWallStand(page) {
  await exposeScene(page);
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Sırt Duvar' }).click();
  await page.locator('#stand-size-x').fill('5');
  await page.locator('#stand-size-y').fill('4');
  await disableAutoFurniture(page);
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill('E2E Ozellik Paneli');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await keepWallLock(page);
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  await openEditorSettings(page);
  await page.locator('#autosave-interval').selectOption('0');
  await page.waitForTimeout(400);
}

// Görünür panel yüzeylerinin ekran noktaları (modül ve sıra bilgisiyle).
async function panelPoints(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('#viewport > canvas').getBoundingClientRect();
    return window.__sceneSurfaces()
      .filter((mesh) => mesh.userData.selectionMode === 'panel')
      .map((mesh) => {
        mesh.updateMatrixWorld(true);
        const screen = mesh.getWorldPosition(mesh.position.clone()).project(window.__sceneCamera);
        return {
          moduleId: mesh.userData.moduleId,
          stripIndex: Number(mesh.userData.stripIndex),
          x: canvas.left + ((screen.x + 1) / 2) * canvas.width,
          y: canvas.top + ((1 - screen.y) / 2) * canvas.height,
        };
      })
      .filter((point) => point.x > canvas.left + 20 && point.x < canvas.left + canvas.width - 320
        && point.y > canvas.top + 140 && point.y < canvas.bottom - 40);
  });
}

test('tek tık paneli açar, sağ tık aynı paneli gösterir; seçim değişince güncellenir, boş alana tık kapatır', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await createBackWallStand(page);
  const points = await panelPoints(page);
  const modules = [...new Set(points.map((point) => point.moduleId))];
  expect(modules.length).toBeGreaterThan(1);
  const first = points.find((point) => point.moduleId === modules[0]);
  const second = points.find((point) => point.moduleId === modules[1] && point.stripIndex === first.stripIndex)
    ?? points.find((point) => point.moduleId === modules[1]);
  const panel = page.getByRole('complementary', { name: 'Özellikler' });
  const menu = panel.getByRole('menu', { name: 'Modül işlemleri' });
  const title = menu.locator('.module-context-title');
  const undo = page.locator('#design-undo');
  const undoBefore = await undo.isDisabled();

  // Tek tık: seçim çubuğu kalır ve panel açılır.
  await page.mouse.click(first.x, first.y);
  await expect(page.locator('.selection-toolbar')).toBeVisible();
  await expect(panel).toBeVisible();
  await expect(title).toContainText('Modül 1');
  const clickActions = await menu.locator('[data-module-action]:not([hidden])').evaluateAll(
    (buttons) => buttons.map((button) => button.dataset.moduleAction),
  );

  await page.getByRole('button', { name: 'Özellikler panelini kapat' }).click();
  await expect(panel).toBeHidden();

  // Sağ tık: panel, gerçek öğe ve yüzey başlığı; renk kontrolleri panele taşınır.
  await page.mouse.click(first.x, first.y, { button: 'right' });
  await expect(panel).toBeVisible();
  await expect(title).toContainText('Modül 1');
  await expect(panel.locator('#apply-color')).toBeVisible();
  await expect(page.locator('#surface-controls-moved')).toBeAttached();
  await expect(panel.locator('#fit-image-cover')).toBeVisible();
  const rightClickActions = await menu.locator('[data-module-action]:not([hidden])').evaluateAll(
    (buttons) => buttons.map((button) => button.dataset.moduleAction),
  );
  expect(rightClickActions).toEqual(clickActions);

  // Panel kapatılıp aynı öğeye yeniden tıklanınca aynı işlem listesi gelir; ⋯ düğmesi yoktur.
  await page.getByRole('button', { name: 'Özellikler panelini kapat' }).click();
  await expect(panel).toBeHidden();
  await expect(page.locator('#sidebar #apply-color')).toBeAttached();
  await expect(page.locator('.selection-toolbar [data-selection-action="more"]')).toHaveCount(0);
  await page.mouse.click(first.x, first.y);
  await expect(panel).toBeVisible();
  expect(await menu.locator('[data-module-action]:not([hidden])').evaluateAll(
    (buttons) => buttons.map((button) => button.dataset.moduleAction),
  )).toEqual(rightClickActions);

  // Açık panel normal tıkla yeni seçime geçer; Ctrl+tık çoklu panel sayısını gösterir.
  await page.mouse.click(second.x, second.y);
  await expect(title).toContainText('Modül 2');
  await page.mouse.click(first.x, first.y);
  await page.keyboard.down('Control');
  await page.mouse.click(second.x, second.y);
  await page.keyboard.up('Control');
  await expect(title).toContainText(/\d+ panel seçili · 2 öğe/);
  await expect(menu.locator('.module-context-scope')).toContainText('Öğe işlemleri: Modül 1');

  // Boş alana tık: panel kapanır, eski hedefin işlemleri kalmaz, kontroller sol karta döner.
  const canvas = await page.locator('#viewport > canvas').boundingBox();
  await page.mouse.click(canvas.x + 30, canvas.y + 60);
  await expect(panel).toBeHidden();
  await expect(page.locator('#sidebar #apply-color')).toBeAttached();

  // Kamera sürüklemesi kapalı paneli açmaz.
  await page.mouse.move(canvas.x + 60, canvas.y + canvas.height - 60);
  await page.mouse.down();
  await page.mouse.move(canvas.x + 160, canvas.y + canvas.height - 40, { steps: 8 });
  await page.mouse.up();
  await expect(panel).toBeHidden();

  // Panelin açılıp kapanması tasarım geçmişine yazmaz.
  expect(await undo.isDisabled()).toBe(undoBefore);
  expect(errors).toEqual([]);
});

test('işlem sonrası panel açık kalır ve kilit durumunu güncel gösterir', async ({ page }) => {
  await createBackWallStand(page);
  const [point] = await panelPoints(page);
  await page.mouse.click(point.x, point.y, { button: 'right' });
  const panel = page.getByRole('complementary', { name: 'Özellikler' });
  const lock = panel.locator('[data-module-action="toggle-lock"]');
  const before = (await lock.textContent()).trim();
  await lock.click();
  await expect(panel).toBeVisible();
  await expect(lock).toHaveText(before === 'Kilitle' ? 'Kilidi aç' : 'Kilitle');
  const remove = panel.locator('[data-module-action="delete"]');
  if (before === 'Kilitle') await expect(remove).toBeDisabled();
  else await expect(remove).toBeEnabled();
  await lock.click();
  await expect(lock).toHaveText(before);
});

// Görünür seçim çerçeveleri: modül kutuları + grup / çoklu seçim kutusu.
function visibleSelectionFrames(page) {
  return page.evaluate(() => {
    const groups = new Set();
    window.__sceneSurfaces().forEach((mesh) => {
      let parent = mesh;
      while (parent && parent.userData?.kind !== 'module') parent = parent.parent;
      if (parent) groups.add(parent);
    });
    const modules = [...groups].filter((group) => group.userData.moduleSelectionFrame?.visible).length;
    return { modules, group: window.__groupFrame?.visible === true };
  });
}

test('çoklu modül seçiliyken zemine tıklamak bütün seçim çerçevelerini kaldırır', async ({ page }) => {
  await createBackWallStand(page);
  const points = await panelPoints(page);
  const modules = [...new Set(points.map((point) => point.moduleId))];
  const first = points.find((point) => point.moduleId === modules[0]);
  const second = points.find((point) => point.moduleId === modules[1]);
  await page.mouse.dblclick(first.x, first.y);
  await page.keyboard.down('Control');
  await page.mouse.click(second.x, second.y);
  await page.keyboard.up('Control');
  await expect.poll(async () => {
    const frames = await visibleSelectionFrames(page);
    return frames.modules + (frames.group ? 1 : 0);
  }).toBeGreaterThan(0);

  const floor = await page.evaluate(() => {
    const canvas = document.querySelector('#viewport > canvas').getBoundingClientRect();
    const point = window.__sceneCamera.position.clone().set(0, 0.01, 0.5).project(window.__sceneCamera);
    return { x: canvas.left + ((point.x + 1) / 2) * canvas.width, y: canvas.top + ((1 - point.y) / 2) * canvas.height };
  });
  await page.mouse.click(floor.x, floor.y);
  await expect(page.locator('.selection-property-heading')).toHaveText('Zemin');
  await expect(page.locator('.selection-toolbar')).toBeHidden();
  await expect.poll(() => visibleSelectionFrames(page)).toEqual({ modules: 0, group: false });

  // Zemin panelinde Stand Tipi'ndeki kaplama listesi; seçim zemine uygulanır.
  const coverage = page.locator('.selection-property-panel .selection-property-fields select');
  await expect(page.locator('.selection-property-panel .selection-property-fields')).toContainText('Zemin kaplaması');
  await expect(coverage).toHaveValue(await page.locator('#floor-type').inputValue());
  await coverage.selectOption('hali');
  await expect(page.locator('#floor-type')).toHaveValue('hali');
});
