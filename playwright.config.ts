import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3456',
    headless: true,
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: 'npx next dev -p 3456',
    url: 'http://localhost:3456/games.html',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
