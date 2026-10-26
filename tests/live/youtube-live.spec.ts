import { expect, test, type Page } from '@playwright/test';
import { YT } from '../../src/adapters/youtube/selectors';
import { launchWithExtension } from '../e2e/fixtures';

const ROWS = YT.row
  .split(',')
  .map((s) => `ytd-browse:not([hidden]) ${s.trim()}`)
  .join(', ');

/**
 * Opt-in smoke test against the REAL youtube.com, signed out and read-only:
 * it only clicks this extension's checkboxes and ordinary navigation links.
 * Run with `npm run test:live`. Set YTMS_LIVE_PLAYLIST to a public playlist ID
 * to pin the target; otherwise the first playlist on @YouTube's channel is used.
 */
const checkboxes = (page: Page) => page.locator('[data-ytms-host="row"]').locator('input[type="checkbox"]');
const toolbar = (page: Page) => page.locator('ytms-toolbar');

test('live YouTube playlist: controls, selection, navigation cleanup', async () => {
  test.setTimeout(120_000);
  const context = await launchWithExtension();
  const page = context.pages()[0] ?? (await context.newPage());
  try {
    let playlistId = process.env.YTMS_LIVE_PLAYLIST;
    if (!playlistId) {
      await page.goto('https://www.youtube.com/@YouTube/playlists', { waitUntil: 'domcontentloaded' });
      test.skip(new URL(page.url()).hostname !== 'www.youtube.com', `Redirected to ${page.url()} (consent or region wall)`);
      const href = await page.locator('a[href*="/playlist?list="]').first().getAttribute('href', { timeout: 30_000 });
      playlistId = new URL(href!, 'https://www.youtube.com').searchParams.get('list')!;
    }
    await page.goto(`https://www.youtube.com/playlist?list=${playlistId}`, { waitUntil: 'domcontentloaded' });
    test.skip(new URL(page.url()).hostname !== 'www.youtube.com', `Redirected to ${page.url()}`);

    await expect(checkboxes(page).first()).toBeVisible({ timeout: 30_000 });
    const rows = await page.locator(ROWS).count();
    const controls = await checkboxes(page).count();
    const occurrenceRows = await page.locator('[data-ytms-set-video-id]').count();
    console.log(`[live] playlist=${playlistId} rows=${rows} controls=${controls} occurrenceIds=${occurrenceRows}`);
    expect(controls).toBeGreaterThan(0);
    expect(controls).toBeLessThanOrEqual(rows);

    await checkboxes(page).nth(0).click();
    const last = Math.min(2, controls - 1);
    await checkboxes(page).nth(last).click({ modifiers: ['Shift'] });
    await expect(toolbar(page)).toContainText(`${last + 1} selected`);
    const rowHandlersFired = page.url().includes('/watch');
    expect(rowHandlersFired, 'checkbox click must not navigate').toBe(false);

    // Client-side navigation away (title link) and back.
    await page.locator(ROWS).first().locator(YT.titleLink).first().click();
    await page.waitForURL(/\/watch\?/, { timeout: 30_000 });
    await expect(page.locator('[data-ytms-host]')).toHaveCount(0, { timeout: 10_000 });
    await expect(toolbar(page)).toHaveCount(0);

    await page.goBack();
    await page.waitForURL(/\/playlist\?/, { timeout: 30_000 });
    await expect(checkboxes(page).first()).toBeVisible({ timeout: 30_000 });
    await expect(toolbar(page)).toHaveCount(1);
    await expect(toolbar(page)).toContainText('0 selected');
    const perRow = await page
      .locator(ROWS)
      .evaluateAll((els) => els.map((el) => el.querySelectorAll('[data-ytms-host]').length));
    expect(new Set(perRow), 'exactly one control per row').toEqual(new Set([1]));
    console.log(`[live] after back: rows=${perRow.length} withControl=${perRow.filter((n) => n === 1).length}`);
  } finally {
    await context.close();
  }
});

// YouTube's public "Popular Music Videos" playlist (>100 entries), overridable.
const LONG_PLAYLIST = process.env.YTMS_LIVE_LONG_PLAYLIST ?? 'PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI';

test('live YouTube long playlist: continuation rows get controls and selection survives', async () => {
  test.setTimeout(120_000);
  const context = await launchWithExtension();
  const page = context.pages()[0] ?? (await context.newPage());
  await page.setViewportSize({ width: 1280, height: 900 });
  try {
    await page.goto(`https://www.youtube.com/playlist?list=${LONG_PLAYLIST}`, { waitUntil: 'domcontentloaded' });
    test.skip(new URL(page.url()).hostname !== 'www.youtube.com', `Redirected to ${page.url()}`);
    await expect(checkboxes(page).first()).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: test.info().outputPath('live-light.png') });

    const initial = await checkboxes(page).count();
    await checkboxes(page).nth(1).click();
    await checkboxes(page).nth(3).click({ modifiers: ['Shift'] });
    await expect(toolbar(page)).toContainText('3 selected');

    test.skip(!(await toolbar(page).getByRole('button', { name: 'Load all' }).isVisible()), 'Playlist is already fully loaded');
    const started = Date.now();
    await toolbar(page).getByRole('button', { name: 'Load all' }).click();
    await expect(toolbar(page)).toContainText(/All \d+ entries loaded\.|Loading stopped|limit/, { timeout: 90_000 });
    console.log(`[live-long] Load all finished in ${Date.now() - started} ms: ${await toolbar(page).locator('[role="status"]').textContent()}`);
    await expect(toolbar(page)).toContainText(/All \d+ entries loaded\./);
    const after = await checkboxes(page).count();
    const allRows = await page.locator(ROWS).count();
    // Lockups outside the playlist (e.g. recommendations) don't link to this list and get no control.
    const playlistRows = await page.locator(ROWS).filter({ has: page.locator(`a[href*="list=${LONG_PLAYLIST}"]`) }).count();
    console.log(`[live-long] initial=${initial} afterScroll=${after} playlistRows=${playlistRows} allLockups=${allRows}`);
    test.skip(after <= initial, 'YouTube did not load more rows (playlist too short or continuation blocked)');
    expect(after).toBe(playlistRows);
    await expect(toolbar(page)).toContainText('3 selected');

    await page.evaluate(() => document.documentElement.setAttribute('dark', ''));
    await page.mouse.wheel(0, -100_000);
    await page.waitForTimeout(500);
    await page.screenshot({ path: test.info().outputPath('live-dark-attr.png') });
  } finally {
    await context.close();
  }
});
