import { expect, test as base, type BrowserContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { continuationScript, playlistPageHtml, sampleRows, type FixtureRow, type Layout } from '../fixtures/playlist';
import { launchWithExtension } from './fixtures';

// Per-URL fixture pages served instead of the real youtube.com.
const pages = new Map<string, string>();

function shell(body: string, title: string, dark = false): string {
  return `<!doctype html><html${dark ? ' dark' : ''}><head><meta charset="utf-8"><title>${title} - YouTube</title></head><body>${body}</body></html>`;
}

function servePlaylist(id: string, rows: FixtureRow[], title = `Fixture ${id}`, layout: Layout = 'legacy') {
  pages.set(`/playlist?list=${id}`, shell(playlistPageHtml(id, rows, { title, layout }), title));
}

/** A playlist that loads `batch` rows at a time as its sentinel scrolls into view. */
function serveLongPlaylist(id: string, total: number, batch: number, delayMs: number, layout: Layout = 'legacy') {
  const all = sampleRows(total);
  const html = playlistPageHtml(id, all.slice(0, batch), { title: 'Long', layout, expected: total, complete: false });
  pages.set(`/playlist?list=${id}`, shell(html + continuationScript(id, all, batch, delayMs, layout), 'Long'));
}

const test = base.extend<{ context: BrowserContext; page: Page; extensionId: string }>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await launchWithExtension();
    await context.route('https://www.youtube.com/**', (route) => {
      const url = new URL(route.request().url());
      const html = pages.get(url.pathname + url.search) ?? shell('<ytd-app><p>home</p></ytd-app>', 'Home');
      return route.fulfill({ status: 200, contentType: 'text/html', body: html });
    });
    await use(context);
    await context.close();
  },
  page: async ({ context }, use) => {
    await use(context.pages()[0] ?? (await context.newPage()));
  },
  extensionId: async ({ context }, use) => {
    // The extension has no background worker, so read its ID from chrome://extensions.
    const page = await context.newPage();
    await page.goto('chrome://extensions');
    const id = await page.evaluate(async () => {
      const mgr = document.querySelector('extensions-manager');
      const items = mgr?.shadowRoot?.querySelector('extensions-item-list')?.shadowRoot?.querySelectorAll('extensions-item');
      return items?.[0]?.id ?? '';
    });
    await page.close();
    await use(id);
  },
});

const checkboxes = (page: Page) => page.locator('[data-ytms-host="row"]').locator('input[type="checkbox"]');
const toolbar = (page: Page) => page.locator('ytms-toolbar');

test.beforeEach(() => pages.clear());

test('injects one checkbox per row and supports click + Shift-click + clear', async ({ page }) => {
  servePlaylist('PLe2e', sampleRows(6));
  await page.goto('https://www.youtube.com/playlist?list=PLe2e');
  await expect(checkboxes(page)).toHaveCount(6);
  await expect(toolbar(page)).toContainText('0 selected');

  await checkboxes(page).nth(1).click();
  await checkboxes(page).nth(4).click({ modifiers: ['Shift'] });
  await expect(toolbar(page)).toContainText('4 selected');
  const states = await checkboxes(page).evaluateAll((els) => els.map((el) => (el as HTMLInputElement).checked));
  expect(states).toEqual([false, true, true, true, true, false]);

  await toolbar(page).getByRole('button', { name: 'Clear' }).click();
  await expect(toolbar(page)).toContainText('0 selected');
});

test('lockup layout: controls sit inside the row, selection works, row link is not triggered', async ({ page }) => {
  servePlaylist('PLlock', sampleRows(4), 'Lockup', 'lockup');
  await page.goto('https://www.youtube.com/playlist?list=PLlock');
  await expect(checkboxes(page)).toHaveCount(4);
  const parents = await page
    .locator('[data-ytms-host="row"]')
    .evaluateAll((els) => els.map((el) => el.parentElement!.classList.contains('ytLockupViewModelHost')));
  expect(parents).toEqual([true, true, true, true]);
  await checkboxes(page).nth(0).click();
  await checkboxes(page).nth(3).click({ modifiers: ['Shift'] });
  await expect(toolbar(page)).toContainText('4 selected');
  expect(new URL(page.url()).pathname).toBe('/playlist');
});

for (const layout of ['legacy', 'lockup'] as const) {
  test(`Load all (${layout}): loads 1,200 entries with progress, keeps selection, restores scroll`, async ({ page }) => {
    test.setTimeout(90_000);
    serveLongPlaylist(`PLlong${layout}`, 1200, 100, 40, layout);
    await page.goto(`https://www.youtube.com/playlist?list=PLlong${layout}`);
    await expect(checkboxes(page)).toHaveCount(100);
    await expect(toolbar(page)).toContainText('100 of ~1200 loaded');
    await checkboxes(page).nth(1).click();
    await checkboxes(page).nth(3).click({ modifiers: ['Shift'] });

    await toolbar(page).getByRole('button', { name: 'Load all' }).click();
    await expect(toolbar(page).getByRole('progressbar', { name: 'Loading playlist entries' })).toBeVisible();
    await expect(toolbar(page)).toContainText('All 1200 entries loaded.', { timeout: 60_000 });

    await expect(checkboxes(page)).toHaveCount(1200);
    await expect(toolbar(page)).toContainText('3 selected');
    await expect(toolbar(page).getByRole('button', { name: 'Load all' })).toHaveCount(0);
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(50);
    const states = await checkboxes(page).evaluateAll((els) => els.slice(0, 5).map((el) => (el as HTMLInputElement).checked));
    expect(states).toEqual([false, true, true, true, false]);
  });
}

