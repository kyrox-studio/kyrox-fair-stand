import { test, expect } from '@playwright/test';
import { disableAutoFurniture, keepWallLock, createStageFromWizard, clickProjectAction, savedProject } from './helpers/standSetup.mjs';

// İki nokta profil (2026-11-12): araç açıkken iki dikme ya da profil ucu seçilir, araya iki nokta
// arasına en yakın boyda tek profil konur. Uçlar: dikme, profil ucu, dikmeli duvar ailesinin ucu.

async function exposeScene(page) {
  await page.route('**/src/scene3d.js*', async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace(
        'const controls = new OrbitControls(camera, renderer.domElement);',
        'const controls = new OrbitControls(camera, renderer.domElement); window.__sceneCamera = camera;',
      )
      .replace('  let surfaceMeshes = [];', '  let surfaceMeshes = []; window.__sceneSurfaces = () => surfaceMeshes;');
    await route.fulfill({ response, body });
  });
}

async function createIslandProject(page, modules, { layout = 'Ada Stand', widthM = '6', depthM = '5', keepWalls = false } = {}) {
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: layout }).click();
  await page.locator('#stand-size-x').fill(widthM);
  await page.locator('#stand-size-y').fill(depthM);
  await disableAutoFurniture(page);
  await createStageFromWizard(page);
  await page.locator('form input[name="projectName"]').fill('İki nokta profil');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await keepWallLock(page);
  await page.locator('#save-project').click();
  await expect(page.locator('#save-project')).toBeEnabled();
  const projectId = await page.evaluate(async ({ specs, keep }) => {
    const designState = await import('/src/designState.js');
    const placement = await import('/src/modulePlacement.js');
    const built = specs.map(({ id, itemKey, place }) => {
      const state = designState.createModuleStateFromCatalogKey(itemKey);
      state.id = id;
      state.placement = placement.createModulePlacement({ wallId: 'free', ...place, itemKey });
      return state;
    });
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('fair-stand-configurator', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const projects = await new Promise((resolve) => {
      const request = db.transaction('projects', 'readonly').objectStore('projects').getAll();
      request.onsuccess = () => resolve(request.result ?? []);
    });
    const project = projects.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0];
    project.modules = keep ? [...project.modules, ...built] : built;
    project.updatedAt = Date.now();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      tx.objectStore('projects').put(project);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return project.id;
  }, { specs: modules, keep: keepWalls });
  await page.reload();
  await page.locator('#project-select').evaluate((select, id) => { select.value = id; }, projectId);
  await clickProjectAction(page, 'open-project');
  await expect(page.locator('#project-status')).toContainText('Açıldı:');
}

// Modül yüzeyinin dünya kutusunda, x ekseni boyunca oran (0 sol uç, 1 sağ uç) noktası ekranda.
function moduleScreenPoint(page, moduleId, ratioX = 0.5) {
  return page.evaluate(({ id, ratio }) => {
    const surfaces = window.__sceneSurfaces().filter((mesh) => mesh.userData.moduleId === id);
    const canvas = document.querySelector('#viewport > canvas').getBoundingClientRect();
    let box = null;
    for (const surface of surfaces) {
      surface.updateMatrixWorld(true);
      surface.geometry.computeBoundingBox();
      const next = surface.geometry.boundingBox.clone().applyMatrix4(surface.matrixWorld);
      box = box ? box.union(next) : next;
    }
    const point = box.getCenter(surfaces[0].position.clone());
    // Oran modülün uzun ekseninde uygulanır (x ya da z).
    if (box.max.z - box.min.z > box.max.x - box.min.x) point.z = box.min.z + (box.max.z - box.min.z) * ratio;
    else point.x = box.min.x + (box.max.x - box.min.x) * ratio;
    point.project(window.__sceneCamera);
    return {
      x: canvas.left + ((point.x + 1) / 2) * canvas.width,
      y: canvas.top + ((1 - point.y) / 2) * canvas.height,
    };
  }, { id: moduleId, ratio: ratioX });
}

async function clickModule(page, moduleId, ratioX = 0.5) {
  const point = await moduleScreenPoint(page, moduleId, ratioX);
  await page.mouse.click(point.x, point.y);
}

function profilesOf(project) {
  return project.modules.filter((module) => module.type === 'profile');
}

