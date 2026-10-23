// Ayarlar bölümü kullanıcı gibi başlığa basılarak açılır.
export async function openEditorSettings(page) {
  await page.locator('#editor-mode-advanced').click();
  const settings = page.locator('details.editor-settings-card');
  if (!(await settings.evaluate(element => element.open))) await settings.locator(':scope > summary').click();
}
