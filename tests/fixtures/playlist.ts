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
  const list =
    layout === 'lockup'
      ? `<ytd-two-column-browse-results-renderer><div id="primary"><yt-section-list-renderer><div class="ytSectionListRendererContents">
           <yt-item-section-renderer><div id="contents">${items}<div><yt-continuation-item-view-model></yt-continuation-item-view-model></div></div></yt-item-section-renderer>
         </div></yt-section-list-renderer></div></ytd-two-column-browse-results-renderer>`
      : `<ytd-playlist-video-list-renderer><div id="contents">${items}<ytd-continuation-item-renderer></ytd-continuation-item-renderer></div></ytd-playlist-video-list-renderer>`;
  return `
    <ytd-app>
      <ytd-page-manager id="page-manager">
        <ytd-browse hidden page-subtype="home"><div id="contents"></div></ytd-browse>
        <ytd-browse page-subtype="playlist">
          <h1>${escapeText(options.title ?? 'Fixture playlist')}</h1>
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

/** Append rows the way a continuation load does: before the spinner. */
export function appendRows(doc: Document, playlistId: string, rows: FixtureRow[], startPosition: number, layout: Layout = 'legacy'): void {
  const spinner =
    layout === 'lockup'
      ? doc.querySelector('ytd-browse:not([hidden]) yt-continuation-item-view-model')!.parentElement!
      : doc.querySelector('ytd-browse:not([hidden]) ytd-continuation-item-renderer')!;
  const template = doc.createElement('template');
  template.innerHTML = rows.map((row, i) => rowHtml(row, startPosition + i, playlistId, layout)).join('');
  spinner.parentElement!.insertBefore(template.content, spinner);
}

export function sampleRows(count: number, prefix = 'vid'): FixtureRow[] {
  return Array.from({ length: count }, (_, i) => ({
    videoId: `${prefix}${String(i + 1).padStart(8, '0')}`.slice(0, 11),
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