test('Load all can be cancelled from the toolbar', async ({ page }) => {
  serveLongPlaylist('PLcancel', 3000, 100, 250);
  await page.goto('https://www.youtube.com/playlist?list=PLcancel');
  await toolbar(page).getByRole('button', { name: 'Load all' }).click();
  await expect.poll(() => checkboxes(page).count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(300);
  await toolbar(page).getByRole('button', { name: 'Cancel' }).click();
  await expect(toolbar(page)).toContainText(/Loading cancelled at \d+\./);
  const count = await checkboxes(page).count();
  expect(count).toBeLessThan(3000);
  await page.waitForTimeout(800);
  // No further batches requested after cancelling.
  expect(await checkboxes(page).count()).toBeLessThanOrEqual(count + 100);
  await expect(toolbar(page).getByRole('button', { name: 'Load all' })).toBeVisible();
});

test('keyboard: a focused checkbox shows a focus ring and Space toggles it', async ({ page }) => {
  servePlaylist('PLkbd', sampleRows(2));
  await page.goto('https://www.youtube.com/playlist?list=PLkbd');
  await expect(checkboxes(page)).toHaveCount(2);
  await page.keyboard.press('Tab');
  await checkboxes(page).first().focus();
  const outline = await checkboxes(page).first().evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).toBe('solid');
  await page.keyboard.press('Space');
  await expect(toolbar(page)).toContainText('1 selected');
  await expect(checkboxes(page).first()).toHaveAccessibleName('Select: Video 1');
});

test('keyboard layer: arrows, Home/End, Ctrl+Left/Right and Ctrl+A work across shadow roots', async ({ page }) => {
  servePlaylist('PLnav', sampleRows(5));
  await page.goto('https://www.youtube.com/playlist?list=PLnav');
  await expect(checkboxes(page)).toHaveCount(5);
  const focusedName = () => page.evaluate(() => {
    let el: Element | null = document.activeElement;
    while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
    return el?.getAttribute('aria-label') ?? null;
  });

  await checkboxes(page).nth(1).focus();
  await page.keyboard.press('ArrowDown');
  expect(await focusedName()).toBe('Select: Video 3');
  await page.keyboard.press('End');
  expect(await focusedName()).toBe('Select: Video 5');
  await page.keyboard.press('Home');
  expect(await focusedName()).toBe('Select: Video 1');

  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Space');
  await expect(toolbar(page)).toContainText('2 selected');
  await page.keyboard.press('Control+ArrowLeft');
  expect(await focusedName()).toBe('Select: Video 1');
  await page.keyboard.press('Control+ArrowRight');
  expect(await focusedName()).toBe('Select: Video 3');

  await page.keyboard.press('Control+a');
  await expect(toolbar(page)).toContainText('5 selected');
  await page.keyboard.press('Control+a');
  await expect(toolbar(page)).toContainText('0 selected');
});

test('bridge reads per-occurrence IDs across worlds so duplicates stay distinct', async ({ page }) => {
  servePlaylist('PLdup', [
    { videoId: 'dupdupdupdu', title: 'Same video' },
    { videoId: 'dupdupdupdu', title: 'Same video' },
  ]);
  // Simulate YouTube's Polymer data in the page world before the extension scans.
  await page.addInitScript(() => {
    const assign = () =>
      document.querySelectorAll('ytd-playlist-video-renderer').forEach((el, i) => {
        (el as HTMLElement & { data?: unknown }).data = { videoId: 'dupdupdupdu', setVideoId: `SET${i + 1}` };
      });
    document.addEventListener('DOMContentLoaded', assign);
  });
  await page.goto('https://www.youtube.com/playlist?list=PLdup');
  await expect(checkboxes(page)).toHaveCount(2);
  await expect(page.locator('ytd-playlist-video-renderer[data-ytms-set-video-id="SET2"]')).toHaveCount(1);
  await checkboxes(page).nth(1).click();
  await expect(toolbar(page)).toContainText('1 selected');
  await expect(toolbar(page)).not.toContainText('position-based IDs');
});

