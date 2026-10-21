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
  const dialog = page.getByRole('dialog', { name: 'Kullanım Kılavuzu' });
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
  await expect(mouse).toContainText('Shift+R yalnız kopyayı döndürür');

  const move = guideSection(page, 'Modül Taşıma, Döndürme ve Yerleşim');
  await move.locator('summary').click();
  await expect(move).toContainText('Bütün modüller 10 cm adımla hareket eder');
  await expect(move).toContainText('1 m kalın, 50 cm ince çizgiler çıkar; bırakınca kaybolur');
  await expect(move).toContainText('standın dört kenarına uzaklık');
  await expect(move).toContainText('köşeye çekilmez');

  const showcase = guideSection(page, 'Ayaklı Vitrin ve Broşürlük');
  await showcase.locator('summary').click();
  await expect(showcase).toContainText('ön, sol ve sağ yüzüne sağ tıkla renk, görsel ve Lightbox');
  await expect(showcase).toContainText('Üretim listesine tek kalem, 1 adet');

  const foam = guideSection(page, 'Işıklı Strafor');
  await foam.locator('summary').click();
  await expect(foam).toContainText('Yerleştirilemezse uyarı modülün adıyla ve gerçek sebeple çıkar');

  const rules = guideSection(page, 'Önemli Kurallar ve Uyarılar');
  await rules.locator('summary').click();
  await expect(rules).toContainText('uyarı modülün adını ve sebebini yazar');
  const shelves = guideSection(page, 'Raf Aydınlatması');
  await shelves.locator('summary').click();
  await expect(shelves).toContainText('Tekli raf');
  await expect(shelves).toContainText('2 sıralı raf');
  await expect(shelves).toContainText('3 sıralı raf');
  await expect(shelves).toContainText('Raf genişliği takıldığı duvardan seçilir');
  await expect(shelves).toContainText('Başka duvara taşıdığında genişlik yeniden seçilir');
  await expect(shelves).toContainText('bütün raf sıralarına uygulanır');
  expect(errors).toEqual([]);
});
