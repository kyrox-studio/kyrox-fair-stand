import { test, expect } from '@playwright/test';

// Hata ve uyarılar sağ altta bildirimdir (src/toastNotifications.js); sürükleme uyarısı da dahil.

for (const viewport of [{ width: 1280, height: 820 }, { width: 390, height: 844 }]) {
  test(`bildirimler ekranın altına yakın dizilir: ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.locator('#help-guide-button')).toBeAttached();
    await page.evaluate(async () => {
      const { showToast } = await import('/src/toastNotifications.js');
      showToast('Birinci yerleşim uyarısı', { durationMs: 0 });
      showToast('İkinci yerleşim uyarısı', { durationMs: 0 });
    });
    const stack = page.locator('.toast-stack');
    await expect(stack.locator('.toast')).toHaveCount(2);
    const box = await stack.boundingBox();
    expect(viewport.height - box.y - box.height).toBeGreaterThanOrEqual(8);
    expect(viewport.height - box.y - box.height).toBeLessThanOrEqual(24);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  });
}

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
  await page.locator('details', { has: openCatalogButton }).locator(':scope > summary').click();
  const card = page.locator(`.module-drag-card[data-module-key="${itemKey}"]`);
  const group = page.locator('.module-drag-group', { has: card });
  if (!(await group.getAttribute('open'))) await group.locator(':scope > summary').click();
  await card.scrollIntoViewIfNeeded();
  await expect(card).toBeVisible();
}

// Katalog kartını sahnede verilen oranlara sürükler (bırakmaz). Geçerli oran istenirse stand içi
// ızgara taranır (izometrik kadraj ortamdan ortama kayabilir).
async function dragOver(page, itemKey, points, { untilGhost = false } = {}) {
  await page.evaluate(({ key, list, wantGhost }) => {
    const card = document.querySelector(`.module-drag-card[data-module-key="${key}"]`);
    const viewport = document.querySelector('#viewport');
    const canvas = viewport.querySelector(':scope > canvas');
    window.__toastDragData ??= new DataTransfer();
    const dataTransfer = window.__toastDragData;
    if (!window.__toastDragStarted) {
      card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer }));
      window.__toastDragStarted = true;
    }
    const rect = viewport.getBoundingClientRect();
    for (const [x, y] of list) {
      viewport.dispatchEvent(new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
        clientX: rect.left + rect.width * x,
        clientY: rect.top + rect.height * y,
      }));
      if (wantGhost && canvas.dataset.placementGhost === 'valid') return;
    }
  }, { key: itemKey, list: points, wantGhost: untilGhost });
}

test('sürükleme uyarısı sağ altta bildirim olarak çıkar ve birkaç saniye görünür kalır', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await createIslandStand(page, 'E2E Bildirim');
  await openCatalogCard(page, 'plastic_trash_bin');

  // Gökyüzü: zemin yok.
  await dragOver(page, 'plastic_trash_bin', [[0.5, 0.03]]);
  const toast = page.locator('.toast-stack .toast--error', { hasText: 'aktif stand alanına bırak' });
  await expect(toast).toHaveCount(1);
  await expect(toast).toHaveAttribute('role', 'alert');
  const box = await toast.boundingBox();
  const viewportSize = page.viewportSize();
  expect(box.x + box.width).toBeGreaterThan(viewportSize.width * 0.6);
  expect(box.y).toBeGreaterThan(viewportSize.height * 0.4);

  // Aynı uyarı tekrar gelince yeni kutu açılmaz.
  await dragOver(page, 'plastic_trash_bin', [[0.5, 0.03], [0.52, 0.03]]);
  await expect(page.locator('.toast-stack .toast')).toHaveCount(1);

  // Uyarı birkaç saniye görünür kalır (sahne hemen temizlese de kaybolmaz).
  await page.waitForTimeout(1000);
  await expect(toast).toHaveCount(1);
  expect(pageErrors).toEqual([]);
});