test('appended rows get controls and selection survives', async ({ page }) => {
  servePlaylist('PLmore', sampleRows(3));
  await page.goto('https://www.youtube.com/playlist?list=PLmore');
  await checkboxes(page).nth(2).click();
  await page.evaluate(() => {
    const contents = document.querySelector('ytd-playlist-video-list-renderer #contents')!;
    const first = contents.querySelector('ytd-playlist-video-renderer')!;
    for (let i = 4; i <= 5; i++) {
      const clone = first.cloneNode(true) as HTMLElement;
      clone.querySelector('[data-ytms-host]')?.remove();
      clone.querySelector('#index')!.textContent = String(i);
      for (const a of clone.querySelectorAll('a[href*="watch"]')) a.setAttribute('href', `/watch?v=new0000000${i}&list=PLmore&index=${i}`);
      clone.querySelector('#video-title')!.setAttribute('title', `New ${i}`);
      contents.insertBefore(clone, contents.querySelector('ytd-continuation-item-renderer'));
    }
  });
  await expect(checkboxes(page)).toHaveCount(5);
  await checkboxes(page).nth(4).click({ modifiers: ['Shift'] });
  await expect(toolbar(page)).toContainText('3 selected');
});

test('SPA navigation: leaves cleanly, re-enters fresh, never duplicates controls', async ({ page }) => {
  servePlaylist('PLnav', sampleRows(3));
  await page.goto('https://www.youtube.com/playlist?list=PLnav');
  await checkboxes(page).first().click();
  await expect(toolbar(page)).toContainText('1 selected');

  // Navigate away the way YouTube does: pushState + yt-navigate-finish.
  await page.evaluate(() => {
    history.pushState({}, '', '/watch?v=vid00000001');
    document.dispatchEvent(new CustomEvent('yt-navigate-finish'));
  });
  await expect(page.locator('[data-ytms-host]')).toHaveCount(0);
  await expect(toolbar(page)).toHaveCount(0);

  // Come back: same list still in the DOM, as YouTube caches pages.
  await page.evaluate(() => {
    history.pushState({}, '', '/playlist?list=PLnav');
    document.dispatchEvent(new CustomEvent('yt-navigate-finish'));
    document.dispatchEvent(new CustomEvent('yt-navigate-finish'));
  });
  await expect(checkboxes(page)).toHaveCount(3);
  await expect(toolbar(page)).toHaveCount(1);
  await expect(toolbar(page)).toContainText('0 selected');
});

test('export downloads CSV of selected entries and does not alter the list', async ({ page }) => {
  servePlaylist('PLexp', sampleRows(3), 'Export test');
  await page.goto('https://www.youtube.com/playlist?list=PLexp');
  await checkboxes(page).nth(0).click();
  await checkboxes(page).nth(2).click();
  await toolbar(page).getByRole('button', { name: 'Export ▾' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    toolbar(page).getByRole('menuitem', { name: 'Download CSV' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^Export-test-.*\.csv$/);
  const csv = readFileSync((await download.path())!, 'utf8');
  expect(csv).toContain('1,Video 1');
  expect(csv).toContain('3,Video 3');
  expect(csv).not.toContain('Video 2');
  await expect(page.locator('ytd-playlist-video-renderer')).toHaveCount(3);
});

test('follows dark theme', async ({ page }) => {
  servePlaylist('PLdark', sampleRows(1));
  await page.goto('https://www.youtube.com/playlist?list=PLdark');
  await expect(checkboxes(page)).toHaveCount(1);
  await page.evaluate(() => document.documentElement.setAttribute('dark', ''));
  await expect(page.locator('[data-ytms-host="row"]')).toHaveAttribute('data-theme', 'dark');
  await expect(toolbar(page).locator('.ytms-toolbar')).toHaveAttribute('data-theme', 'dark');
});

test('popup reports status and the toggle removes controls', async ({ context, page, extensionId }) => {
  test.skip(!extensionId, 'Could not determine extension ID');
  servePlaylist('PLpop', sampleRows(2), 'Popup test');
  await page.goto('https://www.youtube.com/playlist?list=PLpop');
  await expect(checkboxes(page)).toHaveCount(2);

  // Opened as a tab, the popup's "active tab" is itself, so it reports a non-YouTube tab.
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.getByRole('heading', { name: 'Not a YouTube tab' })).toBeVisible();

  // Exercise the real popup -> content script status message against the YouTube tab.
  const status = await popup.evaluate(async () => {
    type Tabs = { query(q: object): Promise<{ id?: number }[]>; sendMessage(id: number, m: unknown): Promise<unknown> };
    const { tabs } = (globalThis as unknown as { chrome: { tabs: Tabs } }).chrome;
    const [tab] = await tabs.query({ url: 'https://www.youtube.com/*' });
    return tabs.sendMessage(tab!.id!, { type: 'ytms:get-status' });
  });
  expect(status).toMatchObject({
    enabled: true,
    page: { kind: 'playlist', playlistId: 'PLpop', title: 'Popup test' },
    session: { loaded: 2, selected: 0, identity: 'positional', listFound: true },
  });

  const toggle = popup.getByRole('switch', { name: 'Enable on YouTube' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('[data-ytms-host]')).toHaveCount(0);
  await toggle.click();
  await expect(checkboxes(page)).toHaveCount(2);
});
