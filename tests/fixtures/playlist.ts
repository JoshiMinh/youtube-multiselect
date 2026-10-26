/**
 * Hand-written, minimal approximations of YouTube's two desktop playlist
 * layouts. Only the elements the adapter reads are modelled; this is not
 * copied from YouTube and must be re-checked against the live site
 * (`npm run test:live`) when selectors change.
 */
export type Layout = 'legacy' | 'lockup';

export interface FixtureRow {
  videoId: string;
  title: string;
  channel?: string;
  /** YouTube's per-occurrence ID, pre-applied as the MAIN-world bridge would. */
  setVideoId?: string;
  /** Override the playlist ID in the row link (simulates stale rows). */
  list?: string;
}

export interface PageOptions {
  title?: string;
  dark?: boolean;
  layout?: Layout;
  /** Advertised count shown in the header ("N videos"); defaults to rows.length. */
  expected?: number;
  /** Render without a continuation sentinel (list fully loaded). Default true. */
  complete?: boolean;
}

export function rowHtml(row: FixtureRow, position: number, playlistId: string, layout: Layout = 'legacy'): string {
  const list = row.list ?? playlistId;
  const href = `/watch?v=${row.videoId}&amp;list=${list}&amp;index=${position}&amp;pp=abc`;
  const bridge = row.setVideoId ? ` data-ytms-set-video-id="${row.setVideoId}" data-ytms-video-id="${row.videoId}"` : '';
  const channel = escapeText(row.channel ?? 'Some Channel');
  if (layout === 'lockup') {
    return `
    <div><yt-lockup-view-model class="ytLockupViewModelWrapper"${bridge}>
      <div class="ytLockupViewModelHost ytLockupViewModelHorizontal content-id-${row.videoId}">
        <a class="ytLockupViewModelContentImage" href="${href}" tabindex="-1" aria-hidden="true"></a>
        <div class="ytLockupViewModelMetadata"><yt-lockup-metadata-view-model>
          <h3 title="${escapeAttr(row.title)}"><a class="ytLockupMetadataViewModelTitle" href="${href}"><span>${escapeText(row.title)}</span></a></h3>
          <yt-content-metadata-view-model><div class="ytContentMetadataViewModelMetadataRow"><span><a href="/@channel">${channel}</a></span></div></yt-content-metadata-view-model>
        </yt-lockup-metadata-view-model></div>
      </div>
    </yt-lockup-view-model></div>`;
  }
  return `
    <ytd-playlist-video-renderer class="style-scope ytd-playlist-video-list-renderer"${bridge}>
      <div id="index-container"><yt-formatted-string id="index">${position}</yt-formatted-string></div>
      <div id="content">
        <a id="thumbnail" href="${href}"></a>
        <div id="meta">
          <h3><a id="video-title" title="${escapeAttr(row.title)}" href="${href}">${escapeText(row.title)}</a></h3>
          <ytd-channel-name><div id="text-container"><a href="/@channel">${channel}</a></div></ytd-channel-name>
        </div>
      </div>
    </ytd-playlist-video-renderer>`;
}

export function playlistPageHtml(playlistId: string, rows: FixtureRow[], options: PageOptions = {}): string {
  const layout = options.layout ?? 'legacy';
  const items = rows.map((row, i) => rowHtml(row, i + 1, playlistId, layout)).join('');
  const count = `Playlist•${(options.expected ?? rows.length).toLocaleString('en-US')} videos•1,234 views`;
  const more = options.complete === false;
  const list =
    layout === 'lockup'
      ? `<yt-page-header-renderer><h1>${escapeText(options.title ?? 'Fixture playlist')}</h1><div class="ytContentMetadataViewModelMetadataRow">${count}</div></yt-page-header-renderer>
         <ytd-two-column-browse-results-renderer><div id="primary"><yt-section-list-renderer><div class="ytSectionListRendererContents">
           <yt-item-section-renderer><div id="contents">${items}${more ? '<div><yt-continuation-item-view-model></yt-continuation-item-view-model></div>' : ''}</div></yt-item-section-renderer>
           <!-- Section-list continuation for content after the playlist (seen live even when the list is complete). -->
           <yt-continuation-item-view-model></yt-continuation-item-view-model>
         </div></yt-section-list-renderer></div></ytd-two-column-browse-results-renderer>`
      : `<ytd-playlist-header-renderer><h1>${escapeText(options.title ?? 'Fixture playlist')}</h1><ytd-playlist-byline-renderer>${count}</ytd-playlist-byline-renderer></ytd-playlist-header-renderer>
         <ytd-playlist-video-list-renderer><div id="contents">${items}${more ? '<ytd-continuation-item-renderer></ytd-continuation-item-renderer>' : ''}</div></ytd-playlist-video-list-renderer>`;
  return `
    <ytd-app>
      <ytd-page-manager id="page-manager">
        <ytd-browse hidden page-subtype="home"><div id="contents"></div></ytd-browse>
        <ytd-browse page-subtype="playlist">
          ${list}
        </ytd-browse>
      </ytd-page-manager>
    </ytd-app>`;
}

