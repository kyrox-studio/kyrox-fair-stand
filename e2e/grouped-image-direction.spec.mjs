import { showSurfaceControls } from './helpers/surfaceControls.mjs';
import { test, expect } from '@playwright/test';

async function openSavedProject(page, id) {
  await expect(page.locator(`#project-select option[value="${id}"]`)).toHaveCount(1);
  await page.locator('#project-select').evaluate((select, projectId) => { select.value = projectId; }, id);
  await page.locator('#open-project').click();
  await expect(page.locator('#project-status')).toContainText('Açıldı:');
  // Durum yazısı sahne hazır olmadan gelir; ham fare tıklaması perdeyi beklemez.
  await expect(page.locator('#project-loading-overlay')).toBeHidden({ timeout: 30_000 });
}

async function preparePanels(page, rotation, side) {
  await page.route('**/src/scene3d.js*', async route => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace('const controls = new OrbitControls(camera, renderer.domElement);',
        'const controls = new OrbitControls(camera, renderer.domElement); window.__imageControls = controls;')
      .replace('  let fabricOverlayMeshes = [];', '  let fabricOverlayMeshes = []; window.__imageOverlays = () => fabricOverlayMeshes;')
      .replace('  let surfaceMeshes = [];',
        '  let surfaceMeshes = []; window.__imageSurfaces = () => surfaceMeshes;');
    await route.fulfill({ response, body });
  });
  await page.goto('/');
  const setup = page.locator('details.stand-setup-card');
  await setup.locator('summary').click();
  await setup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('9');
  await page.locator('#stand-size-y').fill('9');
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill('Görsel yönü');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await page.locator('#save-project').click();
  await expect(page.locator('#project-status')).toContainText('Kaydedildi:');
  const id = await page.evaluate(async ({ rotation, side }) => {
    const { createModuleStateFromCatalogKey } = await import('/src/designState.js');
    const { createModulePlacement } = await import('/src/modulePlacement.js');
    const modules = [200, 100].map((width, index) => {
      const module = createModuleStateFromCatalogKey(`wall_${width}_350`);
      const vertical = rotation % 180 !== 0;
      module.placement = createModulePlacement({
        xCm: vertical ? 450 : 250 + index * 200,
        yCm: vertical ? 250 + index * 200 : 450,
        zCm: 0, rotationZDeg: rotation, wallId: 'free',
      });
      if (side === 'back') module.backStrips = module.strips.map(strip => ({ ...strip, id: `${strip.id}-back` }));
      return module;
    }).reverse(); // Eklenme sırası fiziksel sıranın tersidir.
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('fair-stand-configurator', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const projects = await new Promise(resolve => {
      const request = db.transaction('projects').objectStore('projects').getAll();
      request.onsuccess = () => resolve(request.result);
    });
    const project = projects.sort((a, b) => b.updatedAt - a.updatedAt)[0];
    project.modules = modules;
    project.enableAutosave = false;
    await new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      tx.objectStore('projects').put(project);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return project.id;
  }, { rotation, side });
  await page.reload();
  await openSavedProject(page, id);
  return id;
}

function imageState(page, side) {
  return page.evaluate(side => window.__imageSurfaces()
    .filter(mesh => mesh.userData.moduleType === 'flat-panel' && mesh.userData.stripIndex === 3
      && (mesh.userData.panelSide ?? 'front') === side)
    .map(mesh => ({
      width: mesh.userData.widthCm,
      start: mesh.userData.surfaceState.imageTransform?.regionStartX,
      span: mesh.userData.surfaceState.imageTransform?.regionWidth,
      asset: mesh.userData.surfaceState.imageAssetId,
      drawn: Boolean(mesh.material.map),
    })).sort((a, b) => b.width - a.width), side);
}

