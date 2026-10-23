import { test, expect } from '@playwright/test';

// Duvar ailesinin her ürünü × her duvar yüksekliği: proje kaydına uygulamanın kendi koduyla
// yazılır, proje açılır; kod (_H), panel sayısı ve sahnedeki tepe yüksekliği ölçülür.

const HEIGHTS = [250, 300, 350, 400, 450, 500];

// [katalog kodu, beklenen bant/şerit sayısı (B = H / 50)]
const ITEMS = [
  ['wall_50_350', (b) => b],
  ['wall_100_350', (b) => b],
  ['wall_150_350', (b) => b],
  ['wall_200_350', (b) => b],
  ['wall_door_100_350', (b) => b - 4],
  ['wall_showcase_100_2_350', (b) => b],
  ['wall_showcase_100_3_350', (b) => b],
  ['wall_separator_50_350', null],
  ['wall_separator_100_350', null],
  ['wall_separator_50_350_sarmasik', null],
  ['wall_separator_100_350_sarmasik', null],
  ['wall_50_short_1', () => 1],
  ['wall_100_short_1', () => 1],
  ['wall_150_short_1', () => 1],
  ['wall_200_short_1', () => 1],
  ['wall_50_short_2', () => 2],
  ['wall_100_short_2', () => 2],
  ['wall_150_short_2', () => 2],
  ['wall_200_short_2', () => 2],
];

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

function readLatestProject(page) {
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

for (const wallHeight of HEIGHTS) {
  test(`every wall-family Item at ${wallHeight} cm: itemKey, bands and top height`, async ({ page }) => {
    test.setTimeout(90_000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await exposeScene(page);
    await page.goto('/');
    const standSetup = page.locator('details.stand-setup-card');
    await standSetup.locator('summary').click();
    await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
    await page.locator('#stand-size-x').fill('30');
    await page.locator('#stand-size-y').fill('10');
    await page.locator('#wall-height').selectOption(String(wallHeight));
    await page.locator('#create-stage').click();
    await page.locator('form input[name="projectName"]').fill(`E2E Matris ${wallHeight}`);
    await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
    await expect(page.locator('#viewport-toolbar')).toBeVisible();
    await page.locator('#save-project').click();
    await expect(page.locator('#save-project')).toBeEnabled();

    // Uygulamanın kendi modülleriyle (aynı örnek) her ürünü standın yüksekliğinde oluştur.
    const projectId = await page.evaluate(async ({ keys, height }) => {
      const designState = await import('/src/designState.js');
      const items = await import('/src/items.js');
      const placement = await import('/src/modulePlacement.js');
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
      project.modules = keys.map((catalogKey, index) => {
        const itemKey = items.resolveWallItemKeyForHeight(catalogKey, height);
        const state = designState.createModuleStateFromCatalogKey(itemKey);
        state.placement = placement.createModulePlacement({
          xCm: (index % 10) * 280 + 20,
          yCm: index < 10 ? 200 : 700,
          rotationZDeg: 0,
          wallId: 'free',
          zCm: items.resolveItemDefaultZCm(itemKey),
        });
        return state;
      });
      project.updatedAt = Date.now();
      await new Promise((resolve, reject) => {
        const tx = db.transaction('projects', 'readwrite');
        tx.objectStore('projects').put(project);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      return project.id;
    }, { keys: ITEMS.map(([key]) => key), height: wallHeight });

    await page.reload();
    await expect(page.locator('#viewport-empty')).toBeVisible();
    await page.locator('#project-select').evaluate((select, id) => { select.value = id; }, projectId);
    await page.locator('#open-project').click();
    await expect(page.locator('#project-status')).toContainText('Açıldı:');
    await expect(page.locator('#wall-height')).toHaveValue(String(wallHeight));

    const project = await readLatestProject(page);
    const bands = wallHeight / 50;
    const tops = await page.evaluate(() => {
      const byModule = {};
      for (const mesh of window.__sceneSurfaces()) {
        const moduleId = mesh.userData.moduleId;
        if (!moduleId) continue;
        mesh.updateMatrixWorld(true);
        mesh.geometry.computeBoundingBox();
        const box = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
        byModule[moduleId] = Math.max(byModule[moduleId] ?? -Infinity, box.max.y);
      }
      return byModule;
    });

    expect(project.modules).toHaveLength(ITEMS.length);
    ITEMS.forEach(([catalogKey, expectedStrips], index) => {
      const moduleState = project.modules[index];
      const label = `${catalogKey} @ ${wallHeight}`;
      const isShort = /_short_/.test(catalogKey);
      // Kod: kısa duvar aynı kalır, diğerleri _H olur.
      const expectedKey = isShort ? catalogKey : catalogKey.replace('_350', `_${wallHeight}`);
      expect(moduleState.itemKey, label).toBe(expectedKey);
      if (expectedStrips) expect(moduleState.strips?.length, label).toBe(expectedStrips(bands));
      // Tepe: her ürün (kısa duvar dahil) duvar tepesinde biter. Yüzey payı yükseklikten
      // bağımsızdır: panel ailesi +1,0 cm (üst panel yüzeyi çerçevenin üst kenarından 4 cm
      // içeride biter, PANEL_FRAME_INSET_M), ayırıcı −3,0 cm (lata alanı üst profilin altında biter;
      // kesit reçetedeki profil Item sahne ölçüsü, test kataloğunda 8 cm).
      const top = tops[moduleState.id];
      expect(Number.isFinite(top), `${label} sahnede yüzey yok`).toBe(true);
      const offsetM = /separator/.test(catalogKey) ? -0.030 : 0.010;
      expect(Math.abs(top - (wallHeight / 100 + offsetM)), `${label} tepe ${top}`).toBeLessThan(0.005);
    });
    expect(errors).toEqual([]);
  });
}
