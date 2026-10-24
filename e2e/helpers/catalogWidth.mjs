import { expect } from '@playwright/test';

// Ölçü ailesi (Panel, Separatör, Banko, Köşe Banko, Baza; migration 0082 / 0083): katalogda aile başına
// tek kart vardır, diğer ölçüler bırakırken / eklerken açılan ölçü penceresinden seçilir.
const FAMILY_CARDS = [
  [/^wall_separator_\d+_350(_sarmasik)?$/, 'wall_separator_100_350'],
  [/^wall_\d+_350$/, 'wall_100_350'],
  [/^desk_banko_\d+_l$/, 'desk_banko_100_l'],
  [/^desk_banko_\d+$/, 'desk_banko_100'],
  [/^base_\d+$/, 'base_100'],
];

/** Item'ın katalogdaki kartı (aile kartı ya da kendisi). */
export function catalogCardKeyFor(itemKey) {
  return FAMILY_CARDS.find(([pattern]) => pattern.test(itemKey))?.[1] ?? itemKey;
}

/** Ölçü penceresi açıksa Item'ın ölçüsünü seçer (sarmaşıklıda çentik işaretlenir) ve uygular. */
export async function chooseCatalogWidth(page, itemKey) {
  const dialog = page.locator('.item-size-dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('select[name="itemKey"]').selectOption(itemKey.replace(/_sarmasik$/, ''));
  if (itemKey.endsWith('_sarmasik')) await dialog.locator('input[name="option"]').check();
  await dialog.locator('button[type="submit"]').click();
  await expect(dialog).toBeHidden();
}
