import { expect } from '@playwright/test';

// Otomatik stand mobilyaları varsayılan açıktır. Mobilyayla ilgisi olmayan akışlar boş
// zeminde sınanır; kutu Yerleşim kartı kapalıyken de kapatılabilsin diye olayla yazılır.
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

// Projeyi kaydeder ve tarayıcıdaki en son kaydı döndürür (IndexedDB).
export async function savedProject(page) {
  await page.locator('#save-project').click();
  await expect(page.locator('#save-project')).toBeEnabled();
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('fair-stand-configurator', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const projects = await new Promise((resolve, reject) => {
      const request = db.transaction('projects', 'readonly').objectStore('projects').getAll();
      request.onsuccess = () => resolve(request.result ?? []);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return projects.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0] ?? null;
  });
}

// Proje yalnız sihirbazdan kurulur (2026-11-10): sol menüdeki seçimlerle sihirbazı sonuna kadar
// ilerletir ve Oluştur'a basar. Sihirbaz kapalıysa (açık proje varken) üst banttaki Yeni ile açılır;
// açık stand varken çıkan "Yeni proje oluşturulacak" penceresi onaylanır.
export async function createStageFromWizard(page) {
  const wizard = page.getByRole('dialog', { name: 'Yeni proje sihirbazı' });
  const hadStand = await page.locator('#viewport-toolbar').isVisible();
  if (!(await wizard.isVisible())) {
    // Açık projede üst banttaki Yeni, boş sahnede (sihirbaz kapatılmışsa) kartın Yeni proje düğmesi.
    await page.locator(hadStand ? '#new-project' : '#empty-new-project').click();
  }
  await expect(wizard).toBeVisible();
  const next = wizard.locator('.wizard-next');
  for (let step = 1; step <= 3; step += 1) {
    await next.click();
    await expect(wizard).toContainText(`Adım ${step + 1} / 4`);
  }
  await next.click();
  if (hadStand) {
    const confirm = page.getByRole('dialog', { name: /Yeni proje oluşturulacak/ });
    await confirm.getByRole('button', { name: 'Uygula' }).click();
  }
}

// Sol menüdeki kartlar kapalı gelir (2026-11-10): Proje kartındaki düğmeler kart açılınca görünür.
export async function openProjectCard(page) {
  await page.locator('details.project-card').evaluate((details) => { details.open = true; });
}

export async function clickProjectAction(page, buttonId) {
  await openProjectCard(page);
  await page.locator(`#${buttonId}`).click();
}
