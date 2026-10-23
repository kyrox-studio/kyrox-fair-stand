import { test, expect } from '@playwright/test';

async function readProjects(page) {
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
    return projects;
  });
}

test('Sahneyi Sıfırla rebuilds from the visible setup controls without creating a new project', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  const setupCard = page.locator('details.stand-setup-card');
  await setupCard.locator('summary').click();

  await setupCard.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('5');
  await page.locator('#stand-size-y').fill('5');
  await page.locator('#create-stage').click();

  const nameInput = page.locator('form input[name="projectName"]');
  await nameInput.fill('F027 Reset');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#stage-result')).toContainText('Ada Stand · 500 × 500 cm');

  await setupCard.getByRole('button', { name: 'L Stand Sol' }).click();
  await page.locator('#stand-size-x').fill('9');
  await page.locator('#stand-size-y').fill('3');
  await page.locator('#floor-type').selectOption('hali');
  await page.locator('#auto-depot-size').selectOption('200x200');
  await page.locator('#auto-depot-contents').check();

  await expect(page.locator('#clear-wall')).toHaveText('Sahneyi Sıfırla');
  await page.locator('#clear-wall').evaluate((button) => button.click());
  await expect(page.locator('#stage-result')).toContainText('L Stand Sol · 900 × 300 cm');

  await page.locator('#save-project').click();
  await expect(page.locator('#project-status')).toContainText('Kaydedildi:');

  const projects = await readProjects(page);
  expect(projects).toHaveLength(1);
  const project = projects[0];
  expect(project.stand.standType).toBe('l-left');
  expect(project.stand.xCm).toBe(900);
  expect(project.stand.yCm).toBe(300);
  expect(project.stand.itemKey).toBe('hali');
  expect(project.stand.depot).toEqual({
    enabled: true,
    sizeKey: '200x200',
    includeContents: true,
  });
  const moduleTypes = project.modules.map((module) => module.type);
  expect(moduleTypes).toContain('mini-fridge');
  expect(moduleTypes).toContain('kettle');
  expect(moduleTypes).toContain('coat-rack');
  expect(moduleTypes).toContain('plastic-trash-bin');
  expect(pageErrors).toEqual([]);
});
