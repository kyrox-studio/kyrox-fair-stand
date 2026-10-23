import { test, expect } from '@playwright/test';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const CUSTOMER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

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

test('aynı oturum Kaydet tek revizyon tutar; yeniden açılış sonraki numarayı ayırır', async ({ page }) => {
  test.setTimeout(60_000);
  const store = {
    project: null,
    revisions: [],
    creates: 0,
    updates: 0,
  };
  let pauseRevisionGet = null;
  let pauseProjectGet = null;

  await page.addInitScript(() => {
    globalThis.__FAIR_STAND_CATALOG_HEADERS__ = {
      Authorization: 'Bearer e2e-revision-session',
      'X-Organization-Id': '11111111-1111-4111-8111-111111111111',
    };
  });

  await page.route('**/api/v1/fair-stand/projects**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const parts = url.pathname.split('/').filter(Boolean);
    const method = request.method();

    if (method === 'GET' && parts.at(-2) === 'revisions') {
      if (pauseRevisionGet) await pauseRevisionGet;
      const number = Number(parts.at(-1));
      const revision = store.revisions.find((item) => item.revisionNumber === number);
      if (!revision) {
        await route.fulfill({ status: 404, json: { detail: 'Revision not found' } });
        return;
      }
      await route.fulfill({
        json: {
          ...revision,
          stand: revision.payload.stand,
          modules: revision.payload.modules,
        },
      });
      return;
    }

    if (method === 'PUT') {
      const body = request.postDataJSON();
      const projectId = parts.at(-1);
      const now = Date.now();
      if (!store.project) {
        store.project = {
          id: projectId,
          organizationId: ORG_ID,
          name: body.name,
          customerId: body.customerId || CUSTOMER_ID,
          version: body.version || 1,
          createdAt: now,
          updatedAt: now,
          createdBy: null,
          payload: body.payload,
          assets: [],
        };
      } else {
        store.project.name = body.name;
        store.project.version = body.version || 1;
        store.project.payload = body.payload;
        store.project.updatedAt = now;
      }
      if (body.revisionMode === 'create') {
        store.creates += 1;
        const next = (store.revisions.at(-1)?.revisionNumber || 0) + 1;
        store.revisions.push({
          revisionNumber: next,
          createdAt: now,
          updatedAt: now,
          payload: body.payload,
        });
        if (store.revisions.length > 3) store.revisions.shift();
      } else if (body.revisionMode === 'update') {
        store.updates += 1;
        const current = store.revisions.at(-1);
        if (current && current.revisionNumber === body.revisionNumber) {
          current.payload = body.payload;
          current.updatedAt = now;
        }
      }
      await route.fulfill({ json: detail(store) });
      return;
    }

    if (method === 'GET') {
      if (pauseProjectGet) await pauseProjectGet;
      if (!store.project) {
        await route.fulfill({ status: 404, json: { detail: 'Project not found' } });
        return;
      }
      await route.fulfill({ json: detail(store) });
      return;
    }

    await route.fulfill({ status: 204, body: '' });
  });

  await createIslandStand(page, 'E2ESessionRevision');
  await expect(page.locator('#project-revision-list')).toContainText('R1');
  await expect(page.locator('#project-name')).toHaveValue('E2ESessionRevision-Ada_500_500');
  await expect(page.locator('#project-name-display')).toHaveText('E2ESessionRevision-Ada_500_500 - R1');
  await expect(page.locator('#project-revision-list button[aria-current="true"]')).toHaveText(/^R1 · /);
  expect(store.creates).toBe(1);

  for (let index = 0; index < 3; index += 1) {
    await page.locator('#save-project').click();
    await expect(page.locator('#project-status')).toContainText('Kaydedildi:');
  }
  await expect(page.locator('#project-revision-list button')).toHaveCount(1);
  await expect(page.locator('#project-name-display')).toHaveText('E2ESessionRevision-Ada_500_500 - R1');
  await expect(page.locator('#project-name')).toHaveValue('E2ESessionRevision-Ada_500_500');
  expect(store.creates).toBe(1);
  expect(store.updates).toBeGreaterThanOrEqual(3);

  await page.reload();
  await expect(page.locator('#viewport-empty')).toBeVisible();
  const projectSelect = page.locator('#project-select');
  await expect(projectSelect.locator('option', { hasText: 'E2ESessionRevision' })).toHaveCount(1);
  const projectId = await projectSelect.locator('option', { hasText: 'E2ESessionRevision' }).getAttribute('value');
  await projectSelect.evaluate((select, id) => {
    select.value = id;
  }, projectId);
  await page.locator('#open-project').click();
  await expect(page.locator('#project-status')).toContainText('Açıldı:');
  expect(store.creates).toBe(1);

  await page.locator('#floor-type').evaluate((select) => {
    const next = [...select.options].find((option) => option.value !== select.value);
    select.value = next.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.locator('#save-project').click();
  await expect(page.locator('#project-revision-list')).toContainText('R2');
  await expect(page.locator('#project-name-display')).toHaveText('E2ESessionRevision-Ada_500_500 - R2');
  await expect(page.locator('#project-revision-list button[aria-current="true"]')).toHaveText(/^R2 · /);
  await page.locator('#save-project').click();
  await expect(page.locator('#project-name-display')).toHaveText('E2ESessionRevision-Ada_500_500 - R2');
  expect(store.creates).toBe(2);
  expect(store.revisions.map((item) => item.revisionNumber)).toEqual([1, 2]);
  await expect(page.locator('#project-revision-live')).toHaveCount(0);

  let releaseRevision;
  pauseRevisionGet = new Promise((resolve) => { releaseRevision = resolve; });
  const openR1 = page.locator('#project-revision-list button[data-revision-number="1"]').click();
  await expect(page.locator('#project-loading-overlay')).toBeVisible();
  await expect(page.locator('#project-loading-title')).toHaveText('R1 yükleniyor…');
  releaseRevision();
  pauseRevisionGet = null;
  await openR1;
  await expect(page.locator('#project-loading-overlay')).toBeHidden();
  await expect(page.locator('#project-status')).toContainText('Geçmiş revizyon R1');
  await expect(page.locator('#project-name-display')).toHaveText('E2ESessionRevision-Ada_500_500 - R1');
  await expect(page.locator('#project-revision-list button[aria-current="true"]')).toHaveText(/^R1 · /);
  expect(store.creates).toBe(2);

  let releaseLive;
  pauseProjectGet = new Promise((resolve) => { releaseLive = resolve; });
  const openLatest = page.locator('#project-revision-list button[data-revision-number="2"]').click();
  await expect(page.locator('#project-loading-overlay')).toBeVisible();
  await expect(page.locator('#project-loading-title')).toHaveText('R2 yükleniyor…');
  releaseLive();
  pauseProjectGet = null;
  await openLatest;
  await expect(page.locator('#project-loading-overlay')).toBeHidden();
  await expect(page.locator('#project-status')).toContainText('Açıldı:');
  await expect(page.locator('#project-name-display')).toHaveText('E2ESessionRevision-Ada_500_500 - R2');
  await expect(page.locator('#project-revision-list button[aria-current="true"]')).toHaveText(/^R2 · /);
  expect(store.creates).toBe(2);
});

function detail(store) {
  const payload = store.project.payload || { stand: null, modules: [] };
  return {
    ...store.project,
    stand: payload.stand,
    modules: payload.modules || [],
    revisions: [...store.revisions].reverse().map((revision) => ({
      revisionNumber: revision.revisionNumber,
      createdAt: revision.createdAt,
      updatedAt: revision.updatedAt,
    })),
  };
}
