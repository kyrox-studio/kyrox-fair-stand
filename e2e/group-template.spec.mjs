import { openEditorSettings } from './helpers/editorSettings.mjs';
import { test, expect } from '@playwright/test';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const CUSTOMER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

async function exposeScene(page) {
  await page.route('**/src/scene3d.js*', async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace(
        'const controls = new OrbitControls(camera, renderer.domElement);',
        'const controls = new OrbitControls(camera, renderer.domElement); window.__sceneCamera = camera;',
      )
      .replace(
        '  let surfaceMeshes = [];',
        '  let surfaceMeshes = []; window.__sceneSurfaces = () => surfaceMeshes;',
      );
    await route.fulfill({ response, body });
  });
}

function projectDetail(store) {
  const payload = store.project.payload || { stand: null, modules: [] };
  return { ...store.project, stand: payload.stand, modules: payload.modules || [], revisions: [] };
}

// Sahte sunucu: projeler ve organizasyon şablonları (bellekte).
async function mockServer(page, store) {
  await page.addInitScript((orgId) => {
    globalThis.__FAIR_STAND_CATALOG_HEADERS__ = { Authorization: 'Bearer e2e-template', 'X-Organization-Id': orgId };
  }, ORG_ID);

  await page.route('**/api/v1/fair-stand/projects**', async (route) => {
    const request = route.request();
    const parts = new URL(request.url()).pathname.split('/').filter(Boolean);
    const method = request.method();
    if (method === 'PUT') {
      const body = request.postDataJSON();
      const now = Date.now();
      store.project = {
        id: parts.at(-1),
        organizationId: ORG_ID,
        name: body.name,
        customerId: body.customerId || CUSTOMER_ID,
        version: 1,
        createdAt: store.project?.createdAt || now,
        updatedAt: now,
        payload: body.payload,
        assets: [],
      };
      await route.fulfill({ json: projectDetail(store) });
      return;
    }
    if (method === 'GET' && store.project) {
      await route.fulfill({ json: projectDetail(store) });
      return;
    }
    if (method === 'GET') {
      await route.fulfill({ status: 404, json: { detail: 'Project not found' } });
      return;
    }
    await route.fulfill({ status: 204, body: '' });
  });

  await page.route('**/api/v1/fair-stand/group-templates**', async (route) => {
    const request = route.request();
    const parts = new URL(request.url()).pathname.split('/').filter(Boolean);
    const method = request.method();
    const id = parts.at(-1) === 'group-templates' ? null : parts.at(-1);
    const summary = (t) => ({ id: t.id, organizationId: ORG_ID, name: t.name, memberCount: t.payload.members.length, createdAt: 1, updatedAt: 1 });
    if (method === 'GET' && !id) {
      await route.fulfill({ json: { templates: store.templates.map(summary) } });
      return;
    }
    if (method === 'GET') {
      const found = store.templates.find((t) => t.id === id);
      await route.fulfill(found ? { json: { ...summary(found), payload: found.payload } } : { status: 404, json: { detail: 'Şablon bulunamadı.' } });
      return;
    }
    if (method === 'POST') {
      const body = request.postDataJSON();
      store.posted.push(body);
      const template = { id: `tpl-${store.templates.length + 1}`, name: body.name.trim(), payload: body.payload };
      store.templates.push(template);
      await route.fulfill({ status: 201, json: { ...summary(template), payload: template.payload } });
      return;
    }
    if (method === 'DELETE') {
      store.templates = store.templates.filter((t) => t.id !== id);
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    await route.fulfill({ status: 405, json: { detail: 'no' } });
  });
}

async function dropBoxBlock(page, xRatio) {
  const openCatalogButton = page.locator('.module-drag-catalog');
  const modulePanel = page.locator('details', { has: openCatalogButton });
  if (!(await modulePanel.evaluate((el) => el.open))) await modulePanel.locator(':scope > summary').click();
  const card = page.locator('.module-drag-card[data-module-key="box_block"]');
  const group = page.locator('.module-drag-group', { has: card });
  if (!(await group.evaluate((el) => el.open))) await group.locator(':scope > summary').click();
  await card.scrollIntoViewIfNeeded();
  const viewport = await page.locator('#viewport').boundingBox();
  await card.dragTo(page.locator('#viewport'), {
    targetPosition: { x: Math.round(viewport.width * xRatio), y: Math.round(viewport.height * 0.5) },
  });
  await expect(page.locator('#box-block-size-title')).toBeVisible();
  await page.locator('input[name="opacity"]').fill('1');
  await page.getByRole('button', { name: 'Uygula' }).click();
  await expect(page.locator('#box-block-size-title')).toHaveCount(0);
}

function boxScreenPoints(page) {
  return page.evaluate(() => {
    const camera = window.__sceneCamera;
    const canvas = document.querySelector('#viewport > canvas').getBoundingClientRect();
    const byModule = new Map();
    window.__sceneSurfaces()
      .filter((mesh) => mesh.userData.moduleType === 'box-block' && mesh.userData.faceSlot)
      .forEach((face) => {
        face.updateMatrixWorld(true);
        const center = face.getWorldPosition(face.position.clone());
        const normal = face.getWorldDirection(face.position.clone());
        const facing = normal.dot(camera.position.clone().sub(center).normalize());
        const screen = center.clone().project(camera);
        const point = { facing, x: canvas.left + ((screen.x + 1) / 2) * canvas.width, y: canvas.top + ((1 - screen.y) / 2) * canvas.height };
        const moduleId = face.userData.moduleId;
        if (!byModule.has(moduleId) || byModule.get(moduleId).facing < facing) byModule.set(moduleId, point);
      });
    return Object.fromEntries(byModule);
  });
}

async function savedBoxes(page, store) {
  await page.locator('#save-project').click();
  await expect(page.locator('#project-status')).toContainText('Kaydedildi');
  return (store.project?.payload?.modules ?? []).filter((module) => module.type === 'box-block');
}

test('grup şablon olarak kaydedilir, yerleştirilir ve silinir', async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const store = { project: null, templates: [], posted: [] };
  await mockServer(page, store);
  await exposeScene(page);

  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('6');
  await page.locator('#stand-size-y').fill('5');
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill('E2E Sablon');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();
  await openEditorSettings(page);
  await page.locator('#autosave-interval').selectOption('0');
  await page.locator('body').press('t');
  await page.waitForTimeout(400);
  await dropBoxBlock(page, 0.38);
  await dropBoxBlock(page, 0.62);

  const initial = await savedBoxes(page, store);
  expect(initial).toHaveLength(2);
  const points = await boxScreenPoints(page);
  // Çift tık modülün tamamını seçer, Ctrl+tık modül ekler.
  await page.mouse.dblclick(points[initial[0].id].x, points[initial[0].id].y);
  await page.keyboard.down('Control');
  await page.mouse.click(points[initial[1].id].x, points[initial[1].id].y);
  await page.keyboard.up('Control');
  page.once('dialog', (dialog) => dialog.accept('Tezgah'));
  await page.mouse.click(points[initial[1].id].x, points[initial[1].id].y, { button: 'right' });
  await page.getByRole('menu', { name: 'Modül işlemleri' }).getByRole('menuitem', { name: 'Grup oluştur…' }).click();
  await expect(page.locator('#selection-info')).toContainText('“Tezgah” grubu oluşturuldu');

  // Gruplar kartından şablon olarak kaydet.
  await page.locator('#editor-mode-advanced').click();
  const groupsCard = page.locator('#module-groups-card');
  if (!(await groupsCard.evaluate((el) => el.open))) await groupsCard.locator(':scope > summary').click();
  const row = groupsCard.locator('.module-group-row', { hasText: 'Tezgah' });
  await row.locator('summary').click();
  page.once('dialog', (dialog) => dialog.accept('Tezgah şablonu'));
  await row.locator('[data-group-action="group-save-template"]').click();
  await expect(page.locator('#selection-info')).toContainText('“Tezgah şablonu” şablonu kaydedildi · 2 parça');

  // Sunucuya giden şablon: kimlik, grup ve görsel yok.
  expect(store.posted).toHaveLength(1);
  const posted = store.posted[0].payload;
  expect(posted.version).toBe(1);
  expect(posted.members).toHaveLength(2);
  for (const member of posted.members) {
    expect(member.id).toBeUndefined();
    expect(member.group).toBeUndefined();
    expect(member.itemKey).toBe('box_block');
    expect(JSON.stringify(member)).not.toMatch(/"(imageAssetId|fabricImageAssetId)":"[^"]/);
  }

  // Şablonlarım kartında görünür; Yerleştir yeni bir grup ekler.
  const templatesCard = page.locator('#module-templates-card');
  if (!(await templatesCard.evaluate((el) => el.open))) await templatesCard.locator(':scope > summary').click();
  const templateRow = templatesCard.locator('.module-template-row', { hasText: 'Tezgah şablonu' });
  await expect(templateRow.locator('.module-group-meta')).toHaveText('2 parça');
  await templateRow.locator('[data-template-action="template-place"]').click();
  await expect(page.locator('#selection-info')).toContainText('“Tezgah şablonu” yerleştirildi · 2 parça');
  await expect(groupsCard.locator('.module-group-row')).toHaveCount(2);
  const afterPlace = await savedBoxes(page, store);
  expect(afterPlace).toHaveLength(4);
  const placed = afterPlace.filter((module) => module.group?.name === 'Tezgah şablonu');
  expect(placed).toHaveLength(2);
  expect(placed.every((module) => module.group.locked === false)).toBe(true);
  for (const module of afterPlace) {
    expect(module.placement.xCm).toBeGreaterThanOrEqual(0);
    expect(module.placement.xCm + module.widthCm).toBeLessThanOrEqual(600);
  }
  // Göreli yerleşim korunur.
  const gap = (list) => Math.hypot(list[1].placement.xCm - list[0].placement.xCm, list[1].placement.yCm - list[0].placement.yCm);
  expect(Math.abs(gap(placed) - gap(initial))).toBeLessThan(0.5);

  // Sil: onaylı; sahnedeki gruplar etkilenmez.
  page.once('dialog', (dialog) => dialog.accept());
  await templateRow.locator('[data-template-action="template-delete"]').click();
  await expect(templatesCard.locator('.module-template-row')).toHaveCount(0);
  await expect(groupsCard.locator('.module-group-row')).toHaveCount(2);
  expect(pageErrors).toEqual([]);
});
