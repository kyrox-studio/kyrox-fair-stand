import { test, expect } from '@playwright/test';
import { disableAutoFurniture, keepWallLock, createStageFromWizard } from './helpers/standSetup.mjs';
import { showSurfaceControls } from './helpers/surfaceControls.mjs';

// Panel tipi (kullanıcı kararı 2026-11-18, 0100_panel_finishes): stand geneli tip "Varsayılan Panel"
// grubundaki bütün panellere uygulanır; seçili panele ayrıca tip atanır (görsel atar gibi). Ürün değildir:
// Üretim Listesi kalemi değişmez, panel dökümünde "Panel tipi" grubu çıkar.
async function createBackWallStand(page) {
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Sırt Duvar' }).click();
  await page.locator('#stand-size-x').fill('5');
  await page.locator('#stand-size-y').fill('5');
  await disableAutoFurniture(page);
  await createStageFromWizard(page);
  await page.locator('form input[name="projectName"]').fill('E2E Panel Tipi');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await keepWallLock(page);
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
}

// Ekrandaki panelin ortalama rengi (sayım değil, çizilen piksel): noktanın çevresindeki 9×9 alan.
async function pixelAt(page, x, y) {
  await page.mouse.move(5, 5);
  await page.waitForTimeout(600);
  const png = await page.screenshot({ clip: { x: x - 4, y: y - 4, width: 9, height: 9 } });
  return page.evaluate(async (base64) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    const sum = [0, 0, 0];
    for (let index = 0; index < data.length; index += 4) [0, 1, 2].forEach((channel) => { sum[channel] += data[index + channel]; });
    const count = data.length / 4;
    return sum.map((value) => Math.round(value / count));
  }, png.toString('base64'));
}

// Meşe dokusu sarı-kahve: kırmızı maviden belirgin yüksek. Beyaz / gri panelde kanallar yakın.
const isWoodTone = ([r, , b]) => r - b > 25;

function summaryTotal(text) {
  return Number(text.match(/Toplam (\d+) panel/)?.[1] ?? Number.NaN);
}

test('stand panel tipi varsayılan panelleri boyar; seçili panele tip atanır; geri alınır', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await createBackWallStand(page);

  // Seçenekler admin'deki panel-finish Item'larından gelir; Varsayılan önce.
  const standFinish = page.locator('#panel-finish');
  await expect(standFinish.locator('option')).toHaveText(['Varsayılan', 'Antrasit', 'Meşe', 'Siyah']);
  await expect(standFinish).toHaveValue('panel_finish_default');

  const toggle = page.locator('#toggle-panel-labels');
  const summary = page.locator('#panel-assignment-summary');
  await toggle.click();
  await expect(summary).toContainText('Varsayılan Panel:');
  const total = summaryTotal(await summary.textContent());
  expect(total).toBeGreaterThan(0);

  // Stand tipi Antrasit: bütün varsayılan paneller tip grubuna geçer, toplam değişmez.
  await standFinish.selectOption('panel_finish_antrasit');
  await expect(summary).toContainText(`Panel tipi: ${total}`);
  await expect(summary).not.toContainText('Varsayılan Panel:');
  await expect(page.locator('.scene-panel-label').first()).toContainText('Antrasit');

  // Bir panele Meşe atanır: o panel Meşe, kalanlar Antrasit; toplam aynı.
  const canvas = await page.locator('#viewport > canvas').boundingBox();
  await page.mouse.click(canvas.x + canvas.width * 0.5, canvas.y + canvas.height * 0.4);
  await showSurfaceControls(page);
  await page.locator('.selection-property-panel #surface-finish-options').selectOption('panel_finish_mese');
  await expect(page.locator('#selection-info')).toContainText('Meşe tipi atandı');
  await expect(summary).toContainText(`Panel tipi: ${total}`);
  await expect.poll(() => page.locator('.scene-panel-label').allTextContents())
    .toEqual(expect.arrayContaining([expect.stringContaining('Meşe')]));

  // Üretim Listesi: panel kalemi aynı, döküm tip adıyla.
  await page.locator('#toggle-production-bom').click();
  const finishGroup = page.locator('#production-bom-panel [data-panel-assignment="finish"]');
  await expect(finishGroup).toContainText('Antrasit');
  await expect(finishGroup).toContainText('Meşe');
  await page.locator('#toggle-production-bom').click();

  // Geri al: Meşe ataması kalkar, panel yine stand tipini (Antrasit) alır.
  await page.locator('#design-undo').click();
  await expect.poll(() => page.locator('.scene-panel-label').allTextContents())
    .not.toEqual(expect.arrayContaining([expect.stringContaining('Meşe')]));
  // Stand tipi Varsayılan'a dönünce paneller Varsayılan grubuna döner.
  await standFinish.selectOption('panel_finish_default');
  await expect(summary).toContainText(`Varsayılan Panel: ${total}`);
  expect(pageErrors).toEqual([]);
});

test('stand tipi Meşe iken seçili panele Varsayılan atanınca panel beyaz kalır', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await createBackWallStand(page);
  const summary = page.locator('#panel-assignment-summary');
  await page.locator('#toggle-panel-labels').click();
  await page.locator('#panel-finish').selectOption('panel_finish_mese');
  const total = summaryTotal(await summary.textContent());
  await expect(summary).toContainText(`Panel tipi: ${total}`);

  const canvas = await page.locator('#viewport > canvas').boundingBox();
  const point = { x: canvas.x + canvas.width * 0.5, y: canvas.y + canvas.height * 0.4 };
  await page.locator('#toggle-panel-labels').click();
  expect(isWoodTone(await pixelAt(page, point.x, point.y))).toBe(true);
  await page.mouse.click(point.x, point.y);
  await showSurfaceControls(page);
  await page.locator('.selection-property-panel #surface-finish-options').selectOption('panel_finish_default');
  // Sahnede de: meşe dokusu kalkar, panel ekranda beyaz / gri görünür.
  await expect.poll(async () => isWoodTone(await pixelAt(page, point.x, point.y))).toBe(false);
  await page.locator('#toggle-panel-labels').click();
  // Panelin kendi tipi Varsayılan: stand tipinden ayrılır, Varsayılan Panel grubuna geçer.
  await expect(summary).toContainText('Varsayılan Panel: 1');
  await expect(summary).toContainText(`Panel tipi: ${total - 1}`);
  // Stand tipi değişse de panel Varsayılan kalır.
  await page.locator('#panel-finish').selectOption('panel_finish_siyah');
  await expect(summary).toContainText('Varsayılan Panel: 1');
  expect(pageErrors).toEqual([]);
});
