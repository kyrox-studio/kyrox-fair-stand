import { test, expect } from '@playwright/test';

function guideSection(page, title) {
  return page.locator('.help-guide-section', {
    has: page.locator('summary', { hasText: title }),
  });
}

test('help guide explains metal separator splitting, duplicate groups and placement warnings', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');

  await page.locator('#help-guide-button').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const metal = guideSection(page, 'Metal Separatör');
  await metal.locator('summary').click();
  await expect(metal).toContainText('Aynı grup her zaman tek levha değildir.');
  await expect(metal).toContainText('1 x 197 × 47 + 1 x 98 × 47');
  await expect(metal).toContainText('Toplam m² değişmez.');

  // Kopyala sağ tık menüsünde değil, seçim çubuğundadır (Mouse Kontrolleri).
  const mouse = guideSection(page, 'Mouse Kontrolleri');
  await mouse.locator('summary').click();
  await expect(mouse).toContainText('Kopyadaki metal separatör kendi grubunu alır');

  const foam = guideSection(page, 'Işıklı Strafor');
  await foam.locator('summary').click();
  await expect(foam).toContainText('Yerleştirilemezse uyarı modülün adıyla ve gerçek sebeple çıkar');

  const rules = guideSection(page, 'Önemli Kurallar ve Uyarılar');
  await rules.locator('summary').click();
  await expect(rules).toContainText('uyarı modülün adını ve sebebini yazar');
  expect(errors).toEqual([]);
});
