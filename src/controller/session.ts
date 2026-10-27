import type { EntryRow, IdentityKind, PageInfo, PlatformAdapter, PlaylistEntry, Theme } from '../adapters/types';
import { HOST_ATTR } from '../adapters/youtube/selectors';
import { buildExport, toText, type ExportFile, type ExportFormat } from '../core/export';
import { findDuplicates, matchesFilter, type TextFilter } from '../core/filter';
import { isSelectAll, navigate } from '../core/keyboard';
import { SelectionModel } from '../core/selection';
import { RowControl } from '../ui/rowControl';
import { loadAll, type LoadOptions, type LoadState } from './loadAll';

export type PlaylistPage = Extract<PageInfo, { kind: 'playlist' }>;
export type IdentitySummary = IdentityKind | 'mixed' | 'none';

export interface SessionSnapshot {
  playlistId: string;
  playlistTitle: string | null;
  loaded: number;
  selected: number;
  /** Selected entries whose rows are not currently rendered. */
  selectedNotLoaded: number;
  identity: IdentitySummary;
  theme: Theme;
  listFound: boolean;
  /** The site shows a "load more" sentinel: the list is not fully loaded. */
  hasMore: boolean;
  /** Entry count advertised by the site (approximate; may include unavailable videos). */
  expected: number | null;
  load: LoadState;
  /** Loaded entries that repeat an earlier video and can be acted on (occurrence identity). */
  duplicateExtras: number;
  /** Repeated entries that are reported only, because their identity is positional. */
  duplicatesBlocked: number;
  notice: string | null;
}

export interface SessionStore {
  getSnapshot(): SessionSnapshot;
  subscribe(listener: () => void): () => void;
  selectLoaded(): void;
  selectMatching(filter: TextFilter): void;
  selectDuplicates(): void;
  clear(): void;
  loadAll(): Promise<void>;
  cancelLoad(): void;
  copyText(): Promise<void>;
  download(format: ExportFormat): void;
}

export interface ToolbarHandle {
  remove(): void;
}

export interface SessionDeps {
  adapter: PlatformAdapter;
  doc: Document;
  page: PlaylistPage;
  mountToolbar(store: SessionStore): ToolbarHandle | Promise<ToolbarHandle>;
  writeClipboard?(text: string): Promise<void>;
  saveFile?(file: ExportFile): void;
  /** Batches DOM rescans; defaults to requestAnimationFrame. */
  schedule?(callback: () => void): () => void;
  /** How often to check that the observed list is still in the document. */
  livenessIntervalMs?: number;
  /** Overrides for the Load all loop (tests). */
  loadOptions?: LoadOptions;
}

const OBSERVE_ROWS: MutationObserverInit = { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] };

/**
 * Owns everything injected for one playlist page view. `dispose()` removes all
 * of it: observers, listeners, row controls, toolbar and state.
 */
export class PageSession implements SessionStore {
  readonly page: PlaylistPage;
  private readonly deps: SessionDeps;
  private readonly abort = new AbortController();
  private readonly selection = new SelectionModel();
  private readonly registry = new Map<string, PlaylistEntry>();
  private readonly controls = new Map<HTMLElement, RowControl>();
  private readonly listeners = new Set<() => void>();
  private order: string[] = [];
  private container: HTMLElement | null = null;
  private rowObserver: MutationObserver | null = null;
  private searchObserver: MutationObserver | null = null;
  private livenessTimer: ReturnType<typeof setInterval> | null = null;
  private cancelScheduled: (() => void) | null = null;
  private toolbar: ToolbarHandle | null = null;
  private theme: Theme = 'light';
  private notice: string | null = null;
  private hasMore = false;
  private expected: number | null = null;
  private load: LoadState = { status: 'idle' };
  private loadAbort: AbortController | null = null;
  private snapshot: SessionSnapshot;
  private disposed = false;

