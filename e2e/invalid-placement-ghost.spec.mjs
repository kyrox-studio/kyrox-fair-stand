import { test, expect } from '@playwright/test';

async function createIslandStand(page, projectName) {
  await page.goto('/');

  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('5');
  await page.locator('#stand-size-y').fill('5');
  await page.locator('#create-stage').click();

  const projectNameInput = page.locator('form input[name="projectName"]');
  await expect(projectNameInput).toBeVisible();
  await projectNameInput.fill(projectName);
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
}

async function openCatalogCard(page, itemKey) {
  const openCatalogButton = page.locator('#open-module-catalog');
  const modulePanel = page.locator('details', { has: openCatalogButton });
  await modulePanel.locator(':scope > summary').click();

  const card = page.locator(`.module-drag-card[data-module-key="${itemKey}"]`);
  const group = page.locator('.module-drag-group', { has: card });
  if (!(await group.getAttribute('open'))) {
    await group.locator(':scope > summary').click();
  }
  await card.scrollIntoViewIfNeeded();
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('aria-disabled', 'false');
  return card;
}

function scenePlacementCanvas(page) {
  // Sahne canvas'ı #viewport'un doğrudan çocuğudur; ViewCube iç içe ikinci canvas'tır.
  return page.locator('#viewport > canvas');
}

async function previewCatalogDrag(page, itemKey, xRatio, yRatio) {
  await expect(scenePlacementCanvas(page)).toBeVisible();
  await page.evaluate(({ key, xr, yr }) => {
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

    const fire = (nextXRatio, nextYRatio) => {
      const rect = viewport.getBoundingClientRect();
      viewport.dispatchEvent(new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
        clientX: rect.left + rect.width * nextXRatio,
        clientY: rect.top + rect.height * nextYRatio,
      }));
    };

    fire(xr, yr);
    if (canvas.dataset.placementGhost) return;

    // CI ve local izometrik kadrajı kayabilir; tercih edilen oran kaçırırsa
    // activeFloor isabeti bulunana kadar stand içi ızgara taranır.
    for (let x = 0.42; x <= 0.78; x += 0.08) {
      for (let y = 0.58; y <= 0.86; y += 0.07) {
        fire(x, y);
        if (canvas.dataset.placementGhost) return;
      }
    }
  }, { key: itemKey, xr: xRatio, yr: yRatio });
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

// Kural değişti (kullanıcı kararı 2026-10-19): dikme birleşime yakın değilse sahneye serbest
// bırakılır; birleşime yakınsa yine yapışır.
test('upright_346_5 drops freely when no short-up joint is near', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await createIslandStand(page, 'Invalid Ghost Upright');
  await openCatalogCard(page, 'upright_346_5');

  const viewport = page.locator('#viewport');
  await expect(viewport).toBeVisible();
  await previewCatalogDrag(page, 'upright_346_5', 0.52, 0.72);

  await expect(scenePlacementCanvas(page)).toHaveAttribute('data-placement-ghost', 'valid');
  await expect(page.locator('body')).not.toContainText('Yalnız short-up, profil veya banko birleşimine yerleştirilir.');

  // Gerçek sürükle-bırak: birleşim yokken dikme zemine serbest yerleşir.
  const box = await viewport.boundingBox();
  expect(box).not.toBeNull();
  await page.locator('.module-drag-card[data-module-key="upright_346_5"]').dragTo(viewport, {
    targetPosition: { x: Math.round(box.width * 0.6), y: Math.round(box.height * 0.85) },
  });
  // Bırakınca dikme boyu sorulur; varsayılan seçili duvarın (350) dikmesidir.
  const heightDialog = page.getByRole('dialog', { name: 'Dikme yüksekliği' });
  await expect(heightDialog).toBeVisible();
  await expect(heightDialog.locator('select')).toHaveValue('upright_346_5');
  await heightDialog.getByRole('button', { name: 'Uygula' }).click();
  await expect(heightDialog).toBeHidden();

  const project = await saveAndReadProject(page);
  expect(project).not.toBeNull();
  expect(project.modules.filter((moduleState) => moduleState.itemKey === 'upright_346_5')).toHaveLength(1);
  expect(pageErrors).toEqual([]);
});

test('valid free-floor catalog preview keeps a green ghost', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await createIslandStand(page, 'Valid Ghost Fridge');
  await openCatalogCard(page, 'mini_fridge_avanti');
  await previewCatalogDrag(page, 'mini_fridge_avanti', 0.52, 0.82);
  await expect(scenePlacementCanvas(page)).toHaveAttribute('data-placement-ghost', 'valid');
  expect(pageErrors).toEqual([]);
});
