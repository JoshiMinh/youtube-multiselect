import { defineConfig } from '@playwright/test';

/** Opt-in, read-only smoke test against the real youtube.com (network required). */
export default defineConfig({
  testDir: 'tests/live',
  workers: 1,
  reporter: [['list']],
});