  constructor(deps: SessionDeps) {
    this.deps = deps;
    this.page = deps.page;
    this.snapshot = this.computeSnapshot();
    this.selection.subscribe(() => {
      this.notice = null;
      this.syncControls();
      this.publish();
    });
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  async start(): Promise<void> {
    const { adapter, doc } = this.deps;
    const signal = this.abort.signal;
    // Remove controls left behind by an earlier, invalidated script instance.
    doc.querySelectorAll(`[${HOST_ATTR}="row"]`).forEach((el) => el.remove());
    this.theme = adapter.watchTheme(
      doc,
      (theme) => {
        this.theme = theme;
        this.syncControls();
        this.publish();
      },
      signal,
    );
    doc.addEventListener('keydown', this.onDocumentKeyDown, { signal });
    this.scan();
    const toolbar = await this.deps.mountToolbar(this);
    if (this.disposed) toolbar.remove();
    else this.toolbar = toolbar;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.abort.abort();
    this.loadAbort?.abort();
    this.cancelScheduled?.();
    this.detachRows();
    this.searchObserver?.disconnect();
    this.searchObserver = null;
    for (const control of this.controls.values()) control.destroy();
    this.controls.clear();
    this.toolbar?.remove();
    this.toolbar = null;
    this.registry.clear();
    this.selection.clear();
    this.listeners.clear();
  }

  /** Re-read rows now (also called after same-page navigations). */
  scan(): void {
    if (this.disposed) return;
    const { adapter, doc } = this.deps;
    const container = adapter.findListContainer(doc);
    if (!container) {
      this.detachRows();
      this.waitForList();
      this.hasMore = false;
      this.publish();
      return;
    }
    if (container !== this.container) this.attachRows(container);

    adapter.requestIdentityRefresh?.(doc);
    const rows = adapter.readRows(container, this.page);
    this.reconcile(rows);
    this.hasMore = adapter.findContinuation(container, this.page) !== null;
    this.expected = adapter.readExpectedCount(doc);
    this.publish();
  }

  /**
   * Keep asking the site for more rows until the list is complete. The page
   * scrolls while loading; the original scroll position is restored after.
   */
  loadAll = async (): Promise<void> => {
    if (this.disposed || this.load.status === 'loading') return;
    const controller = new AbortController();
    this.loadAbort = controller;
    const view = this.deps.doc.defaultView;
    const startY = view?.scrollY ?? 0;
    const { adapter } = this.deps;
    const result = await loadAll(
      {
        loadedCount: () => {
          // Re-read directly: animation-frame scans pause in background tabs.
          this.scan();
          return this.order.length;
        },
        hasMore: () => Boolean(this.container && adapter.findContinuation(this.container, this.page)),
        requestMore: (nudge) => {
          const continuation = this.container && adapter.findContinuation(this.container, this.page);
          if (continuation) adapter.requestMore(continuation, nudge);
        },
        expectedCount: () => this.expected,
      },
      controller.signal,
      (state) => {
        this.load = state;
        this.publish();
      },
      this.deps.loadOptions,
    );
    if (this.loadAbort === controller) this.loadAbort = null;
    if (this.disposed) return;
    view?.scrollTo({ top: startY });
    this.scan();
    this.load = result;
    this.notice = loadNotice(result);
    this.publish();
  };

  cancelLoad = (): void => {
    this.loadAbort?.abort();
  };

  // --- SessionStore -------------------------------------------------------

  getSnapshot = (): SessionSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  selectLoaded = (): void => {
    this.selection.selectAll(this.order);
  };

  clear = (): void => {
    this.selection.clear();
  };

  /** Add loaded entries whose title or channel contains the query to the selection. */
  selectMatching = (filter: TextFilter): void => {
    if (filter.query.trim() === '') return this.setNotice('Type some text to filter by.');
    const matches = this.loadedEntries().filter((entry) => matchesFilter(entry, filter));
    this.selection.selectAll(matches.map((entry) => entry.key));
    const partial = this.hasMore ? ' Load all first to search the whole playlist.' : '';
    this.setNotice(
      matches.length === 0
        ? `No loaded entries match.${partial}`
        : `Matched ${matches.length} ${plural(matches.length, 'entry', 'entries')}.${partial}`,
    );
  };

  /** Add every repeat of an earlier video (keeping the first) to the selection. */
  selectDuplicates = (): void => {
    const { extras, blocked } = findDuplicates(this.loadedEntries());
    this.selection.selectAll(extras);
    const partial = this.hasMore ? ' Load all first to check the whole playlist.' : '';
    const skipped = blocked > 0 ? ` ${blocked} more skipped: their identity is position-based.` : '';
    this.setNotice(
      extras.length === 0 ? `No duplicates to select.${skipped}${partial}` : `Selected ${extras.length} ${plural(extras.length, 'duplicate', 'duplicates')}.${skipped}${partial}`,
    );
  };

  private loadedEntries(): PlaylistEntry[] {
    return this.order.map((key) => this.registry.get(key)).filter((entry): entry is PlaylistEntry => entry !== undefined);
  }

  selectedEntries(): PlaylistEntry[] {
    const loadedIndex = new Map(this.order.map((key, i) => [key, i]));
    return this.selection
      .keys()
      .map((key) => this.registry.get(key))
      .filter((entry): entry is PlaylistEntry => entry !== undefined)
      .sort((a, b) => sortValue(a, loadedIndex) - sortValue(b, loadedIndex));
  }

  copyText = async (): Promise<void> => {
    const entries = this.selectedEntries();
    if (entries.length === 0) return this.setNotice('Nothing selected to copy.');
    try {
      const write = this.deps.writeClipboard ?? ((text: string) => navigator.clipboard.writeText(text));
      await write(toText(entries));
      this.setNotice(`Copied ${entries.length} ${plural(entries.length, 'entry', 'entries')}.`);
    } catch {
      this.setNotice('Copy failed. Try a download instead.');
    }
  };

  download = (format: ExportFormat): void => {
    const entries = this.selectedEntries();
    if (entries.length === 0) return this.setNotice('Nothing selected to export.');
    const file = buildExport(format, entries, this.page.title ?? this.page.playlistId);
    (this.deps.saveFile ?? saveWithAnchor(this.deps.doc))(file);
    this.setNotice(`Exported ${entries.length} ${plural(entries.length, 'entry', 'entries')}.`);
  };

  // --- internals ----------------------------------------------------------

  private onToggle = (key: string, checked: boolean, range: boolean): void => {
    this.selection.click(key, checked, this.order, { range });
  };

  /** Arrow/Home/End move focus between rows; Ctrl+←/→ jump between selected rows. */
  private onRowKeyDown = (key: string, event: KeyboardEvent): void => {
    const target = navigate(event, key, this.order, (k) => this.selection.has(k));
    if (!target) return;
    event.preventDefault();
    if (target.kind === 'toggle-all') this.toggleAll();
    else this.focusKey(target.key);
  };

  /** Ctrl+A anywhere on the page, except while typing in a field. */
  private onDocumentKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || !isSelectAll(event) || this.order.length === 0) return;
    const origin = event.composedPath()[0];
    if (origin instanceof Element && origin.matches('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
    event.preventDefault();
    this.toggleAll();
  };

  /** Select every loaded entry, or clear the selection when they all already are. */
  private toggleAll(): void {
    if (this.order.length > 0 && this.order.every((key) => this.selection.has(key))) this.selection.clear();
    else this.selection.selectAll(this.order);
  }

  private focusKey(key: string): void {
    for (const [element, control] of this.controls) {
      if (control.currentKey !== key) continue;
      control.checkbox.focus();
      element.scrollIntoView?.({ block: 'nearest' });
      return;
    }
  }

  private reconcile(rows: EntryRow[]): void {
    const live = new Set<HTMLElement>();
    for (const { element, entry } of rows) {
      live.add(element);
      let control = this.controls.get(element);
      if (control) {
        const previous = this.registry.get(control.currentKey);
        // Same row, same video, better key (e.g. positional -> occurrence).
        if (control.currentKey !== entry.key && previous?.videoId === entry.videoId && !this.registry.has(entry.key)) {
          this.selection.rename(control.currentKey, entry.key);
          if (!this.selection.has(control.currentKey)) this.registry.delete(control.currentKey);
        }
      } else {
        control = new RowControl(this.deps.doc, entry, { onToggle: this.onToggle, onKeyDown: this.onRowKeyDown });
        this.controls.set(element, control);
      }
      this.registry.set(entry.key, entry);
      this.deps.adapter.placeControl(element, control.host);
      control.update(entry, this.selection.has(entry.key), this.theme);
    }
    for (const [element, control] of this.controls) {
      if (!live.has(element) || !element.isConnected) {
        control.destroy();
        this.controls.delete(element);
      }
    }
    this.order = rows.map((row) => row.entry.key);
    // Forget unselected entries that are no longer rendered.
    const loaded = new Set(this.order);
    for (const key of this.registry.keys()) {
      if (!loaded.has(key) && !this.selection.has(key)) this.registry.delete(key);
    }
  }

  private syncControls(): void {
    for (const control of this.controls.values()) {
      const entry = this.registry.get(control.currentKey);
      if (entry) control.update(entry, this.selection.has(entry.key), this.theme);
    }
  }

  private attachRows(container: HTMLElement): void {
    this.detachRows();
    this.searchObserver?.disconnect();
    this.searchObserver = null;
    this.container = container;
    this.rowObserver = new MutationObserver((records) => {
      if (records.some((record) => !isOwnMutation(record))) this.scheduleScan();
    });
    this.rowObserver.observe(container, OBSERVE_ROWS);
    // Removal of an ancestor is invisible to the row observer, so poll cheaply
    // instead of observing the whole document while attached.
    this.livenessTimer = setInterval(() => {
      if (this.container && !this.container.isConnected) this.scheduleScan();
    }, this.deps.livenessIntervalMs ?? 1000);
  }

  private detachRows(): void {
    this.rowObserver?.disconnect();
    this.rowObserver = null;
    if (this.livenessTimer !== null) clearInterval(this.livenessTimer);
    this.livenessTimer = null;
    this.container = null;
  }

  /** Watch for the list to render (or re-render after YouTube swaps it). */
  private waitForList(): void {
    if (this.searchObserver) return;
    const root = this.deps.doc.body ?? this.deps.doc.documentElement;
    this.searchObserver = new MutationObserver(() => this.scheduleScan());
    this.searchObserver.observe(root, { childList: true, subtree: true });
  }

  private scheduleScan(): void {
    if (this.disposed || this.cancelScheduled) return;
    const schedule = this.deps.schedule ?? scheduleFrame;
    this.cancelScheduled = schedule(() => {
      this.cancelScheduled = null;
      // A detached container means YouTube replaced the list element.
      if (this.container && !this.container.isConnected) this.detachRows();
      this.scan();
    });
  }

  private setNotice(message: string): void {
    this.notice = message;
    this.publish();
  }

  private computeSnapshot(): SessionSnapshot {
    const loadedKeys = new Set(this.order);
    const selectedKeys = this.selection.keys();
    const kinds = new Set(this.order.map((key) => this.registry.get(key)?.identity));
    let identity: IdentitySummary = 'none';
    if (kinds.size > 1) identity = 'mixed';
    else if (kinds.has('occurrence')) identity = 'occurrence';
    else if (kinds.has('positional')) identity = 'positional';
    const duplicates = findDuplicates(this.loadedEntries());
    return {
      playlistId: this.page.playlistId,
      playlistTitle: this.page.title,
      loaded: this.order.length,
      selected: selectedKeys.length,
      selectedNotLoaded: selectedKeys.filter((key) => !loadedKeys.has(key)).length,
      identity,
      theme: this.theme,
      listFound: this.container !== null,
      hasMore: this.hasMore,
      expected: this.expected,
      load: this.load,
      duplicateExtras: duplicates.extras.length,
      duplicatesBlocked: duplicates.blocked,
      notice: this.notice,
    };
  }

  private publish(): void {
    if (this.disposed) return;
    const next = this.computeSnapshot();
    if (shallowEqual(next, this.snapshot)) return;
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }
}

function isOwnMutation(record: MutationRecord): boolean {
  const ours = (node: Node) => node instanceof Element && node.hasAttribute(HOST_ATTR);
  if (record.type !== 'childList') return false;
  const nodes = [...record.addedNodes, ...record.removedNodes];
  return nodes.length > 0 && nodes.every(ours);
}

function sortValue(entry: PlaylistEntry, loadedIndex: Map<string, number>): number {
  return entry.position ?? loadedIndex.get(entry.key) ?? Number.MAX_SAFE_INTEGER;
}

function scheduleFrame(callback: () => void): () => void {
  const id = requestAnimationFrame(callback);
  return () => cancelAnimationFrame(id);
}

function saveWithAnchor(doc: Document) {
  return (file: ExportFile) => {
    const url = URL.createObjectURL(new Blob([file.content], { type: file.mimeType }));
    const anchor = doc.createElement('a');
    anchor.href = url;
    anchor.download = file.filename;
    anchor.setAttribute(HOST_ATTR, 'download');
    anchor.style.display = 'none';
    doc.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };
}

function loadNotice(state: LoadState): string | null {
  switch (state.status) {
    case 'done':
      return `All ${state.loaded} ${plural(state.loaded, 'entry', 'entries')} loaded.`;
    case 'cancelled':
      return `Loading cancelled at ${state.loaded}.`;
    case 'stalled':
      return `Loading stopped at ${state.loaded}: YouTube sent no more entries. Try again.`;
    case 'capped':
      return `Stopped at the ${state.cap}-entry limit.`;
    default:
      return null;
  }
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function shallowEqual<T extends object>(a: T, b: T): boolean {
  return (Object.keys(a) as (keyof T)[]).every((key) => Object.is(a[key], b[key]));
}
