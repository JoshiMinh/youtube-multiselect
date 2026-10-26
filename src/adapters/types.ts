/**
 * Contract between the platform-neutral controller and a site adapter.
 * Everything that knows about YouTube's markup or routing lives behind it.
 */

/**
 * How confidently an entry's key identifies one occurrence in a playlist.
 *
 * - `occurrence`: backed by a per-occurrence ID from the site (YouTube's
 *   `setVideoId`). Survives reordering and distinguishes duplicate videos.
 * - `positional`: derived from video ID + position. Distinguishes duplicates
 *   on a static page, but is not stable if the playlist is reordered or an
 *   earlier entry is removed. Must never be used to target writes.
 */
export type IdentityKind = 'occurrence' | 'positional';

export interface PlaylistEntry {
  /** Unique within a page session. */
  key: string;
  videoId: string;
  /** Per-occurrence ID when known (YouTube `setVideoId`). */
  occurrenceId: string | null;
  identity: IdentityKind;
  title: string;
  channel: string | null;
  /** 1-based position as shown by the site, when available. */
  position: number | null;
  url: string;
}

export interface EntryRow {
  element: HTMLElement;
  entry: PlaylistEntry;
}

export type PageInfo =
  | { kind: 'playlist'; playlistId: string; title: string | null }
  | { kind: 'unsupported'; reason: string };

export type Theme = 'light' | 'dark';

export interface PlatformAdapter {
  /** Classify the current page from its URL (and document, when needed). */
  detectPage(url: URL, doc: Document): PageInfo;
  /** The element whose subtree contains the entry rows, if rendered yet. */
  findListContainer(doc: Document): HTMLElement | null;
  /** Read all rendered rows, in display order. */
  readRows(container: HTMLElement, page: Extract<PageInfo, { kind: 'playlist' }>): EntryRow[];
  /** Insert a control host into a row so it sits before the row's content. */
  placeControl(row: HTMLElement, host: HTMLElement): void;
  /** Call `listener` after each client-side navigation until `signal` aborts. */
  onNavigate(doc: Document, listener: () => void, signal: AbortSignal): void;
  /** Current theme plus change notifications until `signal` aborts. */
  watchTheme(doc: Document, listener: (theme: Theme) => void, signal: AbortSignal): Theme;
  /** Ask the page to refresh per-occurrence identity data (optional). */
  requestIdentityRefresh?(doc: Document): void;
}

/**
 * Future write boundary. Declared so the controller can be designed against
 * it; intentionally unimplemented in the read-only prototype.
 * See docs/ROADMAP.md for the reliability requirements.
 */
export interface PlaylistGateway {
  listEntries(playlistId: string, signal: AbortSignal): Promise<PlaylistEntry[]>;
  addVideo(playlistId: string, videoId: string, signal: AbortSignal): Promise<{ occurrenceId: string | null }>;
  removeOccurrence(playlistId: string, occurrenceId: string, signal: AbortSignal): Promise<void>;
}
