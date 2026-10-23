import { test, expect } from '@playwright/test';

const SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 50"><rect width="200" height="50" fill="#e11d48"/></svg>',
  'utf8',
);

async function createStand(page, standName, projectName) {
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: standName }).click();
  await page.locator('#stand-size-x').fill('5');
  await page.locator('#stand-size-y').fill('5');
  await page.locator('#create-stage').click();
  const projectNameInput = page.locator('form input[name="projectName"]');
  await expect(projectNameInput).toBeVisible();
  await projectNameInput.fill(projectName);
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
}

async function startFoamPlacement(page, { widthCm = '100', heightCm = '25' } = {}) {
  const panel = page.locator('details', { has: page.locator('#apply-color') });
  if (!(await panel.getAttribute('open'))) {
    await panel.locator(':scope > summary').click();
  }
  await page.locator('#surface-image').setInputFiles({
    name: 'e2e-logo.svg',
    mimeType: 'image/svg+xml',
    buffer: SVG,
  });
  const tile = page.locator('button.asset-tile', { hasText: 'e2e-logo.svg' });
  await expect(tile).toBeVisible();
  await tile.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Işıklı Strafora Dönüştür' }).click();
  const dialog = page.getByRole('dialog', { name: 'Işıklı Strafor Ölçüsü' });
  await expect(dialog).toBeVisible();
  await dialog.locator('input[name="width"]').fill(widthCm);
  await dialog.locator('input[name="height"]').fill(heightCm);
  await dialog.getByRole('button', { name: 'Yerleştir' }).click();
  await expect(page.locator('#asset-status')).toContainText('Işıklı Strafor hazır');
}

async function viewportPoint(page, ratioX, ratioY) {
  const box = await page.locator('#viewport').boundingBox();
  expect(box).not.toBeNull();
  return {
    x: box.x + Math.round(box.width * ratioX),
    y: box.y + Math.round(box.height * ratioY),
  };
}

// Straforun ön yüzü SVG'nin kırmızı rengindedir; ekran görüntüsünde bu piksellerin merkezini bulur.
// Sağ üstteki view-cube'un kırmızı kenarı sayılmasın diye yatayda yalnız ilk %75 taranır.
async function findFoamScreenPoint(page) {
  const viewport = page.locator('#viewport');
  const box = await viewport.boundingBox();
  expect(box).not.toBeNull();
  const png = (await viewport.screenshot()).toString('base64');
  const center = await page.evaluate(async (base64) => {
    const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0);
    const { data, width, height } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width * 0.75; x += 2) {
        const index = (y * width + x) * 4;
        const [r, g, b] = [data[index], data[index + 1], data[index + 2]];
        if (r > 170 && g < 90 && b > 40 && b < 130) {
          sumX += x;
          sumY += y;
          count += 1;
        }
      }
    }
    return count > 50 ? { x: sumX / count / width, y: sumY / count / height } : null;
  }, png);
  if (!center) return null;
  return {
    x: box.x + Math.round(box.width * center.x),
    y: box.y + Math.round(box.height * center.y),
  };
}

test('Işıklı Strafor stand dışına götürülünce uyarı TV değil kendi adını gösterir', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await createStand(page, 'Ada Stand', 'E2E Foam Feedback');
  await startFoamPlacement(page);

  // Görüş alanının üst kenarı zemin dışında kalır; serbest yerleşim için zemin noktası yoktur.
  const sky = await viewportPoint(page, 0.5, 0.03);
  await page.mouse.move(sky.x - 40, sky.y);
  await page.mouse.move(sky.x, sky.y, { steps: 6 });

  await expect(page.getByText('Işıklı Strafor / Logo: aktif stand alanına bırak.')).toBeVisible();
  await expect(page.getByText(/TV'yi aktif stand alan/)).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('sahnedeki Işıklı Strafor stand dışına sürüklenince uyarı TV değil kendi adını gösterir', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  // Ada standında arkada duvar yoktur; tutma noktası doğrudan straforu seçer.
  await createStand(page, 'Ada Stand', 'E2E Foam Drag Feedback');
  // Ev görünümünde aktif zemin görüş alanının ortasındadır.
  await page.locator('.view-cube-home').click();
  await startFoamPlacement(page, { widthCm: '200', heightCm: '80' });

  const drop = await viewportPoint(page, 0.5, 0.65);
  await page.mouse.move(drop.x - 30, drop.y);
  await page.mouse.move(drop.x, drop.y, { steps: 6 });
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.locator('#asset-status')).toContainText('Işıklı Strafor sahneye eklendi');

  // SVG yüzü asenkron yüklenir; kamera oynatılmadan strafor kendiliğinden çizilmelidir.
  let grab = null;
  await expect.poll(async () => {
    grab = await findFoamScreenPoint(page);
    return grab !== null;
  }, { timeout: 10000 }).toBe(true);
  // Görüş alanının üst kenarı aktif zeminin dışındadır; ada standında duvar düzlemi yoktur.
  const outside = await viewportPoint(page, 0.5, 0.03);
  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  await page.mouse.move(outside.x, outside.y, { steps: 16 });

  await expect(page.getByText('Işıklı Strafor / Logo: aktif stand alanında sürükle.')).toBeVisible();
  await expect(page.locator('[data-role="label"]')).toHaveText('Işıklı Strafor / Logo');
  await expect(page.getByText(/TV'yi aktif stand alan/)).toHaveCount(0);
  await page.mouse.up();
  expect(pageErrors).toEqual([]);
});

test('sırt duvarına bırakılan Işıklı Strafor kamera oynatılmadan çizilir ve tutulunca kendisi sürüklenir', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await createStand(page, 'Sırt Duvar', 'E2E Foam Wall Render');
  // Ev görünümünde sırt duvarı görüş alanının sağ üst yarısındadır.
  await page.locator('.view-cube-home').click();
  await page.waitForTimeout(1200);
  await startFoamPlacement(page, { widthCm: '100', heightCm: '40' });

  const drop = await viewportPoint(page, 0.64, 0.42);
  await page.mouse.move(drop.x - 30, drop.y);
  await page.mouse.move(drop.x, drop.y, { steps: 6 });
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.locator('#asset-status')).toContainText('Işıklı Strafor sahneye eklendi');

  let grab = null;
  await expect.poll(async () => {
    grab = await findFoamScreenPoint(page);
    return grab !== null;
  }, { timeout: 10000 }).toBe(true);

  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  await page.mouse.move(grab.x + 12, grab.y + 4, { steps: 4 });
  await expect(page.locator('[data-role="label"]')).toHaveText('Işıklı Strafor / Logo');
  await page.mouse.up();
  expect(pageErrors).toEqual([]);
});
