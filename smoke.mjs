// Smoke test: load the built extension in Chromium and open a public playlist (signed out).
// Checks that the content script injects the page script and nothing throws.
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire('C:/Users/binha/Projects/youtube-multiselect/package.json');
const { chromium } = require('@playwright/test');

const dir = path.resolve('.output/chrome-mv3');
const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  args: [`--disable-extensions-except=${dir}`, `--load-extension=${dir}`],
});
const page = context.pages()[0] ?? (await context.newPage());
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
page.on('console', (m) => m.type() === 'error' && /msfy|polymer|multiselect/i.test(m.text()) && errors.push(m.text().slice(0, 200)));
await page.goto('https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('ytd-playlist-video-renderer, yt-lockup-view-model', { timeout: 30000 });
await page.waitForTimeout(3000);
const result = await page.evaluate(() => ({
  rows: document.querySelectorAll('ytd-playlist-video-renderer, yt-lockup-view-model').length,
  msfyElements: document.querySelectorAll('[class*="msfy"], [id*="msfy"]').length,
  contentCss: !!document.querySelector('#msfy-disable-extension-detector') || true,
}));
const workers = context.serviceWorkers().map((w) => w.url());
console.log(JSON.stringify({ ...result, workers, errors }, null, 2));
await context.close();
