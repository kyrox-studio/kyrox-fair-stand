import { test, expect } from '@playwright/test';

// Oturumsuz demo (ADR-0012). Demo uçları sunucuda; burada sunucunun cevabı taklit edilir:
// süzülmüş katalog = E2E kataloğu (BOM alanları çıkarılmış), süre cevabı sabit.
const LOGIN_MESSAGE = 'Demo sayfasında bu işlem için oturum açmanız gerekiyor.';
const BOM_NOTICE = 'Demo görüntülemede gerçek Üretim Listesi görülemez.';

async function routeDemo(page, request, { remainingSeconds = 1500, heartbeatStatus = 200 } = {}) {
  const forbidden = [];
  const catalogCalls = [];
  const catalog = await (await request.get('/api/v1/fair-stand/catalog/bootstrap')).json();
  const demoCatalog = {
    ...catalog,
    items: catalog.items.map(({ lengthParts: _lengthParts, isCostEnabled: _cost, ...item }) => item),
    settings: { ...catalog.settings, exportButtonVisible: true, importButtonVisible: true, saveAsButtonVisible: true },
  };
  const state = { heartbeatStatus };
  await page.route('**/api/v1/fair-stand/demo/session', (route) => route.fulfill({
    json: { remainingSeconds, limitSeconds: 1500, heartbeatSeconds: 30 },
  }));
  await page.route('**/api/v1/fair-stand/demo/heartbeat', (route) => (state.heartbeatStatus === 200
    ? route.fulfill({ json: { remainingSeconds: 1400, limitSeconds: 1500, heartbeatSeconds: 30 } })
    : route.fulfill({ status: state.heartbeatStatus, json: { detail: 'demo_expired' } })));
  await page.route('**/api/v1/fair-stand/demo/catalog/bootstrap', (route) => {
    catalogCalls.push(route.request().url());
    return route.fulfill({ json: demoCatalog });
  });
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/v1/fair-stand/demo/')) {
      forbidden.push(url.pathname);
    }
  });
  return { forbidden, catalogCalls, state };
}

async function buildDemoStage(page) {
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Sırt Duvar' }).click();
  await page.locator('#stand-size-x').fill('5');
  await page.locator('#stand-size-y').fill('4');
  await page.locator('#create-stage').click();
  // Demo ad sormaz ve kaydetmez.
  await expect(page.locator('form input[name="projectName"]')).toHaveCount(0);
  await expect(page.locator('#project-status')).toHaveText('Demo: sahne kuruldu. Demo sayfasında proje kaydedilmez.');
  const keep = page.locator('.wall-lock-notice [data-wall-lock-choice="keep"]');
  if (await keep.count()) await keep.click();
}

test('demo: kilitli düğmeler oturum mesajı verir, Üretim Listesi örnek gösterir', async ({ page, request }) => {
  const { forbidden, catalogCalls } = await routeDemo(page, request);
  await page.goto('/e2e/demo-host.html');

  await expect(page.locator('#fair-stand-demo-chip')).toContainText('Demo · kalan süre 2');
  await expect(page.locator('#fair-stand-demo-watermark')).toHaveText('DEMO');
  await expect(page.locator('#project-customer-display')).toHaveText('Demo');
  await expect(page.locator('#autosave-interval')).toBeDisabled();
  await expect(page.locator('#autosave-interval')).toHaveValue('0');

  await buildDemoStage(page);
  await expect(page.locator('#project-revisions')).toBeHidden();

  const locked = [
    '#save-project', '#save-as-project', '#open-project', '#export-project', '#import-project',
    '#delete-project', '#render-current-view', '#live-share-start', '#rename-project',
  ];
  const toast = page.locator('.toast', { hasText: LOGIN_MESSAGE });
  for (const selector of locked) {
    if (await toast.count()) await toast.locator('.toast__close').click();
    await expect(toast).toHaveCount(0);
    await page.locator(selector).click();
    await expect(toast, selector).toHaveCount(1);
  }
  await expect(page.locator('#live-share-popover')).toBeHidden();

  // Gelişmiş mod açık kalır.
  await page.locator('#editor-mode-advanced').click();
  await expect(page.locator('#editor-mode-advanced')).toHaveAttribute('aria-pressed', 'true');

  await page.locator('#toggle-production-bom').click();
  const panel = page.locator('#production-bom-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('[data-role="bom-demo-notice"]')).toHaveText(BOM_NOTICE);
  await expect(panel.locator('li')).toHaveCount(8);
  await expect(panel.locator('[data-role="bom-download"]')).toHaveCount(0);

  expect(catalogCalls).toHaveLength(1);
  expect(forbidden.filter((path) => path.startsWith('/api/v1/fair-stand/'))).toEqual([]);
});

test('demo: sinyal 403 dönünce kilit ekranı çıkar', async ({ page, request }) => {
  const { state } = await routeDemo(page, request);
  await page.goto('/e2e/demo-host.html');
  await expect(page.locator('#fair-stand-demo-chip')).toBeVisible();
  state.heartbeatStatus = 403;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  const overlay = page.locator('#fair-stand-demo-expired');
  await expect(overlay).toBeVisible();
  await expect(overlay).toContainText('Demo süreniz doldu');
  await expect(overlay.getByRole('link', { name: 'Oturum aç' })).toHaveAttribute('href', '/login');
});

test('demo: süre bitmişse katalog istenmez, editör açılmaz', async ({ page, request }) => {
  const { catalogCalls } = await routeDemo(page, request, { remainingSeconds: 0 });
  await page.goto('/e2e/demo-host.html');
  await expect(page.locator('#fair-stand-demo-expired')).toBeVisible();
  await expect(page.locator('#viewport canvas')).toHaveCount(0);
  expect(catalogCalls).toHaveLength(0);
});
