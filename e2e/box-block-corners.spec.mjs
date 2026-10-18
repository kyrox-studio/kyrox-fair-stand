import { test, expect } from '@playwright/test';

// Kutu blok yan plakaları köşede birbirine kavuşur: gövde rengi köşede çizgi olarak görünmez.
async function exposeScene(page) {
  await page.route('**/src/scene3d.js*', async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      '  let surfaceMeshes = [];',
      '  let surfaceMeshes = []; window.__sceneSurfaces = () => surfaceMeshes;',
    );
    await route.fulfill({ response, body });
  });
}

test('box block side faces meet at every vertical corner', async ({ page }) => {
  await exposeScene(page);
  await page.goto('/');
  const standSetup = page.locator('details.stand-setup-card');
  await standSetup.locator('summary').click();
  await standSetup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('500');
  await page.locator('#stand-size-y').fill('500');
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill('E2E Kose');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await expect(page.locator('#viewport-toolbar')).toBeVisible();

  const openCatalogButton = page.locator('#open-module-catalog');
  const modulePanel = page.locator('details', { has: openCatalogButton });
  await modulePanel.locator(':scope > summary').click();
  const card = page.locator('.module-drag-card[data-module-key="box_block"]');
  const group = page.locator('.module-drag-group', { has: card });
  if (!(await group.evaluate((el) => el.open))) await group.locator(':scope > summary').click();
  await card.scrollIntoViewIfNeeded();
  const viewport = await page.locator('#viewport').boundingBox();
  await card.dragTo(page.locator('#viewport'), {
    targetPosition: { x: Math.round(viewport.width * 0.5), y: Math.round(viewport.height * 0.7) },
  });
  await expect(page.locator('#box-block-size-title')).toBeVisible();
  await page.locator('input[name="opacity"]').fill('1');
  await page.getByRole('button', { name: 'Uygula' }).click();
  await expect(page.locator('#box-block-size-title')).toHaveCount(0);

  // Her yan plakanın iki dikey kenarı (yerel ±W/2), komşu plakanın düzlemine ulaşmalı.
  const gaps = await page.evaluate(() => {
    const faces = window.__sceneSurfaces().filter((mesh) => mesh.userData.moduleType === 'box-block' && mesh.userData.faceSlot);
    const bySlot = Object.fromEntries(faces.map((face) => [face.userData.faceSlot, face]));
    const group = bySlot.front.parent;
    group.updateMatrixWorld(true);
    const toGroup = group.matrixWorld.clone().invert();
    const edgesInGroup = (face) => {
      face.updateMatrixWorld(true);
      const halfWidth = face.geometry.parameters.width / 2;
      return [-halfWidth, halfWidth].map((x) => face.localToWorld(face.position.clone().set(x, 0, 0)).applyMatrix4(toGroup));
    };
    const planeOf = (face) => face.position.clone();
    const front = edgesInGroup(bySlot.front);
    const back = edgesInGroup(bySlot.back);
    const right = planeOf(bySlot.right).x;
    const left = planeOf(bySlot.left).x;
    const frontZ = planeOf(bySlot.front).z;
    const backZ = planeOf(bySlot.back).z;
    const side = (face) => edgesInGroup(face).map((point) => point.z);
    // Ön/arka plakanın en dış kenarı sağ/sol düzlemine, sağ/sol plakanın kenarı ön/arka düzlemine ne kadar uzak?
    return [
      Math.max(...front.map((p) => p.x)) - right,
      left - Math.min(...front.map((p) => p.x)),
      Math.max(...back.map((p) => p.x)) - right,
      left - Math.min(...back.map((p) => p.x)),
      Math.max(...side(bySlot.right)) - frontZ,
      backZ - Math.min(...side(bySlot.right)),
      Math.max(...side(bySlot.left)) - frontZ,
      backZ - Math.min(...side(bySlot.left)),
    ];
  });
  // Negatif değer köşede açıklık demektir; plaka kenarı komşu düzleme en az ulaşmalı.
  for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(-1e-6);
});
