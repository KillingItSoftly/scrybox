import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const port = Number(process.env.PWA_TEST_PORT || 4178);
export default defineConfig({
  testDir: './tests/browser',
  outputDir: process.env.PWA_TEST_OUTPUT || join(tmpdir(), 'scrybox-pwa-results'),
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: `http://127.0.0.1:${port}`, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'webkit', use: { browserName: 'webkit', hasTouch: true } },
    { name: 'chromium', use: { browserName: 'chromium', hasTouch: true } },
  ],
  webServer: {
    command: 'node tests/browser/server.mjs',
    url: `http://127.0.0.1:${port}/tests/browser/inspector.html`,
    reuseExistingServer: false,
    env: { PWA_TEST_PORT: String(port) },
  },
});
