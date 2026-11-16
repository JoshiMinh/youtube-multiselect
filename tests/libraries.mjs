// Exercise collection-specific branches with mocked YouTube responses.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const polymer = await readFile('.output/chrome-mv3/polymer.js', 'utf8');
const messages = Object.fromEntries(Object.entries(JSON.parse(await readFile('src/_locales/en/messages.json', 'utf8'))).map(([key, value]) => [key, value.message]));
const browser = await chromium.launch({ headless: true });
try {
  for (const library of ['playlist', 'history', 'liked', 'saved-shorts', 'music']) {
    const context = await browser.newContext();
    const music = library === 'music';
    const list = library === 'liked' ? 'LL' : library === 'saved-shorts' ? 'YS' : 'fixture';
    const url = `https://${music ? 'music' : 'www'}.youtube.com/${library === 'history' ? 'feed/history' : `playlist?list=${list}`}`;
    const ids = ['aaaaaaaaaaa', music ? 'aaaaaaaaaaa' : 'bbbbbbbbbbb'];
    const tag = music ? 'ytmusic-responsive-list-item-renderer' : library === 'saved-shorts' ? 'ytm-shorts-lockup-view-model-v2' : 'ytd-playlist-video-renderer';
    const rows = ids.map((id, index) => `<${tag} data-index="${index}"><a href="/${library === 'saved-shorts' ? `shorts/${id}` : `watch?v=${id}`}"><h3>Video ${index}</h3></a></${tag}>`).join('');
    const html = `<html><head><meta charset="utf-8"><style>${tag} { display:block; position:relative; height:120px; width:240px; }</style></head><body>${music
      ? `<ytmusic-app><ytmusic-nav-bar><div id="right-content"></div></ytmusic-nav-bar><ytmusic-playlist-shelf-renderer>${rows}</ytmusic-playlist-shelf-renderer></ytmusic-app>`
      : `<ytd-app><div class="ytd-masthead" id="end"></div><ytd-browse class="ytd-page-manager" role="main" page-subtype="${library === 'history' ? 'history' : 'playlist'}"><div id="rows">${rows}</div></ytd-browse><ytd-popup-container></ytd-popup-container></ytd-app>`}</body></html>`;
    await context.addCookies([{ name: 'SAPISID', value: 'fixture', domain: music ? 'music.youtube.com' : 'www.youtube.com', path: '/' }]);
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/*', (route) => route.fulfill({ body: html, contentType: 'text/html' }));
    await page.goto(url);
    await page.evaluate(({ ids, list, tag, music }) => {
      const items = ids.map((id, index) => ({ playlistVideoRenderer: { videoId: id, setVideoId: `set-${index}` } }));
      const raw = {
        header: { playlistHeaderRenderer: { playlistId: list, isEditable: list === 'fixture' } },
        contents: { twoColumnBrowseResultsRenderer: { tabs: [{ tabRenderer: { content: { richGridRenderer: {
          contents: ids.map((id, index) => ({ lockupViewModel: { contentId: id, menu: { imageName: 'DELETE', feedbackToken: `saved-${index}` } } })),
        } } } }] } },
      };
      document.querySelector('ytd-browse') && (document.querySelector('ytd-browse').__data = { data: raw });
      document.querySelectorAll(tag).forEach((row, index) => {
        row.data = music ? {
          playlistItemData: { videoId: ids[index], playlistSetVideoId: `set-${index}` },
          flexColumns: [{ musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: `Song ${index}` }] } } }, { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: index ? 'Beta' : 'Alpha' }] } } }],
        } : {
          videoId: ids[index], isPlayable: true, setVideoId: `set-${index}`, title: { simpleText: `Video ${index}` },
          menu: { menuRenderer: { items: [{ menuServiceItemRenderer: { serviceEndpoint: { feedbackEndpoint: { feedbackToken: `history-${index}` } } } }] } },
        };
      });
      if (music) document.querySelector('ytmusic-playlist-shelf-renderer').data = { contents: items, playlistId: list };
      window.ytcfg = { get: (key) => ({ LOGGED_IN: true, INNERTUBE_CONTEXT: { client: {} }, INNERTUBE_API_KEY: 'fixture' })[key] };
      window.requests = [];
      window.fetch = async (url, init) => {
        window.requests.push({ url, body: JSON.parse(init.body) });
        return { ok: true, json: async () => url.includes('/browse?') ? raw : {} };
      };
    }, { ids, list, tag, music });
    await page.evaluate(polymer);
    await page.evaluate((messages) => {
      const send = (type, value) => window.dispatchEvent(new CustomEvent('msfy-outer-message', { detail: JSON.stringify({ type, value }) }));
      send('data', { messages });
      send('options-changed', { callout: 100, noRemovalConfirmation: true });
    }, messages);
    await page.locator('[id^="msfy-toggle-bar-button-"] > yt-icon-button').click();
    const boxes = page.locator('[id="msfy-video-checkbox"]');
    assert.equal(await boxes.count(), 2);
    const action = async (id) => {
      await page.locator('[id^="msfy-bar-"] #menu').click();
      await page.locator(`#msfy-action-${id}`).click();
    };
    if (music) {
      await action('select-duplicates');
      assert.equal(await boxes.nth(1).getAttribute('checked'), '');
      await action('select-filter');
      await page.locator('#source-channel').check();
      await page.locator('#msfy-select-filter section > input').fill('Alpha');
      await page.locator('#msfy-select-filter #done').click();
      await page.waitForFunction(() => document.querySelector('#msfy-select-filter')?.dataset.state === 'success');
      assert.equal(await boxes.nth(0).getAttribute('checked'), '');
      await page.locator('#msfy-select-filter-close').click();
      console.log('Library checks passed: Music duplicate detection and artist filtering.');
    } else {
      await boxes.nth(1).locator('..').click();
      if (library === 'liked') {
        await action('move-to-top');
        await page.waitForFunction(() => window.requests.some((r) => r.url.includes('/like/like')));
        assert.equal(await page.evaluate(() => window.requests[0].url.includes('/like/removelike')), true);
      } else {
        await action('remove-videos');
        await page.waitForFunction(() => document.querySelectorAll('[id="msfy-video-checkbox"]').length === 1);
        const request = await page.evaluate(() => window.requests[0]);
        if (library === 'history') assert.deepEqual(request.body.feedbackTokens, ['history-1']);
        if (library === 'saved-shorts') assert.deepEqual(request.body.feedbackTokens, ['saved-1']);
        if (library === 'playlist') assert.equal(request.body.actions[0].setVideoId, 'set-1');
        assert.equal(await page.locator('html').count(), 1, 'removing from a one-item list retains the document');
        await boxes.first().locator('..').click();
        await action('remove-videos');
        await page.waitForFunction(() => document.querySelectorAll('[id="msfy-video-checkbox"]').length === 0);
        assert.equal(await page.locator('html').count(), 1, 'removing the final item retains the document');
      }
      console.log(`Library checks passed: ${library} ${library === 'liked' ? 're-like ordering' : 'removal'}.`);
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
} finally {
  await browser.close();
}
