// Read-only live check in a temporary, signed-out browser profile.
import assert from 'node:assert/strict';
import path from 'node:path';
import { chromium } from '@playwright/test';

const dir = path.resolve('.output/chrome-mv3');
const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  args: [`--disable-extensions-except=${dir}`, `--load-extension=${dir}`],
});
try {
  const page = context.pages()[0] ?? await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => {
    if (/polymer\.js|chrome-extension:/.test(error.stack ?? '')) errors.push(error.message);
  });
  await page.goto('https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI', { waitUntil: 'domcontentloaded' });
  const toggle = page.locator('[id^="msfy-toggle-bar-button-"] > yt-icon-button');
  for (let pass = 0; pass < 2; pass++) {
    await toggle.waitFor({ timeout: 30000 });
    assert.equal(await toggle.count(), 1);
    await toggle.click();
    const checkboxes = page.locator('[id="msfy-video-checkbox"]');
    await checkboxes.first().waitFor({ timeout: 30000 });
    assert.ok(await checkboxes.count() > 0, 'selection boxes are injected');
    console.log(`Live playlist ${pass ? 'reload' : 'initial load'}: ${await checkboxes.count()} selection boxes`);
    await toggle.click();
    if (pass === 0) await page.reload({ waitUntil: 'domcontentloaded' });
  }
  assert.deepEqual(errors, []);
} finally {
  await context.close();
}
