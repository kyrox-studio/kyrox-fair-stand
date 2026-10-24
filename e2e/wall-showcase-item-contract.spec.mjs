import { test, expect } from '@playwright/test';
import { installModuleUnlockFixture, unlockModuleForFixture } from './helpers/module-lock-fixture.mjs';
import { dropCatalogCard } from './helpers/catalogDrop.mjs';
import { chooseCatalogWidth } from './helpers/catalogWidth.mjs';

test.beforeEach(async ({ page }) => installModuleUnlockFixture(page));

async function createStand(page) {
  await page.goto('/');
  const setup = page.locator('details.stand-setup-card');
  await setup.locator('summary').click();
  await setup.getByRole('button', { name: 'Sırt Duvar' }).click();
  await page.locator('#stand-size-x').fill('5');
  await page.locator('#stand-size-y').fill('5');
  await page.locator('#create-stage').click();
  const input = page.locator('form input[name="projectName"]');
  await expect(input).toBeVisible();
  await input.fill('Wall Showcase Contract');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
}

async function saveAndReadProject(page) {
  const save = page.locator('#save-project');
  await save.click();
  await expect(save).toBeEnabled();
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
    return projects.sort((a,b) => Number(b.updatedAt||0)-Number(a.updatedAt||0))[0] ?? null;
  });
}

async function removeModules(page, modules) {
  for (const moduleState of modules) {
    await unlockModuleForFixture(page, moduleState);
    page.once('dialog', async (dialog) => dialog.accept());
    await page.evaluate((moduleId) => {
      window.dispatchEvent(new CustomEvent('fair-stand:delete-selected-module', {
        detail: { moduleId },
      }));
    }, moduleState.id);
  }
}

test('wall showcase catalog Items persist canonical identity and grouped body color state', async ({ page }) => {
  const errors=[]; page.on('pageerror', (error)=>errors.push(error.message));
  await createStand(page);

  // Otomatik 500 cm sırt duvarı baştan dolu. Katalog eklemeden önce gerçek silme
  // yoluyla tam iki 100 cm slot boşalt; yoksa picker kapasite hatasında açık kalır.
  const initialProject = await saveAndReadProject(page);
  expect(initialProject).not.toBeNull();
  expect(initialProject.modules.length).toBeGreaterThanOrEqual(2);
  // Ekleme planı kalan duvarı da kaydırabilir; düzenlenecek zincirin kilidini aç.
  for (const moduleState of initialProject.modules) await unlockModuleForFixture(page, moduleState);
  await removeModules(page, initialProject.modules.slice(0, 2));

  // Vitrin tek kart (0086, Panel & Duvar): kart 3 gözlü bırakılır, 2 göz Özellikler panelinde seçilir.
  await dropCatalogCard(page, 'wall_showcase_100_3_350');
  await chooseCatalogWidth(page, 'wall_showcase_100_2_350');
  await page.keyboard.press('Escape');
  await dropCatalogCard(page, 'wall_showcase_100_3_350');
  const project=await saveAndReadProject(page);
  const two=project.modules.find((m)=>m.itemKey==='wall_showcase_100_2_350');
  const three=project.modules.find((m)=>m.itemKey==='wall_showcase_100_3_350');
  expect(two).toBeTruthy(); expect(three).toBeTruthy();
  expect(two.itemKey).toBe('wall_showcase_100_2_350');
  expect(three.itemKey).toBe('wall_showcase_100_3_350');
  expect(two.bodySurface.color).toBe('#ffffff');
  expect(three.bodySurface.color).toBe('#ffffff');
  expect(two.eyeCount).toBe(2); expect(three.eyeCount).toBe(3);
  expect(errors).toEqual([]);
});

