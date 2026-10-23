import { openEditorSettings } from './helpers/editorSettings.mjs';
import { test, expect } from '@playwright/test';

// Proje görselleri: ilk açılışta en fazla 6'şar iner ve yükleme ekranı ilerleme yazar;
// ikinci açılışta tarayıcıdaki kopya güncel olduğu için hiçbiri yeniden indirilmez.
const ORG_ID = '11111111-1111-4111-8111-111111111111';
const CUSTOMER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ASSET_COUNT = 9;
const ASSET_DELAY_MS = 300;
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const ASSETS = Array.from({ length: ASSET_COUNT }, (_, index) => {
  const id = `cccccccc-cccc-4ccc-8ccc-${String(index).padStart(12, '0')}`;
  return {
    id,
    name: `gorsel-${index}.png`,
    type: 'image/png',
    byteSize: PNG.length,
    storageKey: `${ORG_ID}/proje/${id}.png`,
    createdAt: 1700000000000 + index,
  };
});

function detail(store) {
  const payload = store.project.payload || { stand: null, modules: [] };
  return { ...store.project, stand: payload.stand, modules: payload.modules || [], revisions: [] };
}

test('project images download six at a time once, then come from the browser copy', async ({ page }) => {
  test.setTimeout(90_000);
  const store = { project: null, assetGets: 0, inFlight: 0, peakInFlight: 0 };

  await page.addInitScript((orgId) => {
    globalThis.__FAIR_STAND_CATALOG_HEADERS__ = {
      Authorization: 'Bearer e2e-asset-cache',
      'X-Organization-Id': orgId,
    };
  }, ORG_ID);

  await page.route('**/api/v1/fair-stand/projects**', async (route) => {
    const request = route.request();
    const parts = new URL(request.url()).pathname.split('/').filter(Boolean);
    const method = request.method();
    if (method === 'GET' && parts.at(-2) === 'assets') {
      store.assetGets += 1;
      store.inFlight += 1;
      store.peakInFlight = Math.max(store.peakInFlight, store.inFlight);
      await new Promise((resolve) => setTimeout(resolve, ASSET_DELAY_MS));
      store.inFlight -= 1;
      await route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
      return;
    }
    if (method === 'POST' && parts.at(-1) === 'assets') {
      await route.fulfill({ json: { id: 'uploaded' } });
      return;
    }
    if (method === 'PUT') {
      const body = request.postDataJSON();
      const now = Date.now();
      store.project = {
        id: parts.at(-1),
        organizationId: ORG_ID,
        name: body.name,
        customerId: body.customerId || CUSTOMER_ID,
        version: body.version || 1,
        createdAt: store.project?.createdAt || now,
        updatedAt: now,
        createdBy: null,
        payload: body.payload,
        assets: store.project?.assets || [],
      };
      await route.fulfill({ json: detail(store) });
      return;
    }
    if (method === 'GET') {
      if (!store.project) {
        await route.fulfill({ status: 404, json: { detail: 'Project not found' } });
        return;
      }
      await route.fulfill({ json: detail(store) });
      return;
    }
    await route.fulfill({ status: 204, body: '' });
  });

  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('5');
  await page.locator('#stand-size-y').fill('5');
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill('OnbellekGorsel');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  await openEditorSettings(page);
  await page.locator('#autosave-interval').selectOption('0');
  await page.locator('#save-project').click();
  await expect(page.locator('#project-status')).toContainText('Kaydedildi:');
  // Sunucudaki proje 9 görsel taşır.
  store.project.assets = ASSETS;

  const openProject = async () => {
    await page.reload();
    await expect(page.locator('#viewport-empty')).toBeVisible();
    const projectSelect = page.locator('#project-select');
    const projectId = await projectSelect.locator('option', { hasText: 'OnbellekGorsel' }).getAttribute('value');
    await projectSelect.evaluate((select, id) => { select.value = id; }, projectId);
    await page.locator('#open-project').click();
  };

  // 1. açılış: hepsi iner, en fazla 6 aynı anda; ekran ilerleme yazar.
  await openProject();
  await expect(page.locator('#project-loading-detail')).toHaveText(/Görseller indiriliyor… \d+ \/ 9/);
  await expect(page.locator('#project-status')).toContainText('Açıldı:', { timeout: 30_000 });
  expect(store.assetGets).toBe(ASSET_COUNT);
  expect(store.peakInFlight).toBeGreaterThan(1);
  expect(store.peakInFlight).toBeLessThanOrEqual(6);

  // 2. açılış: tarayıcıdaki kopya güncel; hiç görsel isteği yok.
  store.assetGets = 0;
  await openProject();
  await expect(page.locator('#project-status')).toContainText('Açıldı:', { timeout: 30_000 });
  expect(store.assetGets).toBe(0);

  // Sunucuda bir görsel değişirse (anahtar değişti) yalnız o yeniden iner.
  store.project.assets = ASSETS.map((asset, index) => (index === 0
    ? { ...asset, storageKey: asset.storageKey.replace('.png', '.webp') }
    : asset));
  await openProject();
  await expect(page.locator('#project-status')).toContainText('Açıldı:', { timeout: 30_000 });
  expect(store.assetGets).toBe(1);
});
