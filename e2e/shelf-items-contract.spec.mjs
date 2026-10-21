import { test, expect } from '@playwright/test';

async function createBackWallStand(page, projectName, widthCm = 500) {
  await page.goto('/');
  const setup = page.locator('details.stand-setup-card');
  await setup.locator('summary').click();
  await setup.getByRole('button', { name: 'Sırt Duvar' }).click();
  await page.locator('#stand-size-x').fill(String(widthCm));
  await page.locator('#stand-size-y').fill('500');
  await page.locator('#create-stage').click();
  const input = page.locator('form input[name="projectName"]');
  await expect(input).toBeVisible();
  await input.fill(projectName);
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
    return projects.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0] ?? null;
  });
}

async function openSidebarCard(page, itemKey) {
  const open = page.locator('#open-module-catalog');
  await page.locator('details', { has: open }).locator(':scope > summary').click();
  const card = page.locator(`.module-drag-card[data-module-key="${itemKey}"]`).first();
  const group = page.locator('.module-drag-group', { has: card });
  if (!(await group.getAttribute('open'))) {
    await group.locator(':scope > summary').click();
  }
  await card.scrollIntoViewIfNeeded();
  await expect(card).toBeVisible();
  return { card, group };
}

async function dragShelfOntoValidSeam(page, itemKey) {
  await page.evaluate((key) => {
    const card = document.querySelector(`.module-drag-card[data-module-key="${key}"]`);
    const viewport = document.querySelector('#viewport');
    const canvas = viewport?.querySelector(':scope > canvas');
    if (!card || !viewport || !canvas) throw new Error('katalog kartı veya viewport yok');
    const dataTransfer = new DataTransfer();
    card.dispatchEvent(new DragEvent('dragstart', {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    }));

    const fire = (type, xRatio, yRatio) => {
      const rect = viewport.getBoundingClientRect();
      viewport.dispatchEvent(new DragEvent(type, {
        bubbles: true,
        cancelable: true,
        dataTransfer,
        clientX: rect.left + rect.width * xRatio,
        clientY: rect.top + rect.height * yRatio,
      }));
    };

    let dropped = false;
    for (let x = 0.28; x <= 0.78 && !dropped; x += 0.06) {
      for (let y = 0.22; y <= 0.72 && !dropped; y += 0.04) {
        fire('dragover', x, y);
        if (canvas.dataset.placementGhost === 'valid') {
          fire('drop', x, y);
          dropped = true;
        }
      }
    }
    if (!dropped) {
      throw new Error(`geçerli panel-seam ghost bulunamadı: ${canvas.dataset.placementGhost ?? 'yok'}`);
    }
  }, itemKey);
}

test('shelf_100/150/200 Catalog’da Raf & Vitrin altında vitrinlerden sonra görünür', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await createBackWallStand(page, 'Shelf Catalog Order');
  const { group } = await openSidebarCard(page, 'shelf_row_1');
  const keys = await group.locator('.module-drag-card').evaluateAll((cards) => (
    cards.map((card) => card.getAttribute('data-module-key'))
  ));
  expect(keys).toEqual([
    'wall_showcase_100_3_350',
    'wall_showcase_100_2_350',
    'shelf_row_1',
    'shelf_row_2',
    'shelf_row_3',
    // 0074: ayaklı vitrin rafların ardından gelir.
    'floor_showcase_100',
  ]);
  for (const itemKey of ['wall_shelf_2_100', 'wall_shelf_3_200']) {
    await expect(page.locator(`.module-drag-card[data-module-key="${itemKey}"]`)).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

for (const itemKey of ['shelf_row_1', 'shelf_row_2', 'shelf_row_3']) {
  test(`${itemKey} catalog drag sığdığı wall/panel support span’ine overlay olarak eklenir`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await createBackWallStand(page, itemKey, 500);
    const initial = await saveAndReadProject(page);
    const wallUsedBefore = (initial.modules ?? [])
      .filter((module) => module.placement?.wallId === 'back' && module.type !== 'shelf')
      .reduce((sum, module) => sum + Number(module.widthCm || 0), 0);

    await openSidebarCard(page, itemKey);
    await dragShelfOntoValidSeam(page, itemKey);

    const project = await saveAndReadProject(page);
    const shelf = project.modules.find((module) => module.type === 'shelf');
    expect(shelf).toBeTruthy();
    expect(shelf.type).toBe('shelf');
    const rows = Number(itemKey.replace('shelf_row_', ''));
    expect([100, 150, 200]).toContain(shelf.widthCm);
    expect(shelf.itemKey).toBe(rows === 1 ? 'shelf_' + shelf.widthCm : itemKey + '_' + shelf.widthCm);
    expect(shelf.depthCm).toBe(38);
    expect(shelf.heightCm).toBe(1.8 + (rows - 1) * 50);
    expect(shelf.placement.wallId).toBe('back');
    const host = project.modules.find((module) => module.type !== 'shelf'
      && module.placement?.wallId === shelf.placement.wallId
      && Math.abs(Number(module.placement.xCm) - Number(shelf.placement.xCm)) < 0.001
      && Math.abs(Number(module.placement.yCm) - Number(shelf.placement.yCm)) < 0.001);
    expect(host, 'raf hedef duvarın başlangıcına ve tam genişliğine oturmalı').toBeTruthy();
    expect(shelf.widthCm).toBe(host.widthCm);
    expect(project.modules.some((module) => String(module.itemKey).startsWith('wall_shelf_'))).toBe(false);

    const wallUsedAfter = project.modules
      .filter((module) => module.placement?.wallId === 'back' && module.type !== 'shelf')
      .reduce((sum, module) => sum + Number(module.widthCm || 0), 0);
    expect(wallUsedAfter).toBe(wallUsedBefore);
    expect(errors).toEqual([]);
    expect(errors.some((message) => message.includes('Missing canonical shelf Item'))).toBe(false);
  });
}

test('shelf_100 drop sonrası ikinci serbest modül eklenir ve sahne rebuild zinciri bozulmaz', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await createBackWallStand(page, 'Shelf Then Fridge', 500);
  await openSidebarCard(page, 'shelf_row_1');
  await dragShelfOntoValidSeam(page, 'shelf_row_1');

  const afterShelf = await saveAndReadProject(page);
  const placedShelf = afterShelf.modules.find((module) => module.type === 'shelf');
  expect(placedShelf?.itemKey).toMatch(/^shelf_(100|150|200)$/);

  const fridgeCard = page.locator('.module-drag-card[data-module-key="mini_fridge_avanti"]').first();
  const fridgeGroup = page.locator('.module-drag-group', { has: fridgeCard });
  if (!(await fridgeGroup.evaluate((el) => el.open))) {
    await fridgeGroup.locator(':scope > summary').click();
  }
  await fridgeCard.scrollIntoViewIfNeeded();
  await expect(fridgeCard).toBeVisible();
  const viewport = page.locator('#viewport');
  const box = await viewport.boundingBox();
  expect(box).not.toBeNull();
  await fridgeCard.dragTo(viewport, {
    targetPosition: {
      x: Math.round(box.width * 0.52),
      y: Math.round(box.height * 0.82),
    },
  });

  const afterFridge = await saveAndReadProject(page);
  expect(afterFridge.modules.find((module) => module.id === placedShelf.id)?.itemKey).toBe(placedShelf.itemKey);
  expect(afterFridge.modules.find((module) => module.itemKey === 'mini_fridge_avanti')?.itemKey).toBe('mini_fridge_avanti');
  expect(afterFridge.modules.every((module) => Boolean(module.itemKey))).toBe(true);
  expect(errors).toEqual([]);
});