for (const itemKey of ['wall_showcase_100_2_350', 'wall_showcase_100_3_350']) {
  test(`${itemKey}: gövdeye normal tık renk paletini açar; dört sunta boyanır ve kayıt korunur`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.route('**/src/scene3d.js*', async route => {
      const response = await route.fetch();
      const body = (await response.text())
        .replace('const controls = new OrbitControls(camera, renderer.domElement);',
          'const controls = new OrbitControls(camera, renderer.domElement); window.__showcaseControls = controls;')
        .replace('  let surfaceMeshes = [];',
          '  let surfaceMeshes = []; window.__showcaseSurfaces = () => surfaceMeshes;');
      await route.fulfill({ response, body });
    });
    await createStand(page);
    const initial = await saveAndReadProject(page);
    await page.evaluate(async ({ id, itemKey }) => {
      const { createModuleStateFromCatalogKey } = await import('/src/designState.js');
      const module = createModuleStateFromCatalogKey(itemKey);
      module.placement = { xCm: 200, yCm: 200, zCm: 0, wallId: 'free', rotationZDeg: 0 };
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('fair-stand-configurator', 2);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const project = await new Promise(resolve => {
        const request = db.transaction('projects').objectStore('projects').get(id);
        request.onsuccess = () => resolve(request.result);
      });
      project.modules = [module];
      project.enableAutosave = false;
      await new Promise((resolve, reject) => {
        const tx = db.transaction('projects', 'readwrite');
        tx.objectStore('projects').put(project);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    }, { id: initial.id, itemKey });

    const reopen = async () => {
      await page.reload();
      await expect(page.locator(`#project-select option[value="${initial.id}"]`)).toHaveCount(1);
      await page.locator('#project-select').evaluate((select, id) => { select.value = id; }, initial.id);
      await page.locator('#open-project').click();
      await expect(page.locator('#project-status')).toContainText('Açıldı:');
      await expect(page.locator('#project-loading-overlay')).toBeHidden({ timeout: 30_000 });
    };
    await reopen();
    const point = await page.evaluate(() => {
      const mesh = window.__showcaseSurfaces().find(mesh => mesh.userData.surfaceRole === 'showcase-body');
      mesh.updateWorldMatrix(true, false);
      const center = mesh.getWorldPosition(mesh.position.clone());
      const controls = window.__showcaseControls;
      controls.target.copy(center);
      controls.object.position.copy(center).addScaledVector(mesh.getWorldDirection(mesh.position.clone()), 6);
      controls.update();
      controls.object.updateMatrixWorld(true);
      const screen = center.project(controls.object);
      const box = document.querySelector('#viewport > canvas').getBoundingClientRect();
      return { x: box.left + (screen.x + 1) * box.width / 2, y: box.top + (1 - screen.y) * box.height / 2 };
    });
    await page.mouse.click(point.x, point.y);
    const panel = page.getByRole('complementary', { name: 'Özellikler' });
    await expect(panel.locator('#selection-info')).toContainText('vitrin gövdesi · 4 sunta birlikte renklendirilir');
    await expect(panel.locator('#color-hex')).toBeVisible();
    await expect(panel.locator('#surface-image-controls')).toBeHidden();
    // Kısa pencerede uzun açıklama ne kırpılır ne de işlem satırına biner.
    const layout = await panel.evaluate(element => {
      const info = element.querySelector('#selection-info');
      const action = element.querySelector('[data-module-action="toggle-lock"]');
      return { contentHeight: info.scrollHeight, height: info.clientHeight,
        bottom: info.getBoundingClientRect().bottom, nextTop: action.getBoundingClientRect().top };
    });
    expect(layout.contentHeight).toBeLessThanOrEqual(layout.height + 1);
    expect(layout.bottom).toBeLessThanOrEqual(layout.nextTop);
    await panel.locator('#color-hex').fill('#336699');
    await panel.locator('#apply-color').click();
    const renderedColors = () => page.evaluate(() => window.__showcaseSurfaces()
      .find(mesh => mesh.userData.surfaceRole === 'showcase-body').userData.colorTargets
      .map(mesh => mesh.material.color.getHexString()));
    await expect.poll(renderedColors).toEqual(Array(4).fill('336699'));
    const saved = await saveAndReadProject(page);
    expect(saved.modules[0].bodySurface.color).toBe('#336699');
    await reopen();
    expect((await saveAndReadProject(page)).modules[0].bodySurface.color).toBe('#336699');
    await expect.poll(renderedColors).toEqual(Array(4).fill('336699'));
  });
}
