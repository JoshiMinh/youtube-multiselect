/**
 * Every YouTube DOM name the extension depends on, in one place, so markup
 * changes are fixed here rather than across the codebase.
 *
 * YouTube currently serves two desktop playlist layouts:
 * - legacy: `ytd-playlist-video-renderer` rows in `ytd-playlist-video-list-renderer`
 * - lockup: `yt-lockup-view-model` rows in a `yt-section-list-renderer`
 *   (observed signed-out on 2026-10-26)
 */
export const YT = {
  /** Candidate list containers, most specific first. Hidden browse pages are YouTube's page cache. */
  listContainers: [
    'ytd-browse:not([hidden]) ytd-playlist-video-list-renderer #contents',
    'ytd-browse[page-subtype="playlist"]:not([hidden]) #primary yt-section-list-renderer',
  ],
  row: 'ytd-playlist-video-renderer, yt-lockup-view-model',
  /** Horizontal flex row inside a lockup; controls go here so they sit beside the thumbnail. */
  lockupInner: ':scope > .ytLockupViewModelHost',
  titleLink: 'a#video-title, a.ytLockupMetadataViewModelTitle',
  /** Elements carrying the full title in a `title` attribute. */
  titleAttr: 'a#video-title[title], h3[title]',
  channelLink: 'ytd-channel-name a, #channel-name a, .ytContentMetadataViewModelMetadataRow a',
  index: '#index',
  /** Fired by YouTube's SPA router once a navigation has rendered. */
  navigateFinishEvent: 'yt-navigate-finish',
  /** Present on <html> when YouTube's dark theme is active. */
  darkAttribute: 'dark',
} as const;

/** Attributes written by our MAIN-world bridge (entrypoints/youtube-bridge.ts). */
export const BRIDGE = {
  occurrenceAttr: 'data-ytms-set-video-id',
  videoAttr: 'data-ytms-video-id',
  refreshEvent: 'ytms:refresh-identity',
} as const;

/** Marker on every element this extension injects into YouTube's DOM. */
export const HOST_ATTR = 'data-ytms-host';