test('upright to upright: nearest single profile sits between centers, flush with the post top', async ({ page }) => {
  await exposeScene(page);
  await createIslandProject(page, [
    { id: 'post-a', itemKey: 'upright_99', place: { xCm: 100, yCm: 250, zCm: 0 } },
    { id: 'post-b', itemKey: 'upright_99', place: { xCm: 320, yCm: 250, zCm: 0 } },
  ]);
  const tool = page.locator('#two-point-profile');
  await expect(tool).toBeEnabled();
  await tool.click();
  await expect(tool).toHaveAttribute('aria-pressed', 'true');

  await clickModule(page, 'post-a');
  await expect(page.locator('.toast-stack')).toContainText('İlk nokta seçildi');
  await clickModule(page, 'post-b');
  // Aralık 220 → en yakın tek boy 200 (profile_190).
  await expect(page.locator('.toast-stack')).toContainText('Profil konuldu · 200 cm (aralık 220 cm)');

  const project = await savedProject(page);
  const post = project.modules.find((module) => module.id === 'post-a');
  const [profile] = profilesOf(project);
  expect(profile?.itemKey).toBe('profile_190');
  expect(profile.placement.rotationZDeg).toBe(0);
  // 99 dikme 100 cm duvar hattıdır; profilin üstü o hatta.
  expect(profile.placement.zCm).toBeCloseTo(post.placement.zCm + Math.round(post.heightCm / 0.99) - profile.heightCm, 3);

  // Araç açık kalır; Esc kapatır.
  await expect(tool).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(tool).toHaveAttribute('aria-pressed', 'false');
});

test('profile end to upright: profile continues at the same height', async ({ page }) => {
  await exposeScene(page);
  await createIslandProject(page, [
    { id: 'rail', itemKey: 'profile_190', place: { xCm: 100, yCm: 250, zCm: 60 } },
    { id: 'post', itemKey: 'upright_99', place: { xCm: 392, yCm: 250, zCm: 0 } },
  ]);
  await page.locator('#two-point-profile').click();
  await clickModule(page, 'rail', 0.97);
  await clickModule(page, 'post');
  const project = await savedProject(page);
  const rail = project.modules.find((module) => module.id === 'rail');
  const post = project.modules.find((module) => module.id === 'post');
  const added = profilesOf(project).find((module) => module.id !== 'rail');
  expect(added, 'profile was added').toBeTruthy();
  const postCenterX = post.placement.xCm + post.widthCm / 2;
  const span = postCenterX - (rail.placement.xCm + rail.widthCm);
  expect(Math.abs(added.widthCm - span)).toBeLessThanOrEqual(25);
  expect(added.placement.zCm).toBeCloseTo(rail.placement.zCm, 3);
});

test('wall end post to upright: profile sits on the wall top line', async ({ page }) => {
  await exposeScene(page);
  await createIslandProject(page, [
    { id: 'wall', itemKey: 'wall_200_350', place: { xCm: 50, yCm: 250, zCm: 0 } },
    { id: 'post', itemKey: 'upright_346_5', place: { xCm: 342, yCm: 250, zCm: 0 } },
  ]);
  await page.locator('#two-point-profile').click();
  await clickModule(page, 'wall', 0.97);
  await clickModule(page, 'post');
  const project = await savedProject(page);
  const wall = project.modules.find((module) => module.id === 'wall');
  const [added] = profilesOf(project);
  expect(added, 'profile was added').toBeTruthy();
  expect(added.itemKey).toBe('profile_91');
  expect(added.placement.zCm).toBeCloseTo(wall.placement.zCm + wall.heightCm - added.heightCm, 3);
});

test('L stand: corner upright slightly inside the corner to the side wall front end', async ({ page }) => {
  await exposeScene(page);
  await createIslandProject(page, [
    { id: 'post', itemKey: 'upright_346_5', place: { xCm: 484, yCm: 388, zCm: 0 } },
  ], { layout: 'L Stand Sol', widthM: '5', depthM: '4', keepWalls: true });
  const before = await savedProject(page);
  const sideWall = before.modules.find((module) => module.placement?.wallId === 'left'
    && module.placement.yCm + module.widthCm >= 399);
  expect(sideWall, 'left wall front segment').toBeTruthy();
  await page.locator('#two-point-profile').click();
  await clickModule(page, 'post');
  await clickModule(page, sideWall.id, 0.98);
  let toasts = await page.locator('.toast-stack').innerText().catch(() => '');
  let project = await savedProject(page);
  expect(profilesOf(project), toasts).toHaveLength(1);
  const [front] = profilesOf(project);
  expect(front.placement.rotationZDeg).toBe(0);
  expect(front.placement.zCm).toBeCloseTo(sideWall.placement.zCm + sideWall.heightCm - front.heightCm, 3);

  // İkinci kol: aynı dikme → arka duvarın sağ ucu. Kullanıcı kararı (2026-11-13): boy en yakın katalog
  // boyudur (488 cm aralığa 500); ilk kol iki uçtan taşıp dikmeye girer, bu yüzden aynı dikmeden çıkan
  // ikinci kol ona çarpar ve konmaz. Ret açık mesajla gelir, ilk profil bozulmaz.
  const backWall = before.modules
    .filter((module) => module.placement?.wallId === 'back')
    .sort((a, b) => (b.placement.xCm + b.widthCm) - (a.placement.xCm + a.widthCm))[0];
  await clickModule(page, 'post');
  await clickModule(page, backWall.id, 0.98);
  await expect(page.locator('.toast-stack')).toContainText('Başka bir modülle çakışıyor');
  project = await savedProject(page);
  const profiles = profilesOf(project);
  expect(profiles).toHaveLength(1);
  expect(profiles[0].placement).toEqual(front.placement);
});
