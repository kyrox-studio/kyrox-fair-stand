import { test, expect } from '@playwright/test';

async function createIslandProject(page, { baseName, xCm, yCm, confirmExisting = false }) {
  const standSetup = page.locator('details.stand-setup-card');
  const isOpen = await standSetup.evaluate((element) => element.open);
  if (!isOpen) await standSetup.locator('summary').click();

  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill(String(xCm / 100));
  await page.locator('#stand-size-y').fill(String(yCm / 100));

  if (confirmExisting) {
    page.once('dialog', async (dialog) => dialog.accept());
  }

  await page.locator('#create-stage').click();
  const nameInput = page.locator('form input[name="projectName"]');
  await expect(nameInput).toBeVisible();
  await nameInput.fill(baseName);
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();

  await expect(page.locator('#project-status')).toContainText('Oluşturuldu ve kaydedildi');
  return page.locator('#project-name-display').textContent();
}

async function switchProject(page, projectName) {
  page.once('dialog', async (dialog) => dialog.accept());
  await page.locator('#project-select').evaluate((select, name) => {
    const option = [...select.options].find((item) => item.textContent === name);
    if (!option) throw new Error(`Project option not found: ${name}`);
    select.value = option.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }, projectName);
  await expect(page.locator('#project-name-display')).toHaveText(projectName);
}

test('pending edit is saved before project switch cancels the autosave timer', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');

  const projectA = await createIslandProject(page, {
    baseName: 'F020 A',
    xCm: 500,
    yCm: 500,
  });
  const projectB = await createIslandProject(page, {
    baseName: 'F020 B',
    xCm: 600,
    yCm: 500,
    confirmExisting: true,
  });

  await switchProject(page, projectA);

  await page.locator('#floor-type').selectOption('hali');
  await expect(page.locator('#project-status')).toContainText('3 dk içinde otomatik kaydedilecek');

  await switchProject(page, projectB);

  const storedFloorType = await page.evaluate(async (projectName) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('fair-stand-configurator', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const projects = await new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readonly');
      const request = tx.objectStore('projects').getAll();
      request.onsuccess = () => resolve(request.result ?? []);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return projects.find((project) => project.name === projectName)?.stand?.itemKey ?? null;
  }, projectA);

  expect(storedFloorType).toBe('hali');
  expect(pageErrors).toEqual([]);
});
