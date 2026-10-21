import { test, expect } from '@playwright/test';

test('kapı üstü raf birleşimleri tüm stand yüksekliklerinde gerçek panellerden gelir', async ({ page }) => {
  await page.goto('/');
  const results = await page.evaluate(async () => {
    const { mapCatalogSeedToBootstrap } = await import('/test/mapCatalogSeed.mjs');
    const items = await import('/src/items.js');
    const { initializeStandDimensions } = await import('/src/standDimensions.js');
    const { createModuleStateFromDescriptor: create } = await import('/src/designState.js');
    const { snapPanelSeamOverlayPlacement: snap } = await import('/src/modulePlacement.js');
    const { listFlatPanelModuleSeamHeightsCm: seams } = await import('/src/wallPanelBand.js');
    const snapshot = mapCatalogSeedToBootstrap(await (await fetch('/test/fixtures/itemCatalogSeed.json')).json());
    items.initializeItemRegistry(snapshot.items);
    items.initializeItemTypeRegistry(snapshot.itemTypes);
    const results = [];
    for (const height of [250, 300, 350, 400, 450, 500]) {
      initializeStandDimensions({ ...snapshot.standDimensions, heightCm: height });
      const host = create({ itemKey: items.resolveWallItemKeyForHeight('wall_door_100_350', height) });
      host.placement = { wallId: 'back', xCm: 0, yCm: 0, zCm: 0, rotationZDeg: 0 };
      for (const card of ['shelf_row_1', 'shelf_row_2']) {
        const shelf = create({ itemKey: card });
        const at = (z) => snap({ moduleState: shelf, modules: [host],
          wallPoint: { wallId: 'back', pointerXCm: 50, pointerYCm: 0, absoluteHeightCm: z } });
        const first = seams(host).map(at).find((result) => result.ok);
        const placed = first ? { ...first.resolvedModuleState, placement: first.placement } : null;
        const duplicate = first ? snap({ moduleState: create({ itemKey: card }), modules: [host, placed],
          wallPoint: { wallId: 'back', pointerXCm: 50, pointerYCm: 0, absoluteHeightCm: first.seamHeightCm } }) : null;
        results.push({ height, card, seams: seams(host), bottom: at(200).ok, top: at(height).ok,
          duplicateRejected: !duplicate || !duplicate.ok,
          accepted: seams(host).filter((z) => at(z).ok) });
      }
    }
    return results;
  });
  for (const result of results) {
    const seams = Array.from({ length: result.height / 50 - 5 }, (_, i) => 250 + i * 50);
    expect(result.seams).toEqual(seams);
    expect(result.bottom).toBe(false);
    expect(result.top).toBe(false);
    expect(result.duplicateRejected).toBe(true);
    expect(result.accepted).toEqual(seams.filter((z) => z + (result.card === 'shelf_row_1' ? 1.8 : 51.8) <= result.height));
  }
});

test('tarayıcıda raf yerleştirmesi duvarın genişliğine çözülür', async ({ page }) => {
  await page.goto('/');
  const results = await page.evaluate(async () => {
    const { mapCatalogSeedToBootstrap } = await import('/test/mapCatalogSeed.mjs');
    const { initializeItemRegistry, initializeItemTypeRegistry, initializeSnapRuleRegistry } = await import('/src/items.js');
    const { initializeStandDimensions } = await import('/src/standDimensions.js');
    const { createModuleStateFromDescriptor: create } = await import('/src/designState.js');
    const { snapPanelSeamOverlayPlacement: snap } = await import('/src/modulePlacement.js');
    const seed = await (await fetch('/test/fixtures/itemCatalogSeed.json')).json();
    const snapshot = mapCatalogSeedToBootstrap(seed);
    initializeStandDimensions(snapshot.standDimensions);
    initializeItemTypeRegistry(snapshot.itemTypes);
    initializeSnapRuleRegistry(snapshot.rules);
    initializeItemRegistry(snapshot.items);
    return [100, 150, 200, 50].map((width) => {
      const host = create({ itemKey: `wall_${width}_350`, type: 'flat-panel' });
      host.placement = { xCm: 0, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' };
      const result = snap({ moduleState: create({ itemKey: 'shelf_row_2', type: 'shelf' }), modules: [host],
        wallPoint: { wallId: 'back', pointerXCm: width / 2, pointerYCm: 0, absoluteHeightCm: 100 } });
      return { ok: result.ok, key: result.resolvedModuleState?.itemKey ?? null };
    });
  });
  expect(results).toEqual([
    { ok: true, key: 'shelf_row_2_100' }, { ok: true, key: 'shelf_row_2_150' },
    { ok: true, key: 'shelf_row_2_200' }, { ok: false, key: null },
  ]);
});

test('ikili ve üçlü raf tarayıcıda ayrı tahtalarla çizilir', async ({ page }) => {
  await page.goto('/');
  const results = await page.evaluate(async () => {
    const { mapCatalogSeedToBootstrap } = await import('/test/mapCatalogSeed.mjs');
    const { initializeItemRegistry } = await import('/src/items.js');
    const { createShelfModule } = await import('/src/scene3d.js');
    const seed = await (await fetch('/test/fixtures/itemCatalogSeed.json')).json();
    initializeItemRegistry(mapCatalogSeedToBootstrap(seed).items);
    return [2, 3].map((rows) => {
      const { group, surfaces } = createShelfModule({ id: 'raf', itemKey: `shelf_row_${rows}_150`, widthCm: 150, shelfLightingOn: true }, 0);
      return {
        count: surfaces.length,
        thicknesses: surfaces.map((shelf) => Math.round(shelf.geometry.parameters.height * 1000)),
        heights: surfaces.map((shelf) => Math.round(shelf.position.y * 100)),
        lights: group.children.filter((child) => child.userData.role === 'shelf-under-led-strip' && child.visible).length,
      };
    });
  });
  expect(results).toEqual([
    { count: 2, thicknesses: [18, 18], heights: [150, 200], lights: 2 },
    { count: 3, thicknesses: [18, 18, 18], heights: [125, 175, 225], lights: 3 },
  ]);
});
