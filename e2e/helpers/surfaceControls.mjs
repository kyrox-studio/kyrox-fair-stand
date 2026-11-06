// Panel sekmeleri: size (Ölçü), look (Görünüm), more (Diğer). Tek sekme kalınca çubuk gizlidir.
export async function openPanelTab(page, tab) {
  await page.locator('.selection-property-panel').waitFor({ state: 'visible' });
  const tabList = page.locator('.selection-property-tabs');
  if (await tabList.isVisible()) await tabList.locator(`[data-panel-tab="${tab}"]`).click();
}

// Renk / görsel kontrolleri yalnız Özellikler panelindedir (sol menüde Seçili yüzey kartı yok);
// panel bir yüzey seçiliyken açılır.
export async function showSurfaceControls(page, capability = 'color') {
  const control = capability === 'image' ? '#surface-image-controls' : '#apply-color';
  await openPanelTab(page, 'look');
  await page.locator(`.selection-property-panel ${control}`).waitFor({ state: 'visible' });
}
