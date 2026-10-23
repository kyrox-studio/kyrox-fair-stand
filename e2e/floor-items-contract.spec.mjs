import { test, expect } from '@playwright/test';

async function createIslandStand(page, projectName) {
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('5');
  await page.locator('#stand-size-y').fill('5');
  await page.locator('#create-stage').click();
  const projectNameInput = page.locator('form input[name="projectName"]');
  await expect(projectNameInput).toBeVisible();
  await projectNameInput.fill(projectName);
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
}

async function saveAndReadProject(page) {
  const saveButton = page.locator('#save-project');
  await saveButton.click();
  await expect(saveButton).toBeEnabled();
  return page.evaluate(async () => {
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
    return projects.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0] ?? null;
  });
}

const floors = [
  { itemKey: 'karolaj', label: 'Karolaj · 100 × 100 cm' },
  { itemKey: 'hali', label: 'Halı' },
  { itemKey: 'parke-acik', label: 'Beyaz Meşe' },
  { itemKey: 'parke-sari', label: 'Sarı Meşe' },
  { itemKey: 'parke-beton', label: 'Beton Parke' },
];

test('floor select options match canonical floor Items', async ({ page }) => {
  await page.goto('/');
  const options = page.locator('#floor-type option');
  await expect(options).toHaveCount(5);
  await expect(options).toHaveText(floors.map((floor) => floor.label));
  for (const [index, floor] of floors.entries()) {
    await expect(options.nth(index)).toHaveAttribute('value', floor.itemKey);
  }
  await expect(page.locator(`.module-drag-card[data-module-key="karolaj"]`)).toHaveCount(0);
});

test('parke-beton stand.itemKey persists as the floor Item key', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await createIslandStand(page, 'parke-beton');
  await page.locator('#floor-type').selectOption('parke-beton');
  const project = await saveAndReadProject(page);
  expect(project.stand.itemKey).toBe('parke-beton');
  expect(project.modules.some((module) => module.itemKey === 'parke-beton')).toBe(false);
  expect(errors).toEqual([]);
});
