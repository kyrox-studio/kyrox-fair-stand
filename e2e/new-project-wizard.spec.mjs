import { test, expect } from '@playwright/test';

// Yeni proje sihirbazı: boş sahnede 3 adım (stand tipi, ölçü, özet + Oluştur). Mevcut kurulum
// alanlarını ve "Sahneyi Oluştur" akışını kullanır. İlk kullanım ipuçları bir kez çıkar.

const wizard = (page) => page.getByRole('dialog', { name: 'Yeni proje sihirbazı' });

async function finishNameDialog(page, name) {
  const nameInput = page.locator('form input[name="projectName"]');
  await expect(nameInput).toBeVisible();
  await nameInput.fill(name);
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
}

test('new project wizard sets up an L stand in three steps', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const dialog = wizard(page);
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Adım 1 / 3');
  const next = dialog.getByRole('button', { name: /İleri|Oluştur/ });
  await expect(next).toBeDisabled();

  await dialog.getByRole('button', { name: 'L Stand Sol' }).click();
  await next.click();
  await expect(dialog).toContainText('Adım 2 / 3');
  await dialog.locator('#wizard-size-x').fill('6,5');
  await dialog.locator('#wizard-size-y').fill('4,5');
  await dialog.locator('#wizard-wall-height').selectOption('300');
  await dialog.locator('#wizard-floor-type').selectOption('hali');
  await expect(page.locator('#floor-type')).toHaveValue('hali');
  await expect(dialog.getByLabel('Genişlik (m)', { exact: true })).toHaveValue('6,5');
  await expect(dialog.getByLabel('Derinlik (m)', { exact: true })).toHaveValue('4,5');
  // Sol menüdeki asıl alanlar güncellenir.
  await expect(page.locator('#stand-size-x')).toHaveValue('6,5');
  await expect(page.locator('#wall-height')).toHaveValue('300');
  await next.click();
  await expect(dialog).toContainText('Adım 3 / 3');
  await expect(dialog).toContainText('L Stand Sol');
  await expect(dialog).toContainText('6,5 × 4,5 m · duvar 3 m');

  await dialog.getByRole('button', { name: 'Oluştur' }).click();
  await finishNameDialog(page, 'E2E Sihirbaz');
  await expect(page.locator('#stage-result')).toContainText('L Stand Sol · 650 × 450 cm');
  await expect(dialog).toBeHidden();
  expect(errors).toEqual([]);
});

test('wizard shows the size error on the step and close falls back to the sidebar card', async ({ page }) => {
  await page.goto('/');
  const dialog = wizard(page);
  await dialog.getByRole('button', { name: 'Ada Stand' }).click();
  await dialog.getByRole('button', { name: 'İleri →' }).click();
  await dialog.locator('#wizard-size-x').fill('0.55');
  await dialog.locator('#wizard-size-y').fill('4');
  await dialog.getByRole('button', { name: 'İleri →' }).click();
  await expect(dialog).toContainText('Adım 2 / 3');
  await expect(dialog.locator('.wizard-error')).toBeVisible();

  await dialog.getByRole('button', { name: 'Sihirbazı kapat' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('.viewport-empty-card')).toBeVisible();
});

test.describe('first-use tips', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('tips show once after the first stand and never again', async ({ page }) => {
    await page.goto('/');
    const dialog = wizard(page);
    await dialog.getByRole('button', { name: 'Ada Stand' }).click();
    await dialog.getByRole('button', { name: 'İleri →' }).click();
    await dialog.locator('#wizard-size-x').fill('5');
    await dialog.locator('#wizard-size-y').fill('5');
    await dialog.getByRole('button', { name: 'İleri →' }).click();
    await dialog.getByRole('button', { name: 'Oluştur' }).click();
    await finishNameDialog(page, 'E2E Ipucu');

    const tip = page.getByRole('status', { name: 'İpucu' });
    await expect(tip).toContainText('İpucu 1 / 3');
    await tip.getByRole('button', { name: 'Tamam' }).click();
    await expect(tip).toContainText('İpucu 2 / 3');
    await tip.getByRole('button', { name: 'Tamam' }).click();
    await tip.getByRole('button', { name: 'Bitir' }).click();
    await expect(tip).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('fairStandTipsSeen'))).toBe('1');

    await page.reload();
    const standSetup = page.locator('details.stand-setup-card');
    if (!(await standSetup.evaluate((el) => el.open))) await standSetup.locator('summary').click();
    await standSetup.getByRole('button', { name: 'Sırt Duvar' }).click();
    await page.locator('#stand-size-x').fill('5');
    await page.locator('#stand-size-y').fill('3');
    await page.locator('#create-stage').click();
    page.once('dialog', (confirm) => confirm.accept());
    await finishNameDialog(page, 'E2E Ipucu 2');
    await expect(page.getByRole('status', { name: 'İpucu' })).toBeHidden();
  });
});

