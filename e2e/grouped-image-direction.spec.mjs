import { test, expect } from '@playwright/test';

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
  await page.locator('#stand-size-x').fill('900');
  await page.locator('#stand-size-y').fill('900');
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
  await page.locator('#project-select').evaluate((select, id) => { select.value = id; }, id);
  await page.locator('#open-project').click();
  await expect(page.locator('#project-status')).toContainText('Açıldı:');
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

async function selectImagePanels(page, side, single = false) {
  const points = await page.evaluate(side => {
        const controls = window.__imageControls;
        const panels = window.__imageSurfaces().filter(mesh => mesh.userData.moduleType === 'flat-panel'
          && mesh.userData.stripIndex === 3 && (mesh.userData.panelSide ?? 'front') === side);
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
      }, side);
      await page.mouse.click(points[0].x, points[0].y);
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
      const panel = page.locator('details', { has: page.locator('#apply-color') });
      if (!(await panel.getAttribute('open'))) await panel.locator(':scope > summary').click();
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
      await page.locator('#project-select').evaluate((select, id) => { select.value = id; }, id);
      await page.locator('#open-project').click();
      await expect(page.locator('#project-status')).toContainText('Açıldı:');
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
  test(`${mode}: canlı ölçü kayıt ağacına yazılmaz; iptal geri döner, onay tek adımda geri alınır`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const projectId = await preparePanels(page, 180, 'front');
    const points = await selectImagePanels(page, 'front', mode === 'single');
    if (mode === 'lightbox' || mode === 'mesh') {
      await page.mouse.click(points[0].x, points[0].y, { button: 'right' });
      await page.locator('.module-context-advanced-toggle').click();
      await page.locator(`[data-module-action="toggle-${mode === 'mesh' ? 'mesh' : 'fabric'}"]`).click();
    }
    const panel = page.locator('details', { has: page.locator('#apply-color') });
    if (!(await panel.getAttribute('open'))) await panel.locator(':scope > summary').click();
    await page.locator('#surface-image').setInputFiles({ name: 'preview.png', mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
    await expect.poll(async () => {
      const state = await previewState(page);
      return mode === 'lightbox' || mode === 'mesh' ? state.overlays.some(Boolean)
        : state.states.some(item => Boolean(item.renderer.imageAssetId) && Boolean(item.repeat));
    }).toBe(true);
    const original = await previewState(page);
    const open = async () => {
      await page.mouse.click(points[0].x, points[0].y, { button: 'right' });
      await page.locator('[data-module-action="resize-image"]').click();
      return page.getByRole('dialog', { name: 'Görsel ölçüsü' });
    };
    const dialog = await open();
    const width = dialog.locator('input[name="width"]');
    await width.fill('150');
    await expect.poll(async () => {
      const state = await previewState(page);
      return state.states.some(item => item.renderer.imageTransform?.widthCm === 150
        || item.renderer.fabricImageWidthCm === 150);
    }).toBe(true);
    await width.fill('120');
    await dialog.locator('input[name="height"]').fill('30');
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
    expect(temporary.states.map(item => item.persistent)).toEqual(original.states.map(item => item.persistent));
    expect(mode === 'lightbox' || mode === 'mesh' ? temporary.overlays : temporary.states.map(item => item.repeat))
      .not.toEqual(mode === 'lightbox' || mode === 'mesh' ? original.overlays : original.states.map(item => item.repeat));
    await width.fill(''); // Geçersiz değer önizlemeyi bozmaz.
    await page.waitForTimeout(120);
    expect((await previewState(page)).states.map(item => item.renderer)).toEqual(temporary.states.map(item => item.renderer));
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect.poll(async () => (await previewState(page)).states.map(item => item.renderer))
      .toEqual(original.states.map(item => item.renderer));
    await expect.poll(async () => {
      const state = await previewState(page);
      return mode === 'lightbox' || mode === 'mesh' ? state.overlays : state.states.map(item => item.repeat);
    }).toEqual(mode === 'lightbox' || mode === 'mesh' ? original.overlays : original.states.map(item => item.repeat));

    for (const cancel of ['button', 'outside']) {
      const cancelled = await open();
      await cancelled.locator('input[name="width"]').fill('115');
      await expect.poll(async () => (await previewState(page)).states.some(item => item.renderer.imageTransform?.widthCm === 115
        || item.renderer.fabricImageWidthCm === 115)).toBe(true);
      if (cancel === 'button') await cancelled.getByRole('button', { name: 'İptal' }).click();
      else await cancelled.locator('..').click({ position: { x: 4, y: 4 } });
      await expect(cancelled).toHaveCount(0);
      await expect.poll(async () => (await previewState(page)).states.map(item => item.renderer))
        .toEqual(original.states.map(item => item.renderer));
    }
    const confirmed = await open();
    await confirmed.locator('input[name="width"]').fill('140');
    await confirmed.locator('input[name="height"]').fill('35');
    await confirmed.getByRole('button', { name: 'Uygula' }).click();
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
    await page.locator('#project-select').evaluate((select, id) => { select.value = id; }, projectId);
    await page.locator('#open-project').click();
    await expect(page.locator('#project-status')).toContainText('Açıldı:');
    await expect.poll(async () => (await previewState(page)).states.some(item => item.persistent.imageTransform?.widthCm === 140
      || item.persistent.fabricImageWidthCm === 140)).toBe(true);
    expect(errors).toEqual([]);
  });
}