async function selectImagePanels(page, side, single = false, moduleIds = null) {
  const points = await page.evaluate(({ side, moduleIds }) => {
        const controls = window.__imageControls;
        const panels = window.__imageSurfaces().filter(mesh => mesh.userData.moduleType === 'flat-panel'
          && mesh.userData.stripIndex === 3 && (mesh.userData.panelSide ?? 'front') === side
          && (!moduleIds || moduleIds.includes(mesh.userData.moduleId)));
        panels.forEach(mesh => mesh.updateWorldMatrix(true, false));
        const center = panels[0].getWorldPosition(panels[0].position.clone())
          .add(panels[1].getWorldPosition(panels[1].position.clone())).multiplyScalar(0.5);
        const normal = panels[0].getWorldDirection(panels[0].position.clone());
        controls.target.copy(center);
        controls.object.position.copy(center).addScaledVector(normal, 8);
        controls.update();
        controls.object.updateMatrixWorld(true);
        const box = document.querySelector('#viewport > canvas').getBoundingClientRect();
        return panels.map(mesh => {
          const point = mesh.getWorldPosition(mesh.position.clone()).project(controls.object);
          return { x: box.left + (point.x + 1) * box.width / 2, y: box.top + (1 - point.y) * box.height / 2 };
        });
      }, { side, moduleIds });
      await page.mouse.click(points[0].x, points[0].y);
      await expect(page.locator('.selection-property-panel')).toBeVisible();
      if (!single) await page.keyboard.down('Control');
      if (!single) await page.mouse.click(points[1].x, points[1].y);
      if (!single) await page.keyboard.up('Control');
  return points;
}

for (const rotation of [0, 90, 180, 270]) {
  for (const side of ['front', 'back']) {
    test(`${rotation} derece ${side}: birleşik görsel doğru sırada kaydolur ve yeniden açılır`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const id = await preparePanels(page, rotation, side);
      await selectImagePanels(page, side);
      await showSurfaceControls(page);
      const png = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 600; canvas.height = 100;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 600, 100);
        ctx.fillStyle = '#000000'; ctx.font = '70px sans-serif'; ctx.fillText('SİMES →', 15, 75);
        return canvas.toDataURL('image/png').split(',')[1];
      });
      await page.locator('#surface-image').setInputFiles({ name: 'simes.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
      await expect(page.locator('#selection-info')).toContainText('2 × 1');
      await expect.poll(async () => (await imageState(page, side)).every(item => item.drawn)).toBe(true);
      const state = await imageState(page, side);
      const reversed = (rotation === 90 || rotation === 180) !== (side === 'back');
      expect(state).toHaveLength(2);
      expect(state[0].start).toBeCloseTo(reversed ? state[1].span : 0, 8);
      expect(state[1].start).toBeCloseTo(reversed ? 0 : state[0].span, 8);
      expect(state[0].span + state[1].span).toBeCloseTo(1, 8);
      expect(state[0].asset).toBe(state[1].asset);
      await page.locator('#save-project').click();
      await expect(page.locator('#project-status')).toContainText('Kaydedildi:');
      await page.reload();
      await openSavedProject(page, id);
      await expect.poll(() => imageState(page, side)).toEqual(state);
      expect(errors).toEqual([]);
    });
  }
}

async function previewState(page) {
  return page.evaluate(() => {
    const surfaces = window.__imageSurfaces().filter(mesh => mesh.userData.moduleType === 'flat-panel'
      && mesh.userData.stripIndex === 3 && (mesh.userData.panelSide ?? 'front') === 'front');
    const states = surfaces.sort((a, b) => a.userData.surfaceId.localeCompare(b.userData.surfaceId)).map(mesh => ({ renderer: mesh.userData.surfaceState,
      persistent: mesh.userData.persistentSurfaceState, repeat: mesh.material.map?.repeat.toArray() ?? null }));
    const overlays = window.__imageOverlays().map(mesh => mesh.material.map?.repeat.toArray() ?? null);
    return { states, overlays };
  });
}