/** Install a fixture page into `doc` (for happy-dom tests). */
export function loadPlaylistPage(doc: Document, playlistId: string, rows: FixtureRow[], options: PageOptions = {}): void {
  doc.title = `${options.title ?? 'Fixture playlist'} - YouTube`;
  doc.documentElement.toggleAttribute('dark', options.dark ?? false);
  doc.body.innerHTML = playlistPageHtml(playlistId, rows, options);
}

/** Append rows the way a continuation load does: before the spinner, if any. */
export function appendRows(doc: Document, playlistId: string, rows: FixtureRow[], startPosition: number, layout: Layout = 'legacy'): void {
  const contents = doc.querySelector(
    layout === 'lockup'
      ? 'ytd-browse:not([hidden]) yt-item-section-renderer #contents'
      : 'ytd-browse:not([hidden]) ytd-playlist-video-list-renderer #contents',
  )!;
  const spinner = continuationOf(contents, layout);
  const template = doc.createElement('template');
  template.innerHTML = rows.map((row, i) => rowHtml(row, startPosition + i, playlistId, layout)).join('');
  contents.insertBefore(template.content, spinner);
}

/** The direct child of `contents` that holds the continuation sentinel. */
function continuationOf(contents: Element, layout: Layout): Element | null {
  const sentinel = contents.querySelector('ytd-continuation-item-renderer, yt-continuation-item-view-model');
  return sentinel && layout === 'lockup' ? sentinel.parentElement : sentinel;
}

/**
 * Simulate YouTube's continuation: each call appends the next batch, and
 * removes the sentinel after the last one. Returns whether rows were added.
 */
export function createContinuation(doc: Document, playlistId: string, all: FixtureRow[], batch: number, layout: Layout = 'legacy') {
  return (): boolean => {
    const contents = doc.querySelector(
      layout === 'lockup'
        ? 'ytd-browse:not([hidden]) yt-item-section-renderer #contents'
        : 'ytd-browse:not([hidden]) ytd-playlist-video-list-renderer #contents',
    )!;
    const loaded = contents.querySelectorAll('ytd-playlist-video-renderer, yt-lockup-view-model').length;
    const next = all.slice(loaded, loaded + batch);
    if (next.length > 0) appendRows(doc, playlistId, next, loaded + 1, layout);
    if (loaded + next.length >= all.length) continuationOf(contents, layout)?.remove();
    return next.length > 0;
  };
}

/**
 * Inline script for e2e fixture pages that mimics YouTube's continuation:
 * when the sentinel becomes visible, append the next batch after `delayMs`.
 */
export function continuationScript(playlistId: string, all: FixtureRow[], batch: number, delayMs: number, layout: Layout = 'legacy'): string {
  const rowsHtml = all.map((row, i) => rowHtml(row, i + 1, playlistId, layout));
  return `<script>(() => {
    const rows = ${JSON.stringify(rowsHtml)};
    const contentsSel = ${JSON.stringify(layout === 'lockup' ? 'yt-item-section-renderer #contents' : 'ytd-playlist-video-list-renderer #contents')};
    const rowSel = 'ytd-playlist-video-renderer, yt-lockup-view-model';
    const sentinelSel = 'ytd-continuation-item-renderer, yt-continuation-item-view-model';
    window.__ytmsContinuationRequests = 0;
    let busy = false;
    const io = new IntersectionObserver((entries) => {
      if (busy || !entries.some((e) => e.isIntersecting)) return;
      busy = true;
      window.__ytmsContinuationRequests++;
      setTimeout(() => {
        const contents = document.querySelector(contentsSel);
        const sentinel = contents.querySelector(sentinelSel);
        const holder = ${layout === 'lockup' ? 'sentinel.parentElement' : 'sentinel'};
        const loaded = contents.querySelectorAll(rowSel).length;
        const t = document.createElement('template');
        t.innerHTML = rows.slice(loaded, loaded + ${batch}).join('');
        contents.insertBefore(t.content, holder);
        if (loaded + ${batch} >= rows.length) { io.disconnect(); holder.remove(); }
        busy = false;
      }, ${delayMs});
    });
    const start = () => io.observe(document.querySelector(sentinelSel));
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  })();</script>`;
}

export function sampleRows(count: number, prefix = 'vid'): FixtureRow[] {
  return Array.from({ length: count }, (_, i) => ({
    videoId: `${prefix}${String(i + 1).padStart(11 - prefix.length, '0')}`,
    title: `Video ${i + 1}`,
    setVideoId: `SET${prefix.toUpperCase()}${i + 1}`,
  }));
}

function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function escapeAttr(value: string): string {
  return escapeText(value).replaceAll('"', '&quot;');
}