test.describe('tablet', () => {
  test.use({ viewport: { width: 820, height: 1180 }, hasTouch: true });

  test('wizard works with taps on a tablet', async ({ page }) => {
    await page.goto('/');
    const dialog = wizard(page);
    await dialog.getByRole('button', { name: 'Sırt Duvar' }).tap();
    await dialog.getByRole('button', { name: 'İleri →' }).tap();
    await dialog.locator('#wizard-size-x').fill('4');
    await dialog.locator('#wizard-size-y').fill('3');
    await dialog.getByRole('button', { name: 'İleri →' }).tap();
    await dialog.getByRole('button', { name: 'Oluştur' }).tap();
    await finishNameDialog(page, 'E2E Sihirbaz Tablet');
    await expect(page.locator('#stage-result')).toContainText('Sırt Duvar · 400 × 300 cm');
  });
});

async function savedStandDepot(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('fair-stand-configurator', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const projects = await new Promise((resolve) => {
      const request = db.transaction('projects', 'readonly').objectStore('projects').getAll();
      request.onsuccess = () => resolve(request.result ?? []);
    });
    db.close();
    return projects.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0]?.stand?.depot ?? null;
  });
}

test('sidebar depot: "Depo yok" by default; picking a size enables contents and shows its note', async ({ page }) => {
  await page.goto('/');
  await wizard(page).getByRole('button', { name: 'Sihirbazı kapat' }).click();
  const standSetup = page.locator('details.stand-setup-card');
  if (!(await standSetup.evaluate((el) => el.open))) await standSetup.locator('summary').click();
  const size = page.locator('#auto-depot-size');
  const contents = page.locator('#auto-depot-contents');
  const hint = page.locator('#auto-depot-contents-hint');
  await expect(page.locator('#auto-depot-enabled')).toHaveCount(0);
  await expect(size).toHaveValue('');
  await expect(size.locator('option').first()).toHaveText('Depo yok');
  await expect(contents).toBeDisabled();
  await expect(hint).toBeHidden();

  await size.selectOption('200x200');
  await expect(contents).toBeEnabled();
  await expect(hint).toBeVisible();
  await contents.check();

  await size.selectOption('');
  await expect(contents).toBeDisabled();
  await expect(contents).not.toBeChecked();
  await expect(hint).toBeHidden();
});

test('wizard depot: the same list and contents box, mirrored to the sidebar and saved', async ({ page }) => {
  await page.goto('/');
  const dialog = wizard(page);
  await dialog.getByRole('button', { name: 'Ada Stand' }).click();
  await dialog.getByRole('button', { name: 'İleri →' }).click();
  await dialog.locator('#wizard-size-x').fill('6');
  await dialog.locator('#wizard-size-y').fill('6');
  const contents = dialog.locator('#wizard-depot-contents');
  await expect(dialog.locator('#wizard-depot-size')).toHaveValue('');
  await expect(contents).toBeDisabled();
  await dialog.locator('#wizard-depot-size').selectOption('150x100');
  await expect(contents).toBeEnabled();
  await expect(dialog).toContainText('Mini Buzdolabı + Kettle + Askılık + Çöp Kutusu');
  await contents.check();
  await expect(page.locator('#auto-depot-size')).toHaveValue('150x100');
  await expect(page.locator('#auto-depot-contents')).toBeChecked();

  await dialog.getByRole('button', { name: 'İleri →' }).click();
  await expect(dialog).toContainText('Depo: 1,5 × 1 m · içerikli');
  await dialog.getByRole('button', { name: 'Oluştur' }).click();
  await finishNameDialog(page, 'E2E Sihirbaz Depo');
  expect(await savedStandDepot(page)).toEqual(expect.objectContaining({ enabled: true, sizeKey: '150x100', includeContents: true }));
});

async function savedProject(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('fair-stand-configurator', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const projects = await new Promise((resolve) => {
      const request = db.transaction('projects', 'readonly').objectStore('projects').getAll();
      request.onsuccess = () => resolve(request.result ?? []);
    });
    db.close();
    return projects.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0] ?? null;
  });
}

