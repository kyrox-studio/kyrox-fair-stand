import { expect } from '@playwright/test';

// Otomatik stand mobilyaları varsayılan açıktır. Mobilyayla ilgisi olmayan akışlar boş
// zeminde sınanır; kutu Stand Tipi kartı kapalıyken de kapatılabilsin diye olayla yazılır.
export async function disableAutoFurniture(page) {
  await page.locator('#auto-furniture').evaluate((input) => {
    input.checked = false;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

// Yeni sahnede kilitli duvar zinciri varsa koruma kartı açılır; akış korumayı korur.
export async function keepWallLock(page) {
  await expect(page.locator('#project-status')).toContainText('Oluşturuldu');
  const keep = page.locator('.wall-lock-notice [data-wall-lock-choice="keep"]');
  if (await keep.count()) {
    await keep.click();
    await expect(page.locator('.wall-lock-notice')).toHaveCount(0);
  }
}
