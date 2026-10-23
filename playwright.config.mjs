import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : 'list',
  outputDir: 'test-results',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // İlk kullanım ipuçları (onboardingTips) testlerde görülmüş sayılır; kendi testleri bunu temizler.
    storageState: {
      cookies: [],
      origins: [{ origin: 'http://127.0.0.1:4173', localStorage: [{ name: 'fairStandTipsSeen', value: '1' }] }],
    },
  },
  webServer: {
    command: process.platform === 'win32'
      ? 'set FAIR_STAND_E2E_CATALOG=1&& npm run dev -- --host 127.0.0.1 --port 4173'
      : 'FAIR_STAND_E2E_CATALOG=1 npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    // Her koşu kendi Vite sunucusunu başlatır: yarıda kalan bir koşudan kalan sunucu başka bir
    // klasörü/dalı sunabilir; 4173 doluysa koşu sessizce yanlış koda bağlanmak yerine hata verir.
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
