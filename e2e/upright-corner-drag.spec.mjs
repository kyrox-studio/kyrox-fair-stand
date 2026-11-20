import { test, expect } from '@playwright/test';
import { createStageFromWizard, clickProjectAction } from './helpers/standSetup.mjs';
import { openEditorSettings } from './helpers/editorSettings.mjs';

// Dikme duvar dikmesiyle aynı parça (kullanıcı kararı 2026-11-19/20): stand kenarındaki köşede (Winset kopyası,
// L Stand Sağ) sahnede fareyle sürüklenip bırakılan dikme, açılıştaki köşe karesine birebir oturur.
const MODULES = [["wall_200_350", "f6c254", 0, 0, 0, 0, "back"], ["wall_200_350", "1115ce", 200, 0, 0, 0, "back"], ["wall_100_350", "eb5611", 400, 0, 0, 0, "back"], ["wall_100_350", "ea3a17", 500, 0, 0, 270, "right"], ["wall_100_350", "993271", 500, 300, 0, 270, "right"], ["wall_200_short_2", "98445a", 50, 400, 300, 0, "free"], ["wall_200_short_2", "75b96a", 250, 400, 300, 0, "free"], ["upright_396", "62fb21", 0, 390, 0, 90, "free"], ["wall_50_short_2", "723eaa", 450, 400, 300, 0, "free"], ["profile_388", "e9e29b", 0, 0, 340, 90, "free"], ["wall_50_short_2", "bc93b2", 0, 400, 300, 0, "free"], ["wall_200_short_2", "f9040d", 0, 200, 0, 270, "free"], ["wall_200_short_1", "4a9e67", 0, 200, 100, 270, "free"], ["wall_door_100_350", "ed289c", 400, 0, 0, 270, "free"], ["wall_200_short_2", "d5155b", 0, 0, 0, 270, "free"], ["wall_200_short_1", "3cb5df", 0, 0, 100, 270, "free"], ["wall_100_350", "1206df", 400, 100, 0, 0, "free"], ["wall_200_350", "13da4d", 500, 100, 0, 270, "right"], ["upright_396", "1351eb", 490, 400, 0, 0, "free"]];

async function readUpright(page, projectId, id) {
  return page.evaluate(async ({ projectId, id }) => {
    const db = await new Promise((res, rej) => { const q = indexedDB.open('fair-stand-configurator', 2); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    const project = await new Promise((res, rej) => { const tx = db.transaction('projects', 'readonly'); const q = tx.objectStore('projects').get(projectId); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    db.close();
    return project.modules.find((m) => m.id === id).placement;
  }, { projectId, id });
}

test.setTimeout(120000);
test('serbest dikme sahnede köşeye sürüklenince köşe karesine oturur', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.route('**/src/scene3d.js*', async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace('const wallRoot = new THREE.Group();', 'const wallRoot = new THREE.Group(); window.__wallRoot = wallRoot; window.__cam = () => camera; window.__THREE = THREE;');
    await route.fulfill({ response, body });
  });
  await page.goto('/');
  const setup = page.locator('details.stand-setup-card');
  await setup.locator(':scope > summary').click();
  await setup.getByRole('button', { name: 'L Stand Sağ', exact: true }).click();
  await page.locator('#stand-size-x').fill('5'); await page.locator('#stand-size-y').fill('4');
  await createStageFromWizard(page);
  await page.locator('form input[name="projectName"]').fill('Winset kopya');
  await page.getByRole('button', { name: 'Projeyi Oluştur', exact: true }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  await openEditorSettings(page);
  await page.locator('#autosave-interval').selectOption('0');
  const projectId = await page.locator('#project-select').inputValue();
  await page.evaluate(async ({ id, rows }) => {
    const { createModuleStateFromCatalogKey } = await import('/src/designState.js');
    const modules = rows.map(([key, mid, x, y, z, r, w]) => { const s = createModuleStateFromCatalogKey(key); s.id = mid; s.placement = { xCm: x, yCm: y, zCm: z, rotationZDeg: r, wallId: w }; return s; });
    const db = await new Promise((res, rej) => { const q = indexedDB.open('fair-stand-configurator', 2); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    await new Promise((res, rej) => { const tx = db.transaction('projects', 'readwrite'); const st = tx.objectStore('projects'); const q = st.get(id); q.onsuccess = () => st.put({ ...q.result, modules }); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    db.close();
  }, { id: projectId, rows: MODULES });
  await page.reload();
  await page.locator('#project-select').evaluate((s, id) => { s.value = id; }, projectId);
  await clickProjectAction(page, 'open-project');
  await expect(page.locator('#project-loading-overlay')).toBeHidden({ timeout: 30000 });
  await page.waitForTimeout(1000);

  const project = async (id, heightM) => page.evaluate(({ id, heightM }) => {
    const THREE = window.__THREE; const root = window.__wallRoot; const camera = window.__cam();
    root.updateMatrixWorld(true);
    let group = null; root.traverse((o) => { if (!group && o.userData?.moduleId === id) group = o; });
    const box = new THREE.Box3().setFromObject(group);
    const p = new THREE.Vector3((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, (box.min.z + box.max.z) / 2);
    // Dikey eksen: yüksekliği en büyük olan; o eksende verilen yükseklik.
    const size = new THREE.Vector3(); box.getSize(size);
    const up = size.y >= size.z ? 'y' : 'z'; p[up] = box.min[up] + heightM;
    const v = p.clone().project(camera);
    const rect = document.querySelector('#viewport > canvas').getBoundingClientRect();
    return { x: rect.left + (v.x + 1) / 2 * rect.width, y: rect.top + (1 - v.y) / 2 * rect.height };
  }, { id, heightM });

  const id = '62fb21';
  const corner = await project(id, 1.0);
  const drag = async (from, to) => {
    await page.mouse.move(from.x, from.y); await page.mouse.down();
    for (let i = 1; i <= 12; i += 1) await page.mouse.move(from.x + (to.x - from.x) * i / 12, from.y + (to.y - from.y) * i / 12);
    await page.mouse.up(); await page.waitForTimeout(500);
  };
  await page.locator('#save-project').click();
  await expect(page.locator('#project-status')).toContainText('Kaydedildi');
  const atOpen = await readUpright(page, projectId, id);
  // Uzağa taşı, sonra köşeye geri sürükle (imleç köşeden birkaç piksel kayık).
  await drag(corner, { x: corner.x + 160, y: corner.y + 40 });
  await page.locator('#save-project').click();
  const away = await readUpright(page, projectId, id);
  const now = await project(id, 1.0);
  await drag(now, { x: corner.x + 4, y: corner.y + 3 });
  await page.locator('#save-project').click();
  await page.waitForTimeout(800);
  const back = await readUpright(page, projectId, id);
  expect(away.yCm).not.toBe(atOpen.yCm);
  expect([back.xCm, back.yCm]).toEqual([atOpen.xCm, atOpen.yCm]);
});
