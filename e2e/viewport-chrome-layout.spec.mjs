import { test, expect } from '@playwright/test';

// Üst bant, görünüm küpü ve menü aç/kapa düğmesi hiçbir ekran boyutunda üst üste binmez;
// küp sağ üst köşededir, bantta ipucu yazısı yoktur.
const SIZES = [
  { width: 1440, height: 900 },
  { width: 1180, height: 820 },
  { width: 1024, height: 768 },
  { width: 980, height: 700 },
  { width: 820, height: 1180 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
];

async function createIslandStand(page) {
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('6');
  await page.locator('#stand-size-y').fill('6');
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill('E2E Bant Kup');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
}

function overlaps(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

async function rects(page) {
  return page.evaluate(() => {
    const box = (selector) => {
      const element = document.querySelector(selector);
      if (!element || element.hidden || getComputedStyle(element).display === 'none') return null;
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };
    return {
      toolbar: box('#viewport-toolbar'),
      cube: box('.view-cube'),
      toggle: box('#sidebar-toggle'),
      viewport: box('#viewport'),
    };
  });
}

test('toolbar has no hint texts', async ({ page }) => {
  await createIslandStand(page);
  await expect(page.locator('#viewport-toolbar span')).toHaveCount(0);
  await expect(page.locator('#viewport-toolbar')).not.toContainText('Tekerlek');
});

for (const size of SIZES) {
  test(`toolbar, view cube and menu toggle never overlap at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await createIslandStand(page);
    for (const collapsed of [false, true]) {
      const isCollapsed = await page.locator('#app').evaluate((el) => el.classList.contains('sidebar-collapsed'));
      if (isCollapsed !== collapsed) await page.locator('#sidebar-toggle').click();
      await page.waitForTimeout(250);
      const r = await rects(page);
      expect(r.toolbar, 'bant görünür').toBeTruthy();
      expect(r.cube, 'küp görünür').toBeTruthy();
      expect(overlaps(r.toolbar, r.cube), `bant küpün altına girmez (${collapsed ? 'menü kapalı' : 'menü açık'})`).toBe(false);
      if (r.toggle) expect(overlaps(r.toolbar, r.toggle), 'bant menü düğmesine binmez').toBe(false);
      // Küp sahnenin sağ üst köşesinde.
      expect(r.viewport.x + r.viewport.width - (r.cube.x + r.cube.width)).toBeLessThanOrEqual(14);
      expect(r.cube.y - r.viewport.y).toBeLessThanOrEqual(14);
      await page.screenshot({ path: test.info().outputPath(`layout-${size.width}x${size.height}-${collapsed ? 'kapali' : 'acik'}.png`) });
    }
  });
}
