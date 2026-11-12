import { expect } from '@playwright/test';

// Uygulamanın kendi ad / onay pencereleri (src/inAppDialogs.js): tarayıcı prompt / confirm değil.

export async function answerTextDialog(page, title, value) {
  const dialog = page.getByRole('dialog', { name: title });
  await expect(dialog).toBeVisible();
  await dialog.locator('input[name="inAppDialogText"]').fill(value);
  await dialog.locator('button[type="submit"]').click();
  await expect(dialog).toHaveCount(0);
}

export async function dismissConfirmDialog(page, title) {
  const dialog = page.getByRole('dialog', { name: title });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'İptal' }).click();
  await expect(dialog).toHaveCount(0);
}

export async function acceptConfirmDialog(page, title) {
  const dialog = page.getByRole('dialog', { name: title });
  await expect(dialog).toBeVisible();
  await dialog.locator('button[type="submit"]').click();
  await expect(dialog).toHaveCount(0);
}
