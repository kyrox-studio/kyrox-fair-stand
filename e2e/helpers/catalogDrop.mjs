// Kamera stand tipine göre değişir; zemine isabet eden ilk noktaya bırakılır (viewport oranı).
const DROP_POINTS = [[0.35, 0.8], [0.52, 0.82], [0.3, 0.9], [0.5, 0.92], [0.5, 0.6]];

import { expect } from '@playwright/test';

// Modül ekle kartındaki katalog kartını sahneye bırakır; ret bildiriminde (alan dışı, çakışma)
// sıradaki noktayı dener.
export async function dropCatalogCard(page, cardKey, { points = DROP_POINTS } = {}) {
  const modulePanel = page.locator('#module-add-card');
  if (!(await modulePanel.evaluate((element) => element.open))) await modulePanel.locator(':scope > summary').click();
  const card = page.locator(`.module-drag-card[data-module-key="${cardKey}"]`);
  const group = page.locator('.module-drag-group', { has: card });
  if (!(await group.evaluate((element) => element.open))) await group.locator(':scope > summary').click();
  await card.scrollIntoViewIfNeeded();
  const viewport = page.locator('#viewport');
  const box = await viewport.boundingBox();
  const rejected = page.locator('.toast--error');
  for (const [x, y] of points) {
    // Bildirimler en fazla 2 tane durur; eski hatalar kapatılır ki yeni ret sayılabilsin.
    await page.evaluate(() => document.querySelectorAll('.toast--error').forEach((toast) => toast.remove()));
    await expect(rejected).toHaveCount(0);
    await card.dragTo(viewport, {
      targetPosition: { x: Math.round(box.width * x), y: Math.round(box.height * y) },
    });
    await page.waitForTimeout(400);
    if ((await rejected.count()) === 0) return;
  }
  throw new Error(`${cardKey} kartı stand alanına bırakılamadı.`);
}
