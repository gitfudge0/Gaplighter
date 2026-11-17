import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: '*.spec.js', fullyParallel: false,
  timeout: 30000, retries: 0, workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173', viewport: { width: 1100, height: 900 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {} } },
    { name: 'firefox', use: { browserName: 'firefox' } },
  ],
  webServer: { command: 'node tests/server.mjs', url: 'http://127.0.0.1:4173/tests/fixtures/layouts.html', reuseExistingServer: false },
});
