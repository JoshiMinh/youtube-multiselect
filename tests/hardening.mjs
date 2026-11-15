import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const polymer = await readFile('.output/chrome-mv3/polymer.js', 'utf8');
const catalog = JSON.parse(await readFile('src/_locales/en/messages.json', 'utf8'));
const messages = Object.fromEntries(Object.entries(catalog).map(([key, entry]) => [key, entry.message]));
const malicious = '<img src=x onerror="window.injected=true">';
const browser = await chromium.launch({ headless: true });
try {
  for (const mode of ['strict', 'site-policy', 'no-api']) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const policy = mode === 'site-policy' ? 'trusted-types default' : "trusted-types 'none'";
    const csp = mode === 'no-api' ? '' : `require-trusted-types-for 'script'; ${policy}`;
    await page.route('**/*', (route) => route.fulfill({
      contentType: 'text/html', headers: csp ? { 'content-security-policy': csp } : {},
      body: `<!doctype html><html><head><meta charset="utf-8"><style>
        #grid { display:flex; gap:16px; align-items:flex-start; }
        ytd-rich-item-renderer { display:block; width:200px; }
        yt-lockup-view-model, ytm-shorts-lockup-view-model-v2, ytm-shorts-lockup-view-model { display:block; }
        yt-thumbnail-view-model { display:block; width:100%; height:112px; }
        .shortsLockupViewModelHostThumbnailContainer { width:100%; height:356px; }
        ytd-playlist-video-renderer { display:block; position:relative; width:200px; height:120px; }
      </style></head><body><ytd-app><div id="end" class="ytd-masthead"></div>
        <ytd-browse class="ytd-page-manager" role="main" page-subtype="playlist"><div id="grid"></div></ytd-browse>
        <ytd-popup-container></ytd-popup-container></ytd-app></body></html>`,
    }));
    await page.goto('https://www.youtube.com/playlist?list=fixture');
    await page.evaluate(({ mode, malicious }) => {
      if (mode === 'no-api') Object.defineProperty(window, 'trustedTypes', { value: undefined, configurable: true });
      if (mode === 'site-policy') {
        window.defaultCalls = 0;
        window.sitePolicy = trustedTypes.createPolicy('default', { createHTML: (value) => { window.defaultCalls++; return value; } });
      }
      window.violations = [];
      document.addEventListener('securitypolicyviolation', (event) => window.violations.push(event.violatedDirective));
      window.ytcfg = { get: (key) => key === 'LOGGED_IN' ? true : undefined };
      window.card = (key, id, short = false) => {
        const parent = document.createElement('ytd-rich-item-renderer');
        parent.dataset.key = key;
        const row = document.createElement(short ? 'ytm-shorts-lockup-view-model-v2' : 'yt-lockup-view-model');
        const content = short ? document.createElement('ytm-shorts-lockup-view-model') : row;
        const link = document.createElement('a');
        link.href = short ? `/shorts/${id}` : `/watch?v=${id}`;
        const thumbnail = document.createElement(short ? 'div' : 'yt-thumbnail-view-model');
        if (short) thumbnail.className = 'shortsLockupViewModelHostThumbnailContainer';
        const title = document.createElement('h3');
        title.textContent = malicious;
        link.append(thumbnail);
        content.append(link, title);
        if (short) row.append(content);
        parent.append(row);
        return parent;
      };
      const grid = document.querySelector('#grid');
      grid.append(window.card('a', 'aaaaaaaaaaa', true), window.card('b', 'bbbbbbbbbbb'), window.card('c', 'aaaaaaaaaaa', true));
      const native = document.createElement('ytd-playlist-video-renderer');
      const index = document.createElement('span');
      index.id = 'index'; index.textContent = '4'; native.append(index);
      native.data = { videoId: 'ddddddddddd', isPlayable: true };
      grid.append(native);
      const template = document.createElement('template');
      template.content.append(document.createElement('div'));
      class Legacy extends HTMLElement {}
      Legacy.generatedFrom = { _template: template };
      customElements.define('ytd-playlist-video-renderer', Legacy);
      window.legacyTemplate = template;
      document.querySelector('ytd-browse').__data = { data: { header: { playlistHeaderRenderer: { playlistId: 'fixture', isEditable: true } } } };
      window.send = (type, value) => window.dispatchEvent(new CustomEvent('msfy-outer-message', { detail: JSON.stringify({ type, value }) }));
    }, { mode, malicious });
    const boot = async () => {
      await page.evaluate(polymer);
      await page.evaluate(({ messages, malicious }) => {
        window.send('data', { messages: { ...messages, extensionName: malicious, confirmRemoveContent: malicious, onboardingTitle: malicious } });
        window.send('options-changed', { callout: 100, showVideoIndex: false });
      }, { messages, malicious });
      await page.locator('[id^="msfy-toggle-bar-button-"] > yt-icon-button').waitFor();
    };
    await boot();
    const toggle = page.locator('[id^="msfy-toggle-bar-button-"] > yt-icon-button');
    const badges = page.locator('.msfy-playlist-index');
    const box = page.locator('[data-key="b"] [id="msfy-video-checkbox"]');
    await box.evaluate((checkbox) => checkbox.setAttribute('aria-describedby', 'existing-description'));
    const dimensions = await page.locator('[data-key="b"]').boundingBox();
    await page.evaluate(() => window.send('options-changed', { showVideoIndex: true }));
    await page.waitForFunction(() => document.querySelectorAll('.msfy-playlist-index').length === 3);
    assert.deepEqual(await badges.allTextContents(), ['1', '2', '3']);
    assert.deepEqual(await page.locator('[data-key="b"]').boundingBox(), dimensions, 'indexes do not alter card layout');
    assert.equal(await page.locator('ytd-playlist-video-renderer .msfy-playlist-index').count(), 0, 'legacy index is reused');
    assert.equal(await page.locator('ytd-playlist-video-renderer #index').textContent(), '4');
    await page.mouse.move(1200, 800);
    assert.equal(await badges.first().isVisible(), false, 'index is hidden outside hover/focus/selection');
    await page.locator('[data-key="a"]').hover();
    assert.equal(await badges.first().isVisible(), true);
    await page.mouse.move(1200, 800);
    await page.locator('[data-key="b"] a').focus();
    assert.equal(await page.locator('[data-key="b"] .msfy-playlist-index').isVisible(), true, 'keyboard focus exposes the index');
    const aria = await box.getAttribute('aria-describedby');
    assert.ok(aria.startsWith('existing-description '));
    assert.equal(await page.locator(`#${aria.split(' ').at(-1)}`).textContent(), 'Playlist position 2');

    await toggle.click();
    assert.equal(await badges.evaluateAll((nodes) => nodes.every((node) => getComputedStyle(node).visibility === 'visible')), true);
    await box.locator('..').click();
    if (mode === 'strict') await page.screenshot({ path: 'test-results/playlist-indexes.png' });
    const menu = page.locator('[id^="msfy-bar-"] #menu');
    await menu.click();
    await page.locator('#msfy-action-remove-videos').click();
    assert.equal(await page.locator('dialog[open] section').textContent(), malicious);
    await page.locator('dialog[open] #cancel').click();
    await menu.click();
    await page.locator('#msfy-action-select-filter').click();
    await page.locator('#msfy-select-filter section > input').fill('[');
    await page.locator('#msfy-select-filter #done').click();
    await page.locator('#msfy-select-filter-close').click();
    await menu.click();
    await page.locator('#msfy-download-selection').click();
    await page.locator('dialog[open] #cancel').click();
    await page.evaluate(() => window.send('options-changed', { callout: 0 }));
    await page.locator('#msfy-callout').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#msfy-callout strong').textContent(), malicious);
    await page.locator('#msfy-callout #skip').click();
    assert.equal(await page.locator('img, script').count(), 0, 'markup-like text is never parsed');
    assert.equal(await page.evaluate(() => window.injected === true), false);

    await page.evaluate(() => {
      const grid = document.querySelector('#grid');
      grid.insertBefore(window.card('new', 'eeeeeeeeeee'), grid.querySelector('ytd-playlist-video-renderer'));
      grid.prepend(grid.querySelector('[data-key="c"]'));
    });
    await page.waitForFunction(() => document.querySelector('[data-key="c"] .msfy-playlist-index')?.textContent === '1' && document.querySelectorAll('.msfy-playlist-index').length === 4);
    assert.deepEqual(await badges.allTextContents(), ['1', '2', '3', '4']);
    await page.locator('[data-key="a"]').evaluate((row) => row.remove());
    await page.waitForFunction(() => document.querySelectorAll('.msfy-playlist-index').length === 3 && document.querySelector('[data-key="b"] .msfy-playlist-index').textContent === '2');
    await page.locator('[data-key="c"]').evaluate((row) => row.hidden = true);
    await page.waitForFunction(() => !document.querySelector('[data-key="c"] .msfy-playlist-index') && document.querySelector('[data-key="b"] .msfy-playlist-index').textContent === '1');
    await page.locator('[data-key="c"]').evaluate((row) => row.hidden = false);
    await page.waitForFunction(() => document.querySelectorAll('.msfy-playlist-index').length === 3);
    await page.locator('[data-key="b"] a').evaluate((link) => link.href = '/watch?v=zzzzzzzzzzz');
    await page.waitForFunction(() => document.querySelectorAll('[data-key="b"] .msfy-playlist-index').length === 1);
    assert.equal(await page.locator('[data-key="b"] .msfy-playlist-index').textContent(), '2', 'recycled renderer keeps one current-view index');
    await page.evaluate(() => {
      document.querySelectorAll('[data-key="b"], [data-key="new"], ytd-playlist-video-renderer').forEach((row) => row.hidden = true);
    });
    await page.waitForFunction(() => document.querySelectorAll('.msfy-playlist-index').length === 1);
    assert.deepEqual(await badges.allTextContents(), ['1'], 'Shorts-only view numbers its own loaded items');
    await page.evaluate(() => document.querySelectorAll('[hidden]').forEach((row) => row.hidden = false));
    await page.waitForFunction(() => document.querySelectorAll('.msfy-playlist-index').length === 3);
    await page.evaluate(() => { history.pushState({}, '', '/feed/subscriptions'); document.dispatchEvent(new Event('yt-navigate-finish')); });
    await page.waitForFunction(() => document.querySelectorAll('.msfy-playlist-index').length === 0);
    await page.evaluate(() => { history.pushState({}, '', '/playlist?list=fixture'); document.dispatchEvent(new Event('yt-navigate-finish')); });
    await page.waitForFunction(() => document.querySelectorAll('.msfy-playlist-index').length === 3);
    await page.setViewportSize({ width: 320, height: 900 });
    const badgeBox = await page.locator('[data-key="c"] .msfy-playlist-index').boundingBox();
    const cardBox = await page.locator('[data-key="c"]').boundingBox();
    assert.ok(badgeBox.x >= cardBox.x && badgeBox.x + badgeBox.width <= cardBox.x + cardBox.width);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(() => window.send('options-changed', { showVideoIndex: false }));
    await page.waitForFunction(() => document.querySelectorAll('.msfy-playlist-index').length === 0);
    assert.equal(await box.getAttribute('aria-describedby'), 'existing-description', 'disabling removes only our accessibility reference');
    assert.equal(await page.locator('[data-key="b"] > yt-lockup-view-model').evaluate((row) => row.style.position), '', 'temporary positioning is restored');
    await toggle.click();
    await page.evaluate(() => window.send('options-changed', { showVideoIndex: true }));
    await page.waitForFunction(() => document.querySelectorAll('.msfy-playlist-index').length === 3);
    await toggle.click();
    await toggle.click();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-key="b"] > yt-lockup-view-model')).position === 'relative');
    await page.evaluate(() => window.send('destroy'));
    assert.equal(await badges.count(), 0);
    assert.equal(await box.count(), 0, 'destroy removes checkbox wrappers');
    assert.equal(await page.evaluate(() => [...window.legacyTemplate.content.children].filter((child) => child.localName.startsWith('msfy-wrapper-')).length), 0, 'teardown removes template wrappers');
    await boot();
    assert.equal(await toggle.count(), 1);
    assert.equal(await page.evaluate(() => [...window.legacyTemplate.content.children].filter((child) => child.localName.startsWith('msfy-wrapper-')).length), 1, 'reinjection adds only one template wrapper');
    assert.deepEqual(errors, []);
    assert.deepEqual(await page.evaluate(() => window.violations), []);
    if (mode === 'site-policy') {
      assert.equal(await page.evaluate(() => trustedTypes.defaultPolicy === window.sitePolicy), true);
      assert.equal(await page.evaluate(() => window.defaultCalls), 0, 'the extension never uses the site default policy');
    } else if (mode === 'strict') assert.equal(await page.evaluate(() => trustedTypes.defaultPolicy), null);
    console.log(`Hardening/index checks passed: ${mode}.`);
    await context.close();
  }
} finally {
  await browser.close();
}
