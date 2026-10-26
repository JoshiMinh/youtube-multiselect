import type { EntryRow, IdentityKind, PageInfo, PlatformAdapter, PlaylistEntry, Theme } from '../adapters/types';
import { HOST_ATTR } from '../adapters/youtube/selectors';
import { buildExport, toText, type ExportFile, type ExportFormat } from '../core/export';
import { SelectionModel } from '../core/selection';
import { RowControl } from '../ui/rowControl';

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
  notice: string | null;
}

export interface SessionStore {
  getSnapshot(): SessionSnapshot;
  subscribe(listener: () => void): () => void;
  selectLoaded(): void;
  clear(): void;
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
    this.scan();
    const toolbar = await this.deps.mountToolbar(this);
    if (this.disposed) toolbar.remove();
    else this.toolbar = toolbar;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.abort.abort();
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
      this.publish();
      return;
    }
    if (container !== this.container) this.attachRows(container);

    adapter.requestIdentityRefresh?.(doc);
    const rows = adapter.readRows(container, this.page);
    this.reconcile(rows);
    this.publish();
  }

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
        control = new RowControl(this.deps.doc, entry, { onToggle: this.onToggle });
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
    return {
      playlistId: this.page.playlistId,
      playlistTitle: this.page.title,
      loaded: this.order.length,
      selected: selectedKeys.length,
      selectedNotLoaded: selectedKeys.filter((key) => !loadedKeys.has(key)).length,
      identity,
      theme: this.theme,
      listFound: this.container !== null,
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

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function shallowEqual<T extends object>(a: T, b: T): boolean {
  return (Object.keys(a) as (keyof T)[]).every((key) => Object.is(a[key], b[key]));
}
