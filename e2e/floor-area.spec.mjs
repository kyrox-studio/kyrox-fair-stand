import { inflateSync } from 'node:zlib';
import { expect, test } from '@playwright/test';

function paeth(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  if (upDistance <= upLeftDistance) return up;
  return upLeft;
}

function decodePng(buffer) {
  const bytes = Buffer.from(buffer);
  let width = 0;
  let height = 0;
  let colorType = 6;
  const chunks = [];
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === 'IDAT') {
      chunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  const bpp = colorType === 6 ? 4 : 3;
  const inflated = inflateSync(Buffer.concat(chunks));
  const stride = width * bpp;
  const rows = [];
  let cursor = 0;
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[cursor];
    cursor += 1;
    const row = Buffer.from(inflated.subarray(cursor, cursor + stride));
    cursor += stride;
    for (let index = 0; index < row.length; index += 1) {
      const left = index >= bpp ? row[index - bpp] : 0;
      const up = previous[index];
      const upLeft = index >= bpp ? previous[index - bpp] : 0;
      if (filter === 1) row[index] = (row[index] + left) & 255;
      else if (filter === 2) row[index] = (row[index] + up) & 255;
      else if (filter === 3) row[index] = (row[index] + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) row[index] = (row[index] + paeth(left, up, upLeft)) & 255;
    }
    rows.push(row);
    previous = row;
  }
  return { width, height, bpp, rows };
}

function changedPixelRatio(before, after) {
  const width = Math.min(before.width, after.width);
  const height = Math.min(before.height, after.height);
  let changed = 0;
  let total = 0;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const left = x * before.bpp;
      const right = x * after.bpp;
      const distance = Math.abs(before.rows[y][left] - after.rows[y][right])
        + Math.abs(before.rows[y][left + 1] - after.rows[y][right + 1])
        + Math.abs(before.rows[y][left + 2] - after.rows[y][right + 2]);
      total += 1;
      if (distance > 36) changed += 1;
    }
  }
  return changed / total;
}

async function createIslandStand(page, projectName) {
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('5');
  await page.locator('#stand-size-y').fill('5');
  await page.locator('#floor-type').selectOption('hali');
  await page.locator('#create-stage').click();
  const projectNameInput = page.locator('form input[name="projectName"]');
  await expect(projectNameInput).toBeVisible();
  await projectNameInput.fill(projectName);
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  await expect(page.locator('#viewport > canvas')).toHaveCount(1);
}

async function saveAndReadProject(page) {
  const saveButton = page.locator('#save-project');
  await saveButton.click();
  await expect(page.locator('#project-status')).toContainText('Kaydedildi:');
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

test('baz halıya tek dikdörtgen karolaj eklenir, sahnede görünür ve kayıtta kalır', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await createIslandStand(page, 'Floor Split V1');

  const canvas = page.locator('#viewport > canvas');
  const before = decodePng(await canvas.screenshot());

  await expect(page.locator('#floor-area-controls')).toBeVisible();
  await page.locator('#floor-area-add').click();
  await page.locator('#floor-area-type').selectOption('karolaj');
  await page.locator('#floor-area-x').fill('100');
  await page.locator('#floor-area-y').fill('100');
  await page.locator('#floor-area-width').fill('200');
  await page.locator('#floor-area-width').blur();
  await page.locator('#floor-area-depth').fill('300');
  await page.locator('#floor-area-depth').blur();

  await expect(page.locator('#floor-area-status')).toContainText('100,100');
  await expect(page.locator('#floor-area-status')).toContainText('200×300');
  await expect(page.locator('#floor-type')).toHaveValue('hali');
  await expect(page.locator('#floor-area-type')).toHaveValue('karolaj');

  const after = decodePng(await canvas.screenshot());
  expect(changedPixelRatio(before, after)).toBeGreaterThan(0.02);

  await page.locator('#floor-area-width').evaluate((input) => {
    input.value = '430';
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.locator('#floor-area-status')).toContainText('50 cm');
  await expect(page.locator('#floor-area-width')).toHaveValue('200');

  const saved = await saveAndReadProject(page);
  expect(saved.stand.itemKey).toBe('hali');
  expect(saved.stand.floorArea).toEqual({
    xCm: 100,
    yCm: 100,
    widthCm: 200,
    depthCm: 300,
    itemKey: 'karolaj',
    color: null,
  });
  expect(saved.modules.some((module) => module.itemKey === 'karolaj' || module.itemKey === 'hali')).toBe(false);

  await page.reload();
  await expect(page.locator('#viewport-empty')).toBeVisible();
  const projectSelect = page.locator('#project-select');
  await expect(projectSelect.locator(`option[value="${saved.id}"]`)).toHaveCount(1);
  await projectSelect.evaluate((select, id) => {
    select.value = id;
  }, saved.id);
  await page.locator('#open-project').click();
  await expect(page.locator('#project-status')).toContainText('Açıldı:');
  await expect(page.locator('#floor-type')).toHaveValue('hali');
  await expect(page.locator('#floor-area-x')).toHaveValue('100');
  await expect(page.locator('#floor-area-y')).toHaveValue('100');
  await expect(page.locator('#floor-area-width')).toHaveValue('200');
  await expect(page.locator('#floor-area-depth')).toHaveValue('300');
  await expect(page.locator('#floor-area-type')).toHaveValue('karolaj');
  expect(errors).toEqual([]);
});
