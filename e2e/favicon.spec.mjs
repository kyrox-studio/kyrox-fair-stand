import { test, expect } from '@playwright/test';

test('Stand sekmesi kendi simgelerini başarılı HTTP yanıtlarıyla yükler', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Kyrox Studio | Stand Konfiguratör');
  await expect(page.locator('head meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  const robots = await page.request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  expect(robots.headers()['content-type']).toContain('text/plain');
  expect((await robots.text()).replace(/\r\n/g, '\n')).toContain('User-agent: *\nAllow: /');
  const links = page.locator('head link[rel="icon"]');
  await expect(links).toHaveCount(2);
  for (const [href, contentType] of [
    ['/stand-favicon.svg', /image\/svg\+xml/],
    ['/stand-favicon.ico', /image\/(?:x-icon|vnd\.microsoft\.icon)/],
  ]) {
    await expect(page.locator(`head link[rel="icon"][href="${href}"]`)).toHaveCount(1);
    const response = await page.request.get(href);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(contentType);
    expect((await response.body()).length).toBeGreaterThan(0);
  }
});
