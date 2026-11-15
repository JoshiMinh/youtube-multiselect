import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const output = path.resolve('.output/chrome-mv3');
const messages = JSON.parse(await readFile('src/_locales/en/messages.json', 'utf8'));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://extension.test/**', async (route) => {
    const file = path.join(output, new URL(route.request().url()).pathname);
    const contentType = file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.png') ? 'image/png' : 'text/html';
    await route.fulfill({ body: await readFile(file), contentType });
  });
  await page.addInitScript(({ messages }) => {
    const local = {};
    const changed = { listeners: [], addListener(fn) { this.listeners.push(fn); } };
    const update = (key, value) => {
      if (value === undefined) delete local[key]; else local[key] = value;
      for (const listener of changed.listeners) listener({ [key]: value === undefined ? {} : { newValue: value } }, 'local');
    };
    window.openedTabs = [];
    window.chrome = {
      i18n: { getMessage: (key) => messages[key]?.message ?? key },
      storage: { onChanged: changed, local: {
        get: async () => ({ ...local }), set: async (values) => Object.entries(values).forEach(([key, value]) => update(key, value)),
        remove: async (key) => update(key, undefined),
      } },
      tabs: { create: async (tab) => window.openedTabs.push(tab) }, runtime: { openOptionsPage: async () => {} },
    };
  }, { messages });
  await page.goto('https://extension.test/options.html');
  await page.locator('#preserveSelection').waitFor();
  assert.equal(await page.locator('#bottomCenter').isChecked(), true);
  assert.equal(await page.locator('#openOptionsOnUpdate').isChecked(), true);
  for (const setting of ['showVideoIndex', 'preserveSelection', 'sortPlaylistNames', 'noRemovalConfirmation', 'findDuplicatesBackwards', 'openOptionsOnUpdate']) {
    const input = page.locator(`#${setting}`);
    const initial = await input.isChecked();
    await input.setChecked(!initial);
    assert.equal(await page.evaluate(async (key) => (await chrome.storage.local.get())[key], setting), !initial);
    await input.setChecked(initial);
    assert.equal(await page.evaluate(async (key) => (await chrome.storage.local.get())[key], setting), undefined);
  }
  await page.locator('#custom').check();
  assert.equal(await page.evaluate(async () => (await chrome.storage.local.get()).positioning), 'custom');
  await page.locator('#bottomCenter').check();
  assert.equal(await page.evaluate(async () => (await chrome.storage.local.get()).positioning), undefined);
  await page.evaluate(() => chrome.storage.local.set({ dark: true, preserveSelection: true }));
  assert.equal(await page.locator('html').getAttribute('dark'), '');
  assert.equal(await page.locator('#preserveSelection').isChecked(), true);
  await page.locator('nav a[href="#shortcuts"]').click();
  await page.locator('section#shortcuts').waitFor({ state: 'visible' });
  await page.locator('nav a[href="#settings"]').click();
  await page.locator('button#configure-shortcuts').click();
  assert.equal(await page.evaluate(() => window.openedTabs.at(-1).url), 'chrome://extensions/shortcuts');
  await page.locator('#reset-callouts').click();
  assert.equal(await page.evaluate(async () => (await chrome.storage.local.get()).callout), 0);
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `settings fit ${width}px`);
  }
  assert.deepEqual(errors, []);
  console.log('Options checks passed: every setting, defaults, persistence, theme, navigation, shortcuts, tour reset, and responsive widths.');
} finally {
  await browser.close();
}
