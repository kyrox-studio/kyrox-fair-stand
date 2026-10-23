import { test, expect } from '@playwright/test';

async function createStand(page, standName, projectName) {
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: standName }).click();
  await page.locator('#stand-size-x').fill('500');
  await page.locator('#stand-size-y').fill('500');
  await page.locator('#create-stage').click();
  const projectNameInput = page.locator('form input[name="projectName"]');
  await expect(projectNameInput).toBeVisible();
  await projectNameInput.fill(projectName);
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
}

async function openSurfacePanel(page) {
  const panel = page.locator('details', { has: page.locator('#apply-color') });
  if (!(await panel.getAttribute('open'))) {
    await panel.locator(':scope > summary').click();
  }
  await expect(page.locator('#apply-color')).toBeVisible();
}

test('seçim yokken Rengi uygula production mesajı verir ve state bozulmaz', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await createStand(page, 'Sırt Duvar', 'E2E Color No Selection');
  await openSurfacePanel(page);

  await page.locator('#apply-color').click();
  await expect(page.locator('#selection-info')).toHaveText(
    'Önce 3D sahnede boyamak istediğin panel, panel bloğu, modül veya zemini seç.',
  );
  await expect(page.locator('#raw-bom-debug')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('görsel arşive yüklenir; seçim yokken Kaldır production mesajı verir', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await createStand(page, 'Ada Stand', 'E2E Image Library');
  await openSurfacePanel(page);

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  await page.locator('#surface-image').setInputFiles({
    name: 'e2e-swatch.png',
    mimeType: 'image/png',
    buffer: png,
  });
  await expect(page.locator('#asset-status')).toContainText('Aktif görsel: e2e-swatch.png');
  await expect(page.locator('.asset-tile')).toHaveCount(1);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('#surface-image').setInputFiles({
    name: 'e2e-poster.png',
    mimeType: 'image/png',
    buffer: png,
  });
  const tiles = page.locator('button.asset-tile');
  await expect(tiles).toHaveCount(2);
  await expect(tiles.nth(0).locator('span')).toHaveText('e2e-swatch.png');
  await expect(tiles.nth(1).locator('span')).toHaveText('e2e-poster.png');
  const tileBoxes = [];
  for (let index = 0; index < 2; index += 1) {
    const tile = tiles.nth(index);
    await expect.poll(async () => (await tile.locator('img').boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(80);
    const tileBox = await tile.boundingBox();
    const imageBox = await tile.locator('img').boundingBox();
    const spanBox = await tile.locator('span').boundingBox();
    expect(tileBox).not.toBeNull();
    expect(imageBox).not.toBeNull();
    expect(spanBox).not.toBeNull();
    expect(imageBox.height).toBeGreaterThanOrEqual(80);
    expect(imageBox.height).toBeLessThanOrEqual(88);
    expect(spanBox.height).toBeGreaterThanOrEqual(12);
    expect(spanBox.y).toBeGreaterThanOrEqual(imageBox.y + imageBox.height - 1);
    expect(spanBox.y + spanBox.height).toBeLessThanOrEqual(tileBox.y + tileBox.height + 1);
    tileBoxes.push(tileBox);
  }
  const [firstTile, secondTile] = tileBoxes;
  const tilesOverlap = !(
    firstTile.x + firstTile.width <= secondTile.x + 0.5
    || secondTile.x + secondTile.width <= firstTile.x + 0.5
    || firstTile.y + firstTile.height <= secondTile.y + 0.5
    || secondTile.y + secondTile.height <= firstTile.y + 0.5
  );
  expect(tilesOverlap).toBe(false);

  await page.locator('#clear-texture').click();
  await expect(page.locator('#selection-info')).toHaveText('Önce bir panel veya panel bloğu seç.');
  await expect(page.locator('.asset-tile')).toHaveCount(2);
  expect(pageErrors).toEqual([]);
});

test('5 MB üstü görsel arşive yazılmaz', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await createStand(page, 'Ada Stand', 'E2E Image Size Cap');
  await openSurfacePanel(page);

  // Hata pencere (alert) açmaz; sağ altta bildirim olarak görünür.
  const dialogs = [];
  page.on('dialog', (dialog) => { dialogs.push(dialog.message()); void dialog.dismiss(); });
  await page.locator('#surface-image').setInputFiles({
    name: 'too-big.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 1),
  });
  const toast = page.locator('.toast-stack .toast--error', { hasText: 'Görsel en fazla 5 MB olabilir.' });
  await expect(toast).toHaveCount(1);
  await expect(toast).toHaveAttribute('role', 'alert');
  await toast.locator('.toast__close').click();
  await expect(toast).toHaveCount(0);
  expect(dialogs).toEqual([]);
  await expect(page.locator('#asset-status')).toHaveText('Görsel seçilmedi.');
  await expect(page.locator('.asset-tile')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('katalog image-capable wall ve non-image TV kartlarını birlikte sunar', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await createStand(page, 'Ada Stand', 'E2E Capability Catalog');

  const openCatalogButton = page.locator('#open-module-catalog');
  const modulePanel = page.locator('details', { has: openCatalogButton });
  await modulePanel.locator(':scope > summary').click();

  const wallCard = page.locator('.module-drag-card[data-module-key="wall_100_350"]');
  const tvCard = page.locator('.module-drag-card[data-module-key="tv_42"]');
  const fridgeCard = page.locator('.module-drag-card[data-module-key="mini_fridge_avanti"]');

  for (const card of [wallCard, tvCard, fridgeCard]) {
    const group = page.locator('.module-drag-group', { has: card });
    if (!(await group.getAttribute('open'))) {
      await group.locator(':scope > summary').click();
    }
    await card.scrollIntoViewIfNeeded();
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('aria-disabled', 'false');
  }
  expect(pageErrors).toEqual([]);
});
