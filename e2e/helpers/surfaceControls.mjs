// Renk / görsel kontrolleri yalnız Özellikler panelindedir (sol menüde Seçili yüzey kartı yok);
// panel bir yüzey seçiliyken açılır.
export async function showSurfaceControls(page, capability = 'color') {
  const control = capability === 'image' ? '#surface-image-controls' : '#apply-color';
  await page.locator(`.selection-property-panel ${control}`).waitFor({ state: 'visible' });
}
