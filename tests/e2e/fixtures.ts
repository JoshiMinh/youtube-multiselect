import { chromium, type BrowserContext } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';

export const EXTENSION_DIR = path.resolve('.output/chrome-mv3');

/** Launch Chromium with the built unpacked extension loaded. */
export async function launchWithExtension(): Promise<BrowserContext> {
  if (!existsSync(path.join(EXTENSION_DIR, 'manifest.json'))) throw new Error('Run `npm run build` before browser tests.');
  return chromium.launchPersistentContext('', {
    channel: 'chromium',
    args: [`--disable-extensions-except=${EXTENSION_DIR}`, `--load-extension=${EXTENSION_DIR}`],
    acceptDownloads: true,
  });
}
