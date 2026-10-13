import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  outputDir: 'test-results/browser',
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: 'http://localhost:5182',
    viewport: { width: 1200, height: 900 },
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node node_modules/@anna-ai/cli/dist/cli.js dev --no-llm --storage legacy --port 5182',
    url: 'http://localhost:5182',
    timeout: 120000,
    reuseExistingServer: false,
  },
});