for (const mode of ['single', 'group', 'lightbox', 'mesh']) {
  test(`${mode}: canlı ölçü kayıt ağacına yazılmaz; iptal geri döner, onay tek adımda geri alınır`, async ({ page }, testInfo) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const projectId = await preparePanels(page, 180, 'front');
    const points = await selectImagePanels(page, 'front', mode === 'single');
    if (mode === 'lightbox' || mode === 'mesh') {
      await page.mouse.click(points[0].x, points[0].y, { button: 'right' });
      await page.locator(`[data-module-action="toggle-${mode === 'mesh' ? 'mesh' : 'fabric'}"]`).click();
    }
    await showSurfaceControls(page, 'image');
    await page.locator('#surface-image').setInputFiles({ name: 'preview.png', mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
    await expect.poll(async () => {
      const state = await previewState(page);
      return mode === 'lightbox' || mode === 'mesh' ? state.overlays.some(Boolean)
        : state.states.some(item => Boolean(item.renderer.imageAssetId) && Boolean(item.repeat));
    }).toBe(true);
    const original = await previewState(page);
    // Görsel ölçüsü pencere açmaz: Özellikler panelinde alan olarak durur.
    const open = async () => {
      await page.mouse.click(points[0].x, points[0].y, { button: 'right' });
      const fields = page.locator('.selection-property-panel .selection-property-fields');
      await expect(fields).toContainText('Görsel ölçüsü');
      return fields;
    };
    const dialog = await open();
    await expect(page.getByRole('dialog', { name: 'Görsel ölçüsü' })).toHaveCount(0);
    const cameraBefore = await page.evaluate(() => window.__imageControls.object.position.toArray());
    const canvasBox = await page.locator('#viewport > canvas').boundingBox();
    await page.mouse.move(canvasBox.x + canvasBox.width * 0.2, canvasBox.y + canvasBox.height * 0.9);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + canvasBox.width * 0.35, canvasBox.y + canvasBox.height * 0.9, { steps: 5 });
    await page.mouse.up();
    await expect.poll(() => page.evaluate(before => {
      const after = window.__imageControls.object.position.toArray();
      return Math.hypot(...after.map((value, index) => value - before[index]));
    }, cameraBefore)).toBeGreaterThan(0.01);
    const distanceBefore = await page.evaluate(() => window.__imageControls.object.position.distanceTo(window.__imageControls.target));
    await page.mouse.wheel(0, -250);
    await expect.poll(() => page.evaluate(() => window.__imageControls.object.position.distanceTo(window.__imageControls.target)))
      .toBeLessThan(distanceBefore);
    // Sonraki menü kontrolleri için aynı kamera görünümüne dön.
    await selectImagePanels(page, 'front', mode === 'single');
    await expect(dialog).toContainText('Görsel ölçüsü');
    const width = dialog.locator('input[name="widthCm"]');
    await width.fill('150');
    await expect.poll(async () => {
      const state = await previewState(page);
      return state.states.some(item => item.renderer.imageTransform?.widthCm === 150
        || item.renderer.fabricImageWidthCm === 150);
    }).toBe(true);
    await width.fill('120');
    await dialog.locator('input[name="heightCm"]').fill('30');
    await expect.poll(async () => {
      const state = await previewState(page);
      return state.states.some(item => item.renderer.imageTransform?.widthCm === 120
        || item.renderer.fabricImageWidthCm === 120);
    }).toBe(true);
    await page.waitForTimeout(1200); // Geçmiş ve otomatik kayıt izleyicileri en az bir tur çalışır.
    // Kayıt önizleme açıkken tetiklense bile yalnız onaylı ağaç serileşir.
    await page.evaluate(async () => {
      const { getActiveAutosaveController } = await import('/src/autosaveController.js');
      await getActiveAutosaveController().flush();
    });
    const temporary = await previewState(page);
    if (mode === 'group') await page.screenshot({ path: testInfo.outputPath('panel-preview.png') });
    expect(temporary.states.map(item => item.persistent)).toEqual(original.states.map(item => item.persistent));
    expect(mode === 'lightbox' || mode === 'mesh' ? temporary.overlays : temporary.states.map(item => item.repeat))
      .not.toEqual(mode === 'lightbox' || mode === 'mesh' ? original.overlays : original.states.map(item => item.repeat));
    await width.fill(''); // Geçersiz değer önizlemeyi bozmaz.
    await page.waitForTimeout(120);
    expect((await previewState(page)).states.map(item => item.renderer)).toEqual(temporary.states.map(item => item.renderer));
    await width.press('Escape');
    await expect.poll(async () => (await previewState(page)).states.map(item => item.renderer))
      .toEqual(original.states.map(item => item.renderer));
    await expect.poll(async () => {
      const state = await previewState(page);
      return mode === 'lightbox' || mode === 'mesh' ? state.overlays : state.states.map(item => item.repeat);
    }).toEqual(mode === 'lightbox' || mode === 'mesh' ? original.overlays : original.states.map(item => item.repeat));

    // Esc yazılan değeri bırakır; alan kayıtlı ölçüye döner.
    const cancelled = await open();
    await cancelled.locator('input[name="widthCm"]').fill('115');
    await expect.poll(async () => (await previewState(page)).states.some(item => item.renderer.imageTransform?.widthCm === 115
      || item.renderer.fabricImageWidthCm === 115)).toBe(true);
    await cancelled.locator('input[name="widthCm"]').press('Escape');
    await expect.poll(async () => (await previewState(page)).states.map(item => item.renderer))
      .toEqual(original.states.map(item => item.renderer));
    // Enter tek geri alma adımıyla uygular.
    const confirmed = await open();
    await confirmed.locator('input[name="widthCm"]').fill('140');
    await confirmed.locator('input[name="heightCm"]').fill('35');
    await confirmed.locator('input[name="heightCm"]').press('Enter');
    await expect.poll(async () => (await previewState(page)).states.some(item => item.persistent.imageTransform?.widthCm === 140
      || item.persistent.fabricImageWidthCm === 140)).toBe(true);
    await page.locator('#design-undo').click();
    await expect.poll(async () => (await previewState(page)).states.map(item => item.persistent))
      .toEqual(original.states.map(item => item.persistent));
    await page.locator('#design-redo').click();
    await expect.poll(async () => (await previewState(page)).states.some(item => item.persistent.imageTransform?.widthCm === 140
      || item.persistent.fabricImageWidthCm === 140)).toBe(true);
    await page.locator('#save-project').click();
    await expect(page.locator('#project-status')).toContainText('Kaydedildi:');
    await page.reload();
    await openSavedProject(page, projectId);
    await expect.poll(async () => (await previewState(page)).states.some(item => item.persistent.imageTransform?.widthCm === 140
      || item.persistent.fabricImageWidthCm === 140)).toBe(true);
    expect(errors).toEqual([]);
  });
}

