import { expect } from '@playwright/test';

// Ölçü / varyant ailesi (Panel, Separatör, kısa panel, Banko, Köşe Banko, Baza; 0079 / 0082 / 0083 / 0086):
// katalogda aile başına tek kart vardır, kart bırakılınca kartın kendisi konur. Diğer ölçüler sahnede
// seçili öğenin Özellikler panelindeki varyant düğmelerinden seçilir.
const FAMILY_CARDS = [
  [/^wall_separator_\d+_350(_sarmasik)?$/, 'wall_separator_100_350'],
  [/^wall_\d+_350$/, 'wall_100_350'],
  [/^desk_banko_\d+_l$/, 'desk_banko_100_l'],
  [/^desk_banko_\d+$/, 'desk_banko_100'],
  [/^base_\d+$/, 'base_100'],
  [/^wall_showcase_100_\d_350$/, 'wall_showcase_100_3_350'],
  [/^shelf_row_\d$/, 'shelf_row_1'],
  [/^tv_\d+$/, 'tv_42'],
  [/^video_wall_\dx\d$/, 'video_wall_2x2'],
  [/^extra_long_planter_\d+$/, 'extra_long_planter_100'],
];

/** Item'ın katalogdaki kartı (aile kartı ya da kendisi). */
export function catalogCardKeyFor(itemKey) {
  return FAMILY_CARDS.find(([pattern]) => pattern.test(itemKey))?.[1] ?? itemKey;
}

/**
 * Bırakılıp seçili kalan öğenin varyantını Özellikler panelinden seçer (sarmaşıklıda çentik
 * işaretlenir). Kart varsayılan ölçüdeyse düğme zaten seçilidir.
 */
export async function chooseCatalogWidth(page, itemKey, { vine = itemKey.endsWith('_sarmasik') } = {}) {
  const variants = page.locator('.selection-property-panel .selection-property-variants');
  await expect(variants).toBeVisible();
  const button = variants.locator(`[data-variant-key="${itemKey.replace(/_sarmasik$/, '')}"]`);
  if ((await button.getAttribute('aria-pressed')) !== 'true') await button.click();
  await expect(variants.locator(`[data-variant-key="${itemKey.replace(/_sarmasik$/, '')}"]`)).toHaveAttribute('aria-pressed', 'true');
  if (vine) {
    const option = variants.locator('[data-variant-option]');
    if (!(await option.isChecked())) await option.check();
    await expect(variants.locator('[data-variant-option]')).toBeChecked();
  }
}
