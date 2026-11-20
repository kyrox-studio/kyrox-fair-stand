import { test, expect } from '@playwright/test';
import { disableAutoFurniture, keepWallLock, createStageFromWizard } from './helpers/standSetup.mjs';
import { dropCatalogCard } from './helpers/catalogDrop.mjs';

// Panel Ölçüleri her panelli modülde (duvar ailesi, kısa panel, kapı, vitrin, banko, baza) listenin saydığı
// her panelin etiketini çizer: etiketlerin panel toplamı = alt özetin toplamı (2026-11-20).
async function createBackWallStand(page) {
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Sırt Duvar' }).click();
  await page.locator('#stand-size-x').fill('6');
  await page.locator('#stand-size-y').fill('6');
  await disableAutoFurniture(page);
  await createStageFromWizard(page);
  await page.locator('form input[name="projectName"]').fill('E2E Panel Etiketleri');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await keepWallLock(page);
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
}

function summaryTotal(text) {
  return Number(text.match(/Toplam (\d+) panel/)?.[1] ?? Number.NaN);
}

const CARDS = [
  'wall_100_350',
  'wall_door_100_350',
  'wall_showcase_100_3_350',
  'wall_100_short_2',
  'wall_100_short_1',
  'desk_banko_100',
  'desk_banko_100_l',
  'base_100',
];

for (const card of CARDS) {
  test(`Panel Ölçüleri ${card} panellerinin hepsini etiketler`, async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await createBackWallStand(page);
    const summary = page.locator('#panel-assignment-summary');
    const labels = page.locator('.scene-panel-label');
    const labelPanelTotal = () => labels.evaluateAll((nodes) => nodes
      .reduce((sum, node) => sum + Number(node.dataset.panelCount || 1), 0));
    const labelSurfaceIds = () => labels.evaluateAll((nodes) => nodes
      .flatMap((node) => String(node.dataset.surfaceIds || '').split(' ').filter(Boolean)));

    await page.locator('#toggle-panel-labels').click();
    await expect(summary).toBeVisible();
    const before = summaryTotal(await summary.textContent());
    expect(before).toBeGreaterThan(0);
    await page.locator('#toggle-panel-labels').click();

    await dropCatalogCard(page, card);
    await page.keyboard.press('Escape');
    await page.locator('#toggle-panel-labels').click();
    await expect(summary).toBeVisible();
    await expect.poll(async () => summaryTotal(await summary.textContent())).toBeGreaterThan(before);
    const total = summaryTotal(await summary.textContent());
    await expect.poll(labelPanelTotal).toBe(total);
    const ids = await labelSurfaceIds();
    expect(ids).toHaveLength(total);
    expect(new Set(ids).size).toBe(total);
    expect(pageErrors).toEqual([]);
  });
}
