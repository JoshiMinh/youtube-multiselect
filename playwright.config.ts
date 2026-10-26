import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests load the built extension (`npm run build` first) into
 * Chromium and serve hand-written fixture pages in place of youtube.com.
 * They exercise the real content script, bridge and shadow DOM, but NOT
 * YouTube's live markup.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  workers: 1,
  reporter: [['list']],
});
