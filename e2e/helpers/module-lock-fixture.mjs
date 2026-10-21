import { expect } from '@playwright/test';

// Ürün/BOM testleri yer açmak için otomatik duvarı silebilir. Hazırlık aşamasında
// gerçek kilit değiştirme handler'ını çağırırız; silme korumasını devre dışı bırakmayız.
// Kullanıcının sağ tık akışı wall-height.spec.mjs içinde ayrıca doğrulanır.
export async function installModuleUnlockFixture(page) {
  await page.route('**/src/main.js*', async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const marker = 'function changeModuleLock(moduleIds, locked) {';
    expect(source).toContain(marker);
    await route.fulfill({ response, body: source.replace(marker,
      `window.__unlockModuleForFixture = (id) => changeModuleLock([id], false);\n${marker}`) });
  });
}

export async function unlockModuleForFixture(page, moduleState) {
  if (moduleState.locked !== true) return;
  await page.evaluate((id) => window.__unlockModuleForFixture(id), moduleState.id);
}
