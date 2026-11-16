import { test, expect } from '@playwright/test';
import { disableAutoFurniture, keepWallLock, createStageFromWizard } from './helpers/standSetup.mjs';
import { showSurfaceControls } from './helpers/surfaceControls.mjs';

// ROADMAP "Panellerin atamaya göre dökümü": Üretim Listesi ve sahnedeki Panel Ölçüleri aynı sayımı kullanır.
async function createBackWallStand(page) {
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Sırt Duvar' }).click();
  await page.locator('#stand-size-x').fill('5');
  await page.locator('#stand-size-y').fill('5');
  await disableAutoFurniture(page);
  await createStageFromWizard(page);
  const projectNameInput = page.locator('form input[name="projectName"]');
  await expect(projectNameInput).toBeVisible();
  await projectNameInput.fill('E2E Panel Assignment');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await keepWallLock(page);
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
}

function summaryTotal(text) {
  return Number(text.match(/Toplam (\d+) panel/)?.[1] ?? Number.NaN);
}

test('Panel Ölçüleri her panelde BOM ölçüsü ve atamayı gösterir; liste aynı sayımı yazar', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await createBackWallStand(page);

  const toggle = page.locator('#toggle-panel-labels');
  const summary = page.locator('#panel-assignment-summary');
  const labels = page.locator('.scene-panel-label');
  await expect(toggle).toBeEnabled();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(summary).toBeVisible();
  await expect(summary).toContainText('Varsayılan Panel:');
  const total = summaryTotal(await summary.textContent());
  expect(total).toBeGreaterThan(0);
  // Alt alta aynı etiketli paneller tek etikettir ("… · N panel"); etiketlerin panel toplamı = toplam.
  const labelPanelTotal = () => labels.evaluateAll((nodes) => nodes
    .reduce((sum, node) => sum + Number(node.dataset.panelCount || 1), 0));
  await expect.poll(labelPanelTotal).toBe(total);
  expect(await labels.count()).toBeLessThan(total);
  // Kısa etiket: "197 · Varsayılan · 3" (yalnız genişlik, adet sonda).
  await expect(page.locator('.scene-panel-label[data-panel-count]:not([data-panel-count="1"])').first())
    .toHaveText(/^\d+(,\d)? · Varsayılan · \d+$/);

  // Sırt duvardan bir panel boyanır: renk grubuna geçer, toplam değişmez.
  const canvas = await page.locator('#viewport > canvas').boundingBox();
  await page.mouse.click(canvas.x + canvas.width * 0.5, canvas.y + canvas.height * 0.4);
  await showSurfaceControls(page);
  await page.locator('.selection-property-panel #color-hex').fill('#C0392B');
  await page.locator('.selection-property-panel #color-hex').press('Enter');
  await page.locator('.selection-property-panel #apply-color').click();
  await expect(summary).toContainText('Renk atanan paneller: 1');
  expect(summaryTotal(await summary.textContent())).toBe(total);
  await expect.poll(labelPanelTotal).toBe(total);
  await expect(page.locator('.scene-panel-label.is-color')).toHaveCount(1);
  await expect(page.locator('.scene-panel-label.is-color')).toContainText('#c0392b');

  // Üretim Listesi: Paneller bölümünde aynı gruplar ve adetler.
  await page.locator('#toggle-production-bom').click();
  const totals = page.locator('#production-bom-panel [data-bom-collapse-key="__totals__"]');
  await totals.locator('summary').click();
  const colorGroup = totals.locator('[data-panel-assignment="color"]');
  await expect(colorGroup).toContainText('Renk atanan paneller · 1 panel');
  // Renk satırı ölçü başlığının altındadır: "197 × 47 cm · 1 panel" → "#c0392b · 1 panel".
  await expect(colorGroup.locator('.production-bom-size__title')).toHaveText(/^\d+(,\d)? × 47 cm · 1 panel$/);
  await expect(colorGroup.locator('.production-bom-size li')).toHaveText('#c0392b · 1 panel');
  await expect(totals.locator('[data-panel-assignment="default"]')).toContainText(`Varsayılan Panel · ${total - 1} panel`);

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(labels).toHaveCount(0);
  await expect(summary).toBeHidden();
  expect(pageErrors).toEqual([]);
});
