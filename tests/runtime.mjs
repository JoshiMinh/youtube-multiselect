// Offline browser regression checks against the production bundles. Run after a build.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const content = await readFile(new URL('../.output/chrome-mv3/content-scripts/content.js', import.meta.url), 'utf8');
const polymer = await readFile(new URL('../.output/chrome-mv3/polymer.js', import.meta.url), 'utf8');
const messages = JSON.parse(await readFile(new URL('../src/_locales/en/messages.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ headless: true });
try {
 for (const nativeWrapper of [false, true]) {
  const context = await browser.newContext();
  await context.addCookies([{ name: 'SAPISID', value: 'fixture', domain: 'www.youtube.com', path: '/' }]);
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const ids = ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc', 'ddddddddddd'];
  const html = `<html data-cast-api-enabled><head><meta charset="utf-8"><style>
    #grid { display:flex; gap:16px; align-items:flex-start; }
    ytd-rich-item-renderer { display:block; width:200px; }
    yt-lockup-view-model, ytm-shorts-lockup-view-model-v2, ytm-shorts-lockup-view-model { display:block; }
    yt-thumbnail-view-model { display:block; width:100%; aspect-ratio:16/9; }
    .shortsLockupViewModelHostThumbnailContainer { width:100%; aspect-ratio:9/16; }
  </style></head><body><ytd-app><div class="ytd-masthead" id="end"></div>
    <ytd-browse class="ytd-page-manager" role="main" page-subtype="playlist"><div id="grid">
      ${ids.map((id, index) => `<ytd-rich-item-renderer data-id="${id}">${index < 2
        ? `<ytm-shorts-lockup-view-model-v2><ytm-shorts-lockup-view-model><a href="/shorts/${id}"><div class="shortsLockupViewModelHostThumbnailContainer"></div></a><h3>${'Short title '.repeat(index ? 15 : 1)}</h3></ytm-shorts-lockup-view-model></ytm-shorts-lockup-view-model-v2>`
        : `<yt-lockup-view-model><a href="/watch?v=${id}"><yt-thumbnail-view-model></yt-thumbnail-view-model></a><h3>${'Video title '.repeat(index === 3 ? 15 : 1)}</h3></yt-lockup-view-model>`}<yt-content-metadata-view-model><span>${index % 2 ? 'Beta' : 'Alpha'}</span></yt-content-metadata-view-model><div class="WatchedProgressBarSegment" style="width:${index * 30}%"></div></ytd-rich-item-renderer>`).join('')}
    </div></ytd-browse><ytd-popup-container></ytd-popup-container></ytd-app></body></html>`;
  await page.route('https://www.youtube.com/**', (route) => route.fulfill({
    contentType: route.request().url().endsWith('/polymer.js') ? 'application/javascript' : 'text/html',
    body: route.request().url().endsWith('/polymer.js') ? polymer : html,
  }));
  await page.goto('https://www.youtube.com/playlist?list=fixture');
  await page.evaluate(({ messages, ids, nativeWrapper }) => {
    document.querySelectorAll('ytd-rich-item-renderer').forEach((row) => {
      row.firstElementChild.append(...[...row.children].slice(1));
    });
    const signal = () => ({ listeners: new Set(), addListener(fn) { this.listeners.add(fn); }, removeListener(fn) { this.listeners.delete(fn); } });
    window.ports = [];
    window.preferences = { callout: 100, blacklisted: true, handle: '@w-regner' };
    window.chrome = {
      runtime: {
        id: 'fixture', onMessage: signal(), sendMessage: async () => {},
        getURL: (path) => `https://www.youtube.com${path}`,
        connect: () => {
          const port = { onDisconnect: signal(), disconnect() { for (const listener of [...this.onDisconnect.listeners]) listener(); } };
          window.ports.push(port);
          return port;
        },
      },
      storage: { onChanged: signal(), local: {
        get: async () => ({ ...window.preferences }),
        remove: async (keys) => { for (const key of keys) delete window.preferences[key]; },
        set: async (values) => {
          const changes = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { newValue: value }]));
          Object.assign(window.preferences, values);
          for (const listener of chrome.storage.onChanged.listeners) listener(changes, 'local');
        },
      } },
      i18n: { getMessage: (key) => messages[key]?.message ?? key },
    };
    // Minimal Polymer shim: exercise the extension's wrapper callbacks with light DOM.
    if (!nativeWrapper) window.Polymer = (definition) => customElements.define(definition.is, class extends HTMLElement {
      connectedCallback() {
        if (!this.firstChild) {
          this.append(definition._template().content.cloneNode(true));
          const checkbox = this.firstElementChild;
          checkbox.tabIndex = 0;
          Object.defineProperty(checkbox, 'checked', {
            get() { return this.hasAttribute('checked'); },
            set(value) { this.toggleAttribute('checked', Boolean(value)); },
          });
          checkbox.addEventListener('click', (event) => {
            checkbox.focus();
            checkbox.checked = !checkbox.checked;
            definition.onTap({ detail: { sourceEvent: event }, target: checkbox });
          });
          checkbox.addEventListener('contextmenu', (event) => { checkbox.focus(); definition.onContextMenu(event); });
        }
        definition.attached();
      }
      disconnectedCallback() { definition.detached(); }
    });
    window.ytcfg = { get: (key) => ({ LOGGED_IN: true, INNERTUBE_CONTEXT: { client: {} }, INNERTUBE_API_KEY: 'fixture' })[key] };
    const items = ids.map((id) => ({ richItemRenderer: { content: { shortsLockupViewModel: { contentId: id, menu: { playlistSetVideoId: `set-${id}` } } } } }));
    const data = {
      header: { playlistHeaderRenderer: { playlistId: 'fixture' } },
      contents: { twoColumnBrowseResultsRenderer: { tabs: [
        { tabRenderer: { content: { richGridRenderer: { contents: [] } } } },
        { tabRenderer: { selected: true, endpoint: { browseEndpoint: { browseId: 'VLfixture', params: 'shorts-tab' } }, content: { richGridRenderer: { contents: items } } } },
      ] } },
    };
    document.querySelector('ytd-browse').__data = { data };
    window.fixtureData = data;
    window.requests = [];
    window.popupActions = [];
    document.addEventListener('yt-action', (event) => window.popupActions.push(event.detail));
    window.toasts = [];
    document.querySelector('ytd-popup-container').handleOpenPopupAction = (event) => window.toasts.push(event.openPopupAction.popup.notificationActionRenderer.responseText.simpleText);
    document.querySelector('ytd-app').resolveCommand = (command) => { window.requests.push({ command }); };
    window.fetch = async (url, init) => {
      window.requests.push({ url, body: JSON.parse(init.body) });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const response = url.includes('/get_add_to_playlist') ? { contents: [{ addToPlaylistRenderer: {
        actions: [{ addToPlaylistCreateRenderer: { serviceEndpoint: { createPlaylistServiceEndpoint: {} } } }],
        playlists: [{ playlistAddToOptionRenderer: { playlistId: 'target', title: { simpleText: 'Target' }, addToPlaylistServiceEndpoint: { playlistEditEndpoint: {} }, removeFromPlaylistServiceEndpoint: { playlistEditEndpoint: {} } } }],
      } }] } : url.includes('/browse?') ? data : {};
      return { ok: !window.failRequests, status: window.failRequests ? 500 : 200, json: async () => response };
    };
  }, { messages, ids, nativeWrapper });
  const wrappers = page.locator('[id="msfy-video-checkbox"]');
  const toggle = page.locator('[id^="msfy-toggle-bar-button-"] > yt-icon-button');
  async function initialize() {
    await page.evaluate(content);
    await toggle.waitFor({ timeout: 5000 }).catch((error) => { throw new Error(`${error.message}\nPage errors: ${JSON.stringify(errors)}`); });
    assert.equal(await wrappers.count(), 4, 'one selection box per item, including nested Shorts');
    await toggle.click();
  }
  await initialize();
  assert.deepEqual(await page.evaluate(() => ['blacklisted', 'handle'].filter((key) => key in window.preferences)), [], 'retired account restrictions are migrated away');
  assert.equal(await page.evaluate(() => window.preferences.callout), 100, 'migration retains unrelated preferences');
  await page.waitForFunction(() => [...document.querySelectorAll('[id="msfy-video-checkbox"]')].every((el) => el.getBoundingClientRect().height > 0));
  const heights = await wrappers.evaluateAll((elements) => elements.map((el) => el.getBoundingClientRect().height));
  assert.equal(heights[0], heights[1], 'Shorts boxes ignore title length');
  assert.equal(heights[2], heights[3], 'video boxes ignore title length');
  await page.locator('#grid').evaluate((grid) => grid.style.setProperty('width', '700px'));
  await page.locator('ytd-rich-item-renderer').evaluateAll((rows) => rows.forEach((row) => row.style.width = '160px'));
  await page.waitForFunction(() => document.querySelector('[id="msfy-video-checkbox"]').getBoundingClientRect().width === 160);

  await wrappers.nth(1).locator('..').click();
  await page.locator('[id^="msfy-bar-"] #menu').click();
  for (const action of ['move-up', 'move-down', 'move-to-top', 'move-to-bottom']) {
    assert.equal(await page.locator(`#msfy-action-${action}`).count(), 1, action);
  }
  await page.locator('#msfy-action-move-up').click();
  await page.waitForFunction(() => document.querySelector('#grid').firstElementChild.dataset.id === 'bbbbbbbbbbb');
  const edit = await page.evaluate(() => window.requests.find((request) => request.url?.includes('/edit_playlist')).body);
  assert.deepEqual(edit.actions, [{ action: 'ACTION_MOVE_VIDEO_AFTER', setVideoId: 'set-bbbbbbbbbbb' }]);
  await page.waitForFunction(() => window.requests.some((request) => request.body.params === 'shorts-tab'));

  for (const [action, position, expectedAction] of [
    ['move-down', 1, 'ACTION_MOVE_VIDEO_AFTER'],
    ['move-to-bottom', 3, 'ACTION_MOVE_VIDEO_BEFORE'],
    ['move-to-top', 0, 'ACTION_MOVE_VIDEO_AFTER'],
  ]) {
    await page.locator('[data-id="bbbbbbbbbbb"] [id="msfy-video-checkbox"]').locator('..').click();
    await page.locator('[id^="msfy-bar-"] #menu').click();
    await page.locator(`#msfy-action-${action}`).click();
    await page.waitForFunction(({ position }) => document.querySelector('#grid').children[position].dataset.id === 'bbbbbbbbbbb', { position });
    const lastEdit = await page.evaluate(() => window.requests.filter((request) => request.url?.includes('/edit_playlist')).at(-1).body);
    assert.equal(lastEdit.actions[0].action, expectedAction);
    assert.equal(lastEdit.actions[0].setVideoId, 'set-bbbbbbbbbbb');
  }

  // Re-running the content script replaces all listeners and leaves one live runtime.
  await initialize();
  assert.equal(await toggle.count(), 1);
  assert.equal(await page.locator('[id^="msfy-bar-"]').count(), 1);
  assert.deepEqual(await page.evaluate(() => [chrome.runtime.onMessage.listeners.size, chrome.storage.onChanged.listeners.size]), [1, 1]);
  await page.evaluate(() => window.ports.at(-1).disconnect());
  await page.waitForFunction(() => window.ports.length === 3);
  assert.equal(await wrappers.count(), 4, 'worker reconnection retains the page runtime');
  await toggle.click();
  assert.equal(await wrappers.first().isVisible(), false, 'a single toggle exits selection mode after reinjection');
  await toggle.click();
  await wrappers.nth(0).locator('..').click();
  await page.keyboard.press('Control+a');
  assert.equal(await page.locator('[id="msfy-video-checkbox"][checked]').count(), 4, 'keyboard shortcuts run once after reinjection');

  const checked = () => page.locator('[id="msfy-video-checkbox"][checked]').count();
  const bar = page.locator('[id^="msfy-bar-"]');
  const clear = async () => { if (await checked()) await bar.locator('#unselect').click(); };
  const select = async (...values) => {
    await clear();
    for (const id of values) await page.locator(`[data-id="${id}"] [id="msfy-video-checkbox"]`).locator('..').click();
  };
  const action = async (id) => { await bar.locator('#menu').click(); await page.locator(`#msfy-${id}`).click(); };
  const preference = (values) => page.evaluate((values) => chrome.storage.local.set(values), values);
  const edits = () => page.evaluate(() => window.requests.filter((request) => request.url?.includes('/edit_playlist')).length);

  await action('action-select-shorts');
  assert.equal(await checked(), 2);
  await action('action-select-videos');
  assert.equal(await checked(), 2);
  assert.equal(await page.locator('yt-lockup-view-model [checked]').count(), 2);

  await select(ids[0]);
  await page.locator(`[data-id="${ids[3]}"] [id="msfy-video-checkbox"]`).locator('..').click({ modifiers: ['Shift'] });
  assert.equal(await checked(), 3, 'shift click selects a contiguous range');
  await select(ids[0]);
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator(`[data-id="${ids[2]}"] [id="msfy-video-checkbox"]`).evaluate((el) => el === document.activeElement), true);

  await select(ids[0]);
  await action('action-copy');
  assert.equal(await checked(), 0, 'copy clears selection by default');
  await preference({ preserveSelection: true });
  await select(ids[0]);
  await page.keyboard.press('Control+c');
  assert.equal(await checked(), 1, 'preserve selection applies to keyboard copying');
  const beforePaste = await edits();
  await action('action-paste');
  await page.waitForFunction((before) => window.requests.filter((r) => r.url?.includes('/edit_playlist')).length > before, beforePaste);
  assert.equal(await page.evaluate(() => window.requests.filter((r) => r.url?.includes('/edit_playlist')).at(-1).body.actions[0].addedVideoId), ids[0]);
  await preference({ preserveSelection: false });

  await clear();
  await action('action-select-filter');
  const filter = page.locator('#msfy-select-filter');
  await filter.locator('section > input').fill('Video title');
  await filter.locator('#done').click();
  assert.equal(await checked(), 2, 'title filter');
  await clear();
  await filter.locator('#source-watched').check();
  await filter.locator('section > input').evaluate((input) => { input.value = '50'; input.dispatchEvent(new Event('input')); });
  await filter.locator('#done').click();
  assert.equal(await checked(), 2, 'watched progress filter');
  await clear();
  await filter.locator('#source-title').check();
  await filter.locator('section > input').fill('[');
  await filter.locator('#done').click();
  assert.equal(await checked(), 0);
  assert.equal(await page.evaluate(() => window.toasts.at(-1)), 'Invalid regular expression');
  await filter.locator('#msfy-select-filter-close').click();
  await action('action-select-filter');
  assert.equal(await filter.locator('section > input').inputValue(), '[', 'filter text survives reopening');
  await filter.locator('#msfy-select-filter-close').click();

  // Group/flip must work even after menu handling has cleared the selection.
  await bar.locator('#select').click();
  const beforeFlip = await page.locator('#grid > ytd-rich-item-renderer').evaluateAll((rows) => rows.map((row) => row.dataset.id));
  await action('action-flip-list');
  await page.waitForFunction((first) => document.querySelector('#grid').firstElementChild.dataset.id === first, beforeFlip.at(-1));
  assert.equal(await wrappers.count(), 4, 'flip retains all rows');
  assert.deepEqual(await page.locator('#grid > ytd-rich-item-renderer').evaluateAll((rows) => rows.map((row) => row.dataset.id)), beforeFlip.reverse());
  await bar.locator('#select').click();
  await action('action-group-by-channel');
  await page.waitForFunction(() => document.querySelectorAll('[id="msfy-video-checkbox"][checked]').length === 0);
  await page.waitForTimeout(50);
  const channels = await page.locator('#grid yt-content-metadata-view-model').allTextContents();
  assert.equal(channels[0], channels[1], 'group by channel keeps matching channels together');
  assert.equal(channels[2], channels[3]);

  // Duplicate videos have distinct playlist-item IDs; reversing duplicate search changes the survivor.
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#grid > ytd-rich-item-renderer')];
    const first = rows[0].querySelector('a');
    const second = rows[1].querySelector('a');
    second.dataset.originalHref = second.getAttribute('href');
    second.setAttribute('href', first.getAttribute('href'));
  });
  await clear();
  await action('action-select-duplicates');
  assert.equal(await checked(), 1);
  assert.equal(await wrappers.nth(1).getAttribute('checked'), '');
  await clear();
  await preference({ findDuplicatesBackwards: true });
  await action('action-select-duplicates');
  assert.equal(await wrappers.nth(0).getAttribute('checked'), '');
  await page.evaluate(() => {
    const link = document.querySelector('[data-original-href]');
    link.setAttribute('href', link.dataset.originalHref);
    delete link.dataset.originalHref;
  });
  await preference({ findDuplicatesBackwards: false });
  await select(ids[0]);
  await page.locator(`[data-id="${ids[3]}"] [id="msfy-video-checkbox"]`).locator('..').click({ button: 'right' });
  await page.locator('#msfy-action-move-after').click();
  await page.waitForFunction(() => document.querySelector('[data-id="ddddddddddd"]').nextElementSibling?.dataset.id === 'aaaaaaaaaaa');
  assert.equal(await page.evaluate(() => window.requests.filter((r) => r.url?.includes('/edit_playlist')).at(-1).body.actions[0].movedSetVideoIdPredecessor), 'set-ddddddddddd');

  // A repeated sort must not overwrite the original order used when sorting is disabled.
  await page.evaluate(() => {
    const popup = document.createElement('div');
    popup.__data = { opened: true };
    const renderer = document.createElement('ytd-add-to-playlist-renderer');
    renderer.className = 'ytd-popup-container';
    renderer.data = { playlists: ['Zulu', 'Alpha'].map((title) => ({ playlistAddToOptionRenderer: { playlistId: title, title: { simpleText: title } } })) };
    popup.append(renderer);
    document.body.append(popup);
    window.sortFixture = renderer;
  });
  await preference({ sortPlaylistNames: true });
  for (let pass = 0; pass < 2; pass++) await page.evaluate(() => document.dispatchEvent(new CustomEvent('yt-action', { detail: { actionName: 'yt-open-popup-action', args: [{ openPopupAction: { popupType: 'DIALOG', popup: { addToPlaylistRenderer: window.sortFixture.data } } }] } })));
  assert.deepEqual(await page.evaluate(() => window.sortFixture.data.playlists.map((item) => item.playlistAddToOptionRenderer.playlistId)), ['Alpha', 'Zulu']);
  await preference({ sortPlaylistNames: false });
  assert.deepEqual(await page.evaluate(() => window.sortFixture.data.playlists.map((item) => item.playlistAddToOptionRenderer.playlistId)), ['Zulu', 'Alpha']);
  await page.evaluate(() => window.sortFixture.parentElement.remove());

  await page.evaluate(() => window.fixtureData.contents.twoColumnBrowseResultsRenderer.tabs[1].tabRenderer.content.richGridRenderer.contents.push({ continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: 'next-page' } } } }));
  await action('action-load-entire-playlist');
  await page.locator('#msfy-progress-bar-close').click();
  await page.waitForFunction(() => document.querySelector('#msfy-progress-bar').style.display === 'none');
  await page.evaluate(() => window.fixtureData.contents.twoColumnBrowseResultsRenderer.tabs[1].tabRenderer.content.richGridRenderer.contents.pop());

  // Network failures must leave rows intact and must not report success.
  await select(ids[0]);
  await action('action-remove-videos');
  await page.locator('dialog[open] #cancel').click();
  assert.equal(await wrappers.count(), 4, 'cancel removal');
  await preference({ noRemovalConfirmation: true });
  await page.evaluate(() => { window.failRequests = true; window.toasts = []; });
  await action('action-remove-videos');
  await page.waitForFunction(() => window.toasts.length > 0);
  assert.equal(await wrappers.count(), 4, 'failed removal keeps the original rows');
  await select(ids[0]);
  await action('action-add-to-watch-later');
  await page.waitForFunction(() => window.requests.filter((r) => r.body?.playlistId === 'WL').length >= 2);
  await page.waitForTimeout(50);
  assert.equal(await page.evaluate(() => window.toasts.includes('Save to Watch later (1)')), false, 'failed Watch Later fallback does not report success');
  await page.evaluate(() => { window.failRequests = false; });
  await select(ids[0]);
  await action('action-like-videos');
  await page.waitForFunction(() => window.requests.some((r) => r.url?.includes('/like/like')));
  await select(ids[0]);
  await action('action-add-to-queue');
  assert.equal(await page.evaluate(() => window.requests.some((r) => r.command?.signalServiceEndpoint?.actions?.[0]?.addToPlaylistCommand?.videoIds?.[0] === 'aaaaaaaaaaa')), true);
  await select(ids[0], ids[1]);
  const saveOrder = await page.locator('[id="msfy-video-checkbox"][checked]').evaluateAll((boxes) => boxes.map((box) => box.closest('ytd-rich-item-renderer').dataset.id));
  await action('action-add-to-playlist');
  await page.waitForFunction(() => window.popupActions.some((event) => event.args?.[0]?.openPopupAction?.popup?.addToPlaylistRenderer?.playlists?.[0]?.playlistAddToOptionRenderer?.addToPlaylistServiceEndpoint?.playlistEditEndpoint?.actions?.length === 2));
  const save = await page.evaluate(() => window.popupActions.filter((event) => event.actionName === 'yt-open-popup-action').at(-1).args[0].openPopupAction.popup.addToPlaylistRenderer);
  assert.equal(save.playlists[0].playlistAddToOptionRenderer.addToPlaylistServiceEndpoint.playlistEditEndpoint.actions.length, 2, 'save dialog adds every selected video');
  assert.deepEqual(save.actions[0].addToPlaylistCreateRenderer.serviceEndpoint.createPlaylistServiceEndpoint.videoIds, saveOrder, 'create playlist uses the selected videos in current list order');
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('yt-popup-closed', { detail: { popupRenderer: document.createElement('ytd-add-to-playlist-renderer') } })));

  await select(ids[0]);
  await action('download-selection');
  const format = page.locator('dialog[open]');
  await format.locator('input[value="0"]').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await format.locator('input[value="1"]').isChecked(), true, 'export formats support keyboard selection');
  await page.keyboard.press('Escape');
  await action('download-selection');
  await format.locator('input[value="2"]').check();
  const downloaded = page.waitForEvent('download');
  await format.locator('#submit').click();
  const htmlDownload = await downloaded;
  const exported = await readFile(await htmlDownload.path(), 'utf8');
  assert.ok(exported.includes(`/watch?v=${ids[0]}`));
  assert.equal(exported.includes('undefined'), false, 'HTML export uses modern card data');

  const beforeImport = await edits();
  const chooseFile = page.waitForEvent('filechooser');
  await action('add-videos-from-file');
  await (await chooseFile).setFiles({ name: 'selection.txt', mimeType: 'text/plain', buffer: Buffer.from(`${ids[0]}\n`) });
  await page.waitForFunction((before) => window.requests.filter((r) => r.url?.includes('/edit_playlist')).length > before, beforeImport);
  const beforeInvalidImport = await edits();
  const invalidFile = page.waitForEvent('filechooser');
  await action('add-videos-from-file');
  await (await invalidFile).setFiles({ name: 'selection.json', mimeType: 'application/json', buffer: Buffer.from('["bad id"]') });
  await page.waitForFunction(() => window.toasts.at(-1) === 'Invalid data');
  assert.equal(await edits(), beforeInvalidImport, 'invalid imports never send playlist edits');

  // Untrusted page messages cannot open arbitrary URLs or save malformed positions.
  await page.evaluate(() => {
    for (const message of [{ type: 'url', value: 'file:///private' }, { type: 'barPosition', value: { x: 'bad', y: 1 } }]) {
      window.dispatchEvent(new CustomEvent('msfy-inner-message', { detail: JSON.stringify(message) }));
    }
    document.documentElement.setAttribute('dark', '');
  });
  await page.waitForFunction(() => window.preferences.dark === true);
  assert.equal(await page.evaluate(() => window.preferences.barPosition?.x === 'bad'), false);
  await page.evaluate(() => {
    const hidden = document.createElement('section');
    hidden.hidden = true;
    hidden.id = 'hidden-fixture';
    hidden.innerHTML = '<ytd-playlist-video-renderer><h3>Hidden video</h3></ytd-playlist-video-renderer>';
    document.querySelector('ytd-browse').append(hidden);
  });
  await page.waitForFunction(() => document.querySelectorAll('[id="msfy-video-checkbox"]').length === 5);
  await clear();
  await bar.locator('#select').click();
  assert.equal(await checked(), 4, 'select all ignores inactive hidden lists');
  await page.locator('#hidden-fixture').evaluate((node) => node.remove());
  for (const positioning of ['center', 'left', 'custom']) {
    await preference({ positioning });
    await page.setViewportSize({ width: 320, height: 900 });
    const bounds = await bar.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 320, `action bar fits at 320px (${positioning})`);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  const handle = await bar.locator('#drag-handle').boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 + 40, handle.y + handle.height / 2 - 40);
  await page.mouse.up();
  assert.equal(await page.evaluate(() => Number.isFinite(window.preferences.barPosition?.x) && Number.isFinite(window.preferences.barPosition?.y)), true, 'custom dragging persists coordinates');
  await preference({ callout: 0 });
  for (let step = 0; step < 7; step++) {
    await page.locator('#msfy-callout').waitFor({ state: 'visible' });
    await page.locator('#msfy-callout #next').click();
    assert.equal(await page.evaluate(() => window.preferences.callout), step + 1, 'tour advances and finishes');
  }
  if (nativeWrapper) {
    await page.evaluate(() => {
      window.preferences.blacklisted = true;
      window.preferences.handle = '@w-regner';
      chrome.storage.local.remove = async () => { throw new Error('Simulated storage failure'); };
    });
    await initialize();
    assert.equal(await wrappers.first().isVisible(), true, 'failed legacy-key cleanup does not block selection');
    assert.equal(await page.evaluate(() => window.preferences.blacklisted), true, 'storage failure fixture retains the retired key while the runtime ignores it');
  }
  assert.deepEqual(errors, []);
  console.log(`Feature checks passed (${nativeWrapper ? 'native' : 'Polymer'} wrappers): selection/ranges, shortcuts, moves, grouping, duplicates, filters, copy/paste, network failures, sorting, loading cancellation, export dialog, reloads, and theme.`);
  await context.close();
 }
} finally {
  await browser.close();
}
