import { defineConfig, devices } from '@playwright/test';

const enCi = process.env['CI'] === 'true';

export default defineConfig({
  testDir: './test/e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  retries: enCi ? 1 : 0,
  forbidOnly: enCi,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: 'e2e-resultados',
  reporter: enCi ? [['github'], ['html', { outputFolder: 'e2e-informe', open: 'never' }]] : [['list']],
  use: {
    baseURL: process.env['E2E_URL'] ?? 'http://127.0.0.1:3600',
    locale: 'es-PE',
    timezoneId: 'America/Lima',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
