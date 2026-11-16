import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const bundle = await readFile('.output/chrome-mv3/polymer.js', 'utf8');
const catalog = async (locale) => Object.fromEntries(Object.entries(JSON.parse(await readFile(`src/_locales/${locale}/messages.json`, 'utf8'))).map(([key, value]) => [key, value.message]));
const contentSource = await readFile('entrypoints/content/index.ts', 'utf8');
const messageKeys = [...contentSource.match(/const MESSAGE_KEYS = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
const bridgeMessages = (catalog) => Object.fromEntries(messageKeys.map(key => [key, catalog[key] ?? '']));
const messages = bridgeMessages({ ...await catalog('en'), ...await catalog('ja') });
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://www.youtube.com/**', (route) => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="ja" dark><head><meta charset="utf-8"><style>
    html { --yt-spec-menu-background:#282828; --yt-spec-text-primary:#f1f1f1; --yt-spec-text-secondary:#aaa; --yt-spec-call-to-action:#3ea6ff; --yt-spec-10-percent-layer:rgba(255,255,255,.12); --primary-text-color:#f1f1f1; --paper-listbox-color:#f1f1f1; }
    body { margin:0; background:#0f0f0f; font:14px Arial,sans-serif; color:#f1f1f1; }
    .ytd-masthead { height:56px; display:flex; justify-content:flex-end; padding:0 24px; }
    #grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:16px; padding:24px; }
    yt-lockup-view-model { display:block; min-width:0; }
    yt-thumbnail-view-model { display:block; width:100%; aspect-ratio:16/9; background:#303030; border-radius:12px; }
    h3 { font-size:14px; } a { color:inherit; text-decoration:none; }
    yt-icon { display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; flex:none; }
    yt-icon-button { display:inline-flex; align-items:center; justify-content:center; cursor:pointer; }
    tp-yt-paper-tooltip { display:none; }
  </style></head><body><ytd-app><div id="end" class="ytd-masthead"></div><ytd-browse class="ytd-page-manager" role="main" page-subtype="playlist"><div id="grid"></div></ytd-browse><ytd-popup-container></ytd-popup-container></ytd-app></body></html>` }));
  await page.goto('https://www.youtube.com/playlist?list=fixture');
  await page.evaluate(() => {
    const make = (tag, attrs = {}, ...children) => {
      const node = document.createElement(tag);
      for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
      node.append(...children);
      return node;
    };
    for (let index = 0; index < 63; index++) document.querySelector('#grid').append(make('yt-lockup-view-model', {},
      make('a', { href: `/watch?v=${String(index).padStart(11, '0')}` }, make('yt-thumbnail-view-model')),
      make('h3', {}, `Video ${index + 1}`)));
    document.querySelector('ytd-browse').__data = { data: { header: { playlistHeaderRenderer: { playlistId: 'fixture', isEditable: true } } } };
    window.ytcfg = { get: (key) => key === 'LOGGED_IN' ? true : undefined };
    const nativePaths = {
      close:'m6 6 12 12m0-12L6 18', more_vert:'M12 5h.01M12 12h.01M12 19h.01',
      'icons:done':'m5 12 4 4L19 6', delete:'M5 6h14M8 6V4h8v2M7 6v14h10V6',
    };
    class Icon extends HTMLElement {
      static observedAttributes = ['icon'];
      connectedCallback() { this.render(); }
      attributeChangedCallback() { if (this.isConnected) this.render(); }
      render() {
        const icon = this.getAttribute('icon') || '';
        const source = document.getElementById(icon.split(':').at(-1));
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        for (const [key, value] of Object.entries({ viewBox:'0 0 24 24', width:'24', height:'24' })) svg.setAttribute(key, value);
        if (source?.localName === 'g') {
          const group = source.cloneNode(true); group.removeAttribute('id'); svg.append(group); svg.setAttribute('fill', 'currentColor');
        } else {
          const shape = document.createElementNS(svg.namespaceURI, 'path');
          shape.setAttribute('d', nativePaths[icon] || 'M5 12h14');
          shape.setAttribute('stroke', 'currentColor'); shape.setAttribute('stroke-width', '2'); shape.setAttribute('fill', 'none'); shape.setAttribute('stroke-linecap', 'round');
          svg.append(shape);
        }
        this.replaceChildren(svg);
      }
    }
    customElements.define('yt-icon', Icon);
    window.send = (type, value) => dispatchEvent(new CustomEvent('msfy-outer-message', { detail: JSON.stringify({type, value}) }));
  });
  await page.evaluate(bundle);
  await page.evaluate((messages) => { send('data', { messages }); send('options-changed', { callout:100, positioning:'center' }); }, messages);
  await page.locator('[id^="msfy-toggle-bar-button-"] > yt-icon-button').click();
  const boxes = page.locator('[id="msfy-video-checkbox"]');
  for (let index = 0; index < 5; index++) await boxes.nth(index).locator('..').click();
  const bar = page.locator('[id^="msfy-bar-"]');
  assert.equal(await bar.locator('#selection').textContent(), '5 / 63');
  const bounds = await bar.boundingBox();
  assert.ok(bounds.width < 300, `Japanese toolbar should fit its controls without fixed counter space (${bounds.width}px)`);
  await bar.screenshot({ path:'test-results/toolbar-compact-ja.png' });
  await bar.locator('#menu').click();
  const menuRoot = page.locator('#msfy-action-menu');
  const listbox = menuRoot.locator('#msfy-menu-list');
  // YouTube's generic listbox styling must not affect our menu geometry.
  await page.addStyleTag({content:'#listbox { display:flex; flex-direction:column; justify-content:space-between; min-height:1200px; }'});
  const geometry = await menuRoot.locator('[role="menuitem"]').evaluateAll((items) => items.map(item => ({height:item.closest(".msfy-popup-menu-item").querySelector(":scope > div").getBoundingClientRect().height, wrapper:item.closest(".msfy-popup-menu-item").getBoundingClientRect().height})));
  assert.ok(geometry.every(item => item.height === 36 && item.wrapper >= 36 && item.wrapper <= 54), `menu rows retain compact heights under host listbox styles: ${JSON.stringify(geometry)}`);
  let menuBounds = await listbox.boundingBox();
  let toolbarBounds = await bar.boundingBox();
  assert.ok(Math.abs(toolbarBounds.y - menuBounds.y - menuBounds.height - 8) < 1, 'menu leaves exactly eight pixels above the toolbar');
  assert.ok(Math.abs(menuBounds.x + menuBounds.width - toolbarBounds.x - toolbarBounds.width) < 1, 'menu aligns with the toolbar right edge');
  await page.setViewportSize({ width:1280, height:480 });
  await page.waitForFunction(() => {
    const menu = document.querySelector('#msfy-action-menu #msfy-menu-list').getBoundingClientRect();
    const toolbar = document.querySelector('[id^="msfy-bar-"]').getBoundingClientRect();
    return menu.top >= 7 && Math.abs(toolbar.top - menu.bottom - 8) < 1;
  });
  menuBounds = await listbox.boundingBox();
  toolbarBounds = await bar.boundingBox();
  assert.ok(menuBounds.y >= 7 && Math.abs(toolbarBounds.y - menuBounds.y - menuBounds.height - 8) < 1, 'tall menus fit above the toolbar in short windows');
  assert.equal(await listbox.evaluate((node) => node.scrollHeight > node.clientHeight), true, 'tall menu scrolls');
  await listbox.evaluate((node) => node.scrollTop = 80);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.ok(await listbox.evaluate((node) => node.scrollTop) >= 79, 'menu scrolling does not reset its scroll position');
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.ok(await listbox.evaluate((node) => node.scrollTop) >= 79, 'repositioning preserves menu scrolling');
  await listbox.evaluate((node) => node.scrollTop = 0);
  await page.screenshot({ path:'test-results/menu-toolbar-gap.png', clip:{
    x:Math.min(menuBounds.x, toolbarBounds.x), y:menuBounds.y,
    width:Math.max(menuBounds.x + menuBounds.width, toolbarBounds.x + toolbarBounds.width) - Math.min(menuBounds.x, toolbarBounds.x),
    height:toolbarBounds.y + toolbarBounds.height - menuBounds.y,
  } });
  await page.setViewportSize({ width:1280, height:900 });
  const moveIds = ['move-up', 'move-down', 'move-to-top', 'move-to-bottom'];
  const labels = [];
  for (const id of moveIds) {
    const item = page.locator(`#msfy-action-${id}`);
    assert.equal(await item.count(), 1);
    labels.push(await item.getAttribute('aria-label'));
    assert.equal(await item.locator('yt-icon svg path').count(), 1, 'each move action has a registered icon');
  }
  assert.deepEqual(labels, [messages.moveUp, messages.moveDown, messages.moveToTop, messages.moveToBottom]);
  assert.equal(new Set(labels).size, 4, 'all four move labels are distinct');
  assert.ok(await menuRoot.locator('.msfy-popup-menu-item').count() <= 17, 'compact main menu combines paired actions');
  await page.locator('#msfy-action-menu > #msfy-menu-list').screenshot({ path:'test-results/movement-menu-ja.png' });
  await page.locator('#msfy-action-select-filter').click();
  const filter = page.locator('#msfy-select-filter');
  const input = filter.locator('section > input');
  await filter.screenshot({ path:'test-results/filter-redesign-ja.png' });
  assert.equal(await filter.locator('#done').isDisabled(), true, 'empty patterns do not submit');
  await input.fill('[');
  await filter.locator('#done').click();
  assert.equal(await input.getAttribute('aria-invalid'), 'true');
  assert.equal(await filter.locator('[role=status]').textContent(), messages.invalidFilter);
  await filter.screenshot({ path:'test-results/filter-error-ja.png' });
  await input.fill('Video [1-3]$');
  await input.press('Enter');
  await page.waitForFunction(() => document.querySelector('#msfy-select-filter').dataset.state === 'success');
  assert.equal(await filter.locator('[role=status]').textContent(), messages.filterResult.replace('{count}', '3'));
  assert.equal(await page.locator('[id="msfy-video-checkbox"][checked]').count(), 5, 'filter matches are added without clearing existing selection');
  await filter.locator('#source-channel').check();
  await input.fill('Studio');
  await filter.locator('#source-title').check();
  assert.equal(await input.inputValue(), 'Video [1-3]$', 'each source retains its value');
  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height:900 });
    const rect = await filter.boundingBox();
    const toolbar = await bar.boundingBox();
    assert.ok(rect.x >= 0 && rect.x + rect.width <= width);
    assert.ok(toolbar.x >= 0 && toolbar.x + toolbar.width <= width);
    assert.equal(await filter.evaluate((node) => node.scrollWidth <= node.clientWidth), true, `filter fits ${width}px`);
  }
  await input.focus();
  await input.press('Escape');
  assert.equal(await filter.count(), 0);

  await bar.locator('#menu').click();
  assert.equal(await page.locator('#msfy-action-select-shorts, #msfy-action-select-videos').count(), 0);
  assert.equal(await menuRoot.locator('.msfy-menu-pair').count(), 5);
  assert.equal(await menuRoot.locator('[aria-haspopup]').count(), 0, 'all paired actions are directly accessible');
  for (const field of ['duration', 'date']) for (const direction of ['asc', 'desc']) {
    const action = page.locator(`#msfy-action-sort-${field}-${direction}`);
    assert.equal(await action.count(), 1);
    assert.ok((await action.getAttribute('aria-label')).trim(), 'sort label survives the content-script message bridge');
    assert.equal(await action.locator('yt-icon').getAttribute('icon'), `msfy:msfy-move-${direction === 'asc' ? 'up' : 'down'}`);
    assert.equal(await action.locator('yt-icon svg path').count(), 1);
  }
  assert.equal(await page.locator('#msfy-download-selection').count(), 1);
  assert.equal(await page.locator('#msfy-add-videos-from-file').count(), 1);
  const pairs = await menuRoot.locator('.msfy-menu-pair').evaluateAll(rows => rows.map(row => ({
    icon: !!row.querySelector(':scope > yt-icon svg path'),
    font: getComputedStyle(row).fontSize,
    buttons: [...row.querySelectorAll('button')].map(button => ({width:button.getBoundingClientRect().width,height:button.getBoundingClientRect().height,icon:!!button.querySelector('svg path')})),
  })));
  assert.ok(pairs.every(row => row.icon && row.font === '14px' && row.buttons.every(button => button.width === 32 && button.height === 32 && button.icon)), 'all paired rows have matching fonts, icons and button dimensions');
  await page.keyboard.press('Escape');

  await page.evaluate(() => send('options-changed', {barPosition:{x:20,y:20}, positioning:'custom'}));
  await bar.locator('#menu').click();
  await page.waitForFunction(() => document.querySelector('#msfy-action-menu')?.dataset.placement === 'below');
  menuBounds = await listbox.boundingBox(); toolbarBounds = await bar.boundingBox();
  assert.ok(Math.abs(menuBounds.y - toolbarBounds.y - toolbarBounds.height - 8) < 1, 'custom toolbar near the top opens below with an eight-pixel gap');
  await page.setViewportSize({width:320,height:600});
  await page.waitForFunction(() => { const box=document.querySelector('#msfy-action-menu #msfy-menu-list').getBoundingClientRect(); return box.left >= 7 && box.right <= innerWidth-7; });
  const items = menuRoot.locator('[role="menuitem"]');
  await items.first().focus();
  await page.keyboard.press('End');
  assert.equal(await items.last().evaluate((node) => node === document.activeElement), true, 'keyboard navigation stays in the detached menu');
  await page.keyboard.press('Escape');
  assert.equal(await menuRoot.count(), 0);
  await page.evaluate(() => send('options-changed', {positioning:'center'}));
  await page.setViewportSize({ width:320, height:900 });
  for (const locale of await readdir('src/_locales')) {
    const localized = { ...await catalog('en'), ...await catalog(locale) };
    await page.evaluate((messages) => send('data', { messages }), localized);
    await bar.locator('#menu').click();
    await page.locator('#msfy-action-select-filter').click();
    const localizedFilter = page.locator('#msfy-select-filter');
    assert.equal(await localizedFilter.evaluate((node) => node.scrollWidth <= node.clientWidth), true, `${locale}: filter fits without horizontal overflow`);
    assert.equal(await localizedFilter.locator('#done').textContent(), localized.filterApply);
    await localizedFilter.locator('#msfy-select-filter-close').click();
  }
  assert.deepEqual(errors, []);
  console.log('UI checks passed: eight-pixel menu anchoring, scrolling/flip/clamping, sort actions and removed type options, localized controls, and responsive layouts.');

  // Render the same production filter component in every visual state.
  const root = path.resolve('.');
  const servePreview = async (route) => {
    const file = path.resolve(root, '.' + new URL(route.request().url()).pathname);
    assert.ok(file.startsWith(root + path.sep));
    await route.fulfill({ body:await readFile(file), contentType:file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html' });
  };
  await page.route('https://preview.test/**', servePreview);
  await page.setViewportSize({ width:768, height:900 });
  await page.goto('https://preview.test/tests/fixtures/filter.preview.html');
  await page.locator('.preview .msfy-filter').last().waitFor();
  assert.equal(await page.locator('.preview .msfy-filter').count(), 8);
  await page.screenshot({ path:'test-results/filter-states.png', fullPage:true });
  assert.deepEqual(errors, []);
  const touch = await browser.newContext({ viewport:{width:375,height:900}, hasTouch:true });
  await touch.route('https://preview.test/**', servePreview);
  const touchPage = await touch.newPage();
  await touchPage.goto('https://preview.test/tests/fixtures/filter.preview.html');
  const touchFilter = touchPage.locator('.msfy-filter').first();
  await touchFilter.waitFor();
  assert.ok((await touchFilter.locator('#done').boundingBox()).height >= 44, 'touch apply target');
  assert.ok((await touchFilter.locator('.msfy-filter-icon').first().boundingBox()).height >= 44, 'touch close/help targets');
  await touch.close();
} finally {
  await browser.close();
}