for (const [rows, label, variant] of [['1', 'Tek sıra', 'short_1'], ['2', 'Çift sıra', 'short_2']]) {
  test(`wizard fascia (${label}): open edges get wall-short panels and the open corner an upright`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    const dialog = wizard(page);
    await dialog.getByRole('button', { name: 'L Stand Sol' }).click();
    await dialog.getByRole('button', { name: 'İleri →' }).click();
    await dialog.locator('#wizard-size-x').fill('3');
    await dialog.locator('#wizard-size-y').fill('3');
    const fascia = dialog.locator('#wizard-fascia');
    const fasciaRows = dialog.locator('#wizard-fascia-rows');
    await expect(fascia).not.toBeChecked();
    await expect(fasciaRows).toBeDisabled();
    await expect(page.locator('#auto-fascia-rows')).toHaveValue('');
    await fascia.check();
    await expect(fasciaRows).toBeEnabled();
    await fasciaRows.selectOption(rows);
    await expect(page.locator('#auto-fascia-rows')).toHaveValue(rows);

    await dialog.getByRole('button', { name: 'İleri →' }).click();
    await expect(dialog).toContainText(`Alınlık: ${label}`);
    await dialog.getByRole('button', { name: 'Oluştur' }).click();
    await finishNameDialog(page, `E2E Alınlık ${rows}`);

    const project = await savedProject(page);
    expect(project.stand.fascia).toEqual({ enabled: true, rows: Number(rows) });
    const fasciaModules = project.modules.filter((module) => module.autoFascia === true);
    const panels = fasciaModules.filter((module) => module.itemKey.includes(variant));
    const uprights = fasciaModules.filter((module) => module.type === 'upright');
    expect(panels.map((module) => module.itemKey).sort()).toEqual(
      [`wall_100_${variant}`, `wall_100_${variant}`, `wall_200_${variant}`, `wall_200_${variant}`],
    );
    expect(uprights.map((module) => [module.placement.xCm, module.placement.yCm])).toEqual([[300, 300]]);
    expect(fasciaModules).toHaveLength(5);
    expect(errors).toEqual([]);
  });
}

test('wizard fascia 800 × 800: each open 8 m edge gets a middle upright (max 5 m span) and one profile per span', async ({ page }) => {
  await page.goto('/');
  const dialog = wizard(page);
  await dialog.getByRole('button', { name: 'L Stand Sol' }).click();
  await dialog.getByRole('button', { name: 'İleri →' }).click();
  await dialog.locator('#wizard-size-x').fill('8');
  await dialog.locator('#wizard-size-y').fill('8');
  await dialog.locator('#wizard-fascia').check();
  await dialog.getByRole('button', { name: 'İleri →' }).click();
  await dialog.getByRole('button', { name: 'Oluştur' }).click();
  await finishNameDialog(page, 'E2E Alınlık 800');

  const project = await savedProject(page);
  const fasciaModules = project.modules.filter((module) => module.autoFascia === true);
  const uprights = fasciaModules
    .filter((module) => module.type === 'upright')
    .map((module) => [module.placement.xCm, module.placement.yCm]);
  expect(uprights).toEqual([[800, 400], [400, 800], [800, 800]]);
  const panels = fasciaModules.filter((module) => module.type !== 'upright');
  expect(panels.map((module) => module.itemKey)).toEqual(Array(8).fill('wall_200_short_1'));

  // Profil dikmeden dikmeye tek parça: 4 açıklık × 400 cm, üst ve alt ray → 8 × profile_388.
  await page.locator('#toggle-production-bom').click();
  const totals = page.locator('#production-bom-panel [data-bom-collapse-key="__totals__"]');
  await totals.locator('summary').click();
  await expect(totals.locator('li[data-item-key="profile_388"]')).toHaveText(/^8 × .* · adet$/);
  // profile_190 yalnız tam boy duvarlardan gelir; kısa panel başına 190'lar (16 adet daha) düşer.
  await expect(totals.locator('li[data-item-key="profile_190"]')).toHaveText(/^16 × .* · adet$/);
});

test('sol menü metre ve virgüllü giriş kullanır; kayıt cm kalır ve açılınca metre görünür', async ({ page }) => {
  await page.goto('/');
  await wizard(page).getByRole('button', { name: 'Sihirbazı kapat' }).click();
  const panel = page.locator('details.stand-setup-card');
  if (!(await panel.evaluate(element => element.open))) await panel.locator('summary').click();
  await panel.getByRole('button', { name: 'Ada Stand', exact: true }).click();
  await page.getByLabel('Genişlik (m)', { exact: true }).fill('6,5');
  await page.getByLabel('Derinlik (m)', { exact: true }).fill('4,5');
  await page.locator('#wall-height').selectOption('350');
  await expect(page.locator('#wall-height option:checked')).toHaveText('3,5 m');
  await page.locator('#create-stage').click();
  await finishNameDialog(page, 'Metre Girisi');
  const before = await savedProject(page);
  expect(before.stand.xCm).toBe(650);
  expect(before.stand.yCm).toBe(450);
  expect(before.stand.wallHeightCm).toBe(350);
  await page.reload();
  await expect(page.locator('#project-select option[value="' + before.id + '"]')).toHaveCount(1);
  await page.locator('#project-select').evaluate((select, id) => { select.value = id; }, before.id);
  await page.locator('#open-project').click();
  await expect(page.locator('#project-status')).toContainText('Açıldı:');
  await expect(page.locator('#stand-size-x')).toHaveValue('6,5');
  await expect(page.locator('#stand-size-y')).toHaveValue('4,5');
  await expect(page.locator('#wall-height option:checked')).toHaveText('3,5 m');
});