function groupSurfaces(page, ids) {
  return page.evaluate(ids => window.__imageSurfaces()
    .filter(mesh => ids.includes(mesh.userData.moduleId))
    .map(mesh => ({ id: mesh.userData.surfaceId, moduleId: mesh.userData.moduleId,
      renderer: mesh.userData.surfaceState, persistent: mesh.userData.persistentSurfaceState }))
    .sort((a, b) => a.id.localeCompare(b.id)), ids);
}

for (const kind of ['panel', 'legacy', 'lightbox', 'mesh']) {
  test(`${kind}: kopya grubun görsel ölçüsü değişince kaynak grubun görünümü ve kaydı değişmez`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const projectId = await preparePanels(page, 180, 'front');
    const points = await selectImagePanels(page, 'front');
    if (kind === 'lightbox' || kind === 'mesh') {
      await page.mouse.click(points[0].x, points[0].y, { button: 'right' });
      await page.locator(`[data-module-action="toggle-${kind === 'mesh' ? 'mesh' : 'fabric'}"]`).click();
    }
    await showSurfaceControls(page, 'image');
    await page.locator('#surface-image').setInputFiles({ name: 'shared-logo.png', mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
    await expect(page.locator('#selection-info')).toContainText('görsel');
    const originalIds = await page.evaluate(async kind => {
      const { createGroup } = await import('/src/moduleGroups.js');
      const modules = new Map();
      window.__imageSurfaces().forEach(mesh => {
        let parent = mesh;
        while (parent && !parent.userData.moduleState) parent = parent.parent;
        if (parent) modules.set(parent.userData.moduleState.id, parent.userData.moduleState);
        if (kind === 'legacy') {
          delete mesh.userData.surfaceState.imageTransform?.blockId;
          delete mesh.userData.persistentSurfaceState.imageTransform?.blockId;
        }
      });
      const list = [...modules.values()];
      const result = createGroup(list, [...modules.keys()], { stand: { standType: 'island', standXCm: 900, standYCm: 900 } });
      if (!result.ok) throw new Error(result.message);
      return [...modules.keys()];
    }, kind);
    const original = await groupSurfaces(page, originalIds);
    await page.mouse.click(points[0].x, points[0].y, { button: 'right' });
    await page.locator('[data-module-action="group-duplicate"]').click();
    await expect.poll(() => page.evaluate(ids => new Set(window.__imageSurfaces()
      .filter(mesh => !ids.includes(mesh.userData.moduleId)).map(mesh => mesh.userData.moduleId)).size, originalIds)).toBe(2);
    const cloneIds = await page.evaluate(ids => [...new Set(window.__imageSurfaces()
      .filter(mesh => !ids.includes(mesh.userData.moduleId)).map(mesh => mesh.userData.moduleId))], originalIds);
    if (kind === 'legacy') await page.evaluate(ids => {
      window.__imageSurfaces().filter(mesh => ids.includes(mesh.userData.moduleId)).forEach(mesh => {
        delete mesh.userData.surfaceState.imageTransform?.blockId;
        delete mesh.userData.persistentSurfaceState.imageTransform?.blockId;
      });
    }, cloneIds);
    const copyPoint = await page.evaluate(ids => {
      const surfaces = window.__imageSurfaces().filter(mesh => ids.includes(mesh.userData.moduleId) && mesh.userData.stripIndex === 3);
      surfaces.forEach(mesh => mesh.updateWorldMatrix(true, false));
      const controls = window.__imageControls;
      const center = surfaces.reduce((sum, mesh) => sum.add(mesh.getWorldPosition(mesh.position.clone())), surfaces[0].position.clone().set(0, 0, 0)).multiplyScalar(1 / surfaces.length);
      controls.target.copy(center);
      controls.object.position.copy(center).addScaledVector(surfaces[0].getWorldDirection(surfaces[0].position.clone()), 8);
      controls.update(); controls.object.updateMatrixWorld(true);
      const point = surfaces[0].getWorldPosition(surfaces[0].position.clone()).project(controls.object);
      const box = document.querySelector('#viewport > canvas').getBoundingClientRect();
      return { x: box.left + (point.x + 1) * box.width / 2, y: box.top + (1 - point.y) * box.height / 2 };
    }, cloneIds);
    await page.mouse.click(copyPoint.x, copyPoint.y, { button: 'right' });
    const dialog = page.locator('.selection-property-panel .selection-property-fields');
    await expect(dialog).toContainText('Görsel ölçüsü');
    expect(Number(await dialog.locator('input[name="widthCm"]').inputValue())).toBeLessThan(350);
    await dialog.locator('input[name="widthCm"]').fill('120');
    await expect.poll(async () => (await groupSurfaces(page, cloneIds)).some(item => item.renderer.imageTransform?.widthCm === 120
      || item.renderer.fabricImageWidthCm === 120)).toBe(true);
    expect(await groupSurfaces(page, originalIds)).toEqual(original);
    await dialog.locator('input[name="widthCm"]').press('Enter');
    await expect.poll(async () => (await groupSurfaces(page, cloneIds)).some(item => item.persistent.imageTransform?.widthCm === 120
      || item.persistent.fabricImageWidthCm === 120)).toBe(true);
    expect(await groupSurfaces(page, originalIds)).toEqual(original);
    await page.locator('#save-project').click();
    await expect(page.locator('#project-status')).toContainText('Kaydedildi:');
    await page.reload();
    await openSavedProject(page, projectId);
    await expect.poll(() => groupSurfaces(page, originalIds)).toEqual(original);
    await expect.poll(async () => (await groupSurfaces(page, cloneIds)).some(item => item.persistent.imageTransform?.widthCm === 120
      || item.persistent.fabricImageWidthCm === 120)).toBe(true);
    await selectImagePanels(page, 'front', false, cloneIds);
    await showSurfaceControls(page, 'image');
    await page.locator('#surface-image').setInputFiles({ name: 'replacement-logo.png', mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
    const sourceAssets = new Set(original.map(item => item.persistent.fabricImageAssetId ?? item.persistent.imageAssetId).filter(Boolean));
    await expect.poll(async () => (await groupSurfaces(page, cloneIds)).some(item => {
      const asset = item.persistent.fabricImageAssetId ?? item.persistent.imageAssetId;
      return asset && !sourceAssets.has(asset);
    })).toBe(true);
    expect(await groupSurfaces(page, originalIds)).toEqual(original);
    expect(errors).toEqual([]);
  });
}

// Yazılımsal Chromium çizimi CI’da çok adımlı kayıt/taşıma senaryolarını yavaşlatır.
test.beforeEach(() => {
  if (process.env.CI) test.slow();
});
