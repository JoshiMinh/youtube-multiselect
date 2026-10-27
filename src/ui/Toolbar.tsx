import { createContext, useContext, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { SessionStore } from '../controller/session';
import type { ExportFormat } from '../core/export';

/** Close `onClose` on outside pointer-down. `inside` lists the elements that count as inside. */
function useDismissOutside(active: boolean, inside: () => (HTMLElement | null)[], onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const close = (event: Event) => {
      const path = event.composedPath();
      if (!inside().some((el) => el && path.includes(el))) onClose();
    };
    document.addEventListener('pointerdown', close, true);
    return () => document.removeEventListener('pointerdown', close, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}

const MenuClose = createContext<() => void>(() => {});

function MenuItem({ onSelect, disabled, title, children }: { onSelect: () => void | Promise<void>; disabled?: boolean; title?: string; children: ReactNode }) {
  const close = useContext(MenuClose);
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      title={title}
      onClick={() => {
        close();
        void onSelect();
      }}
    >
      {children}
    </button>
  );
}

function Menu({
  label,
  buttonLabel,
  disabled,
  children,
}: {
  label: ReactNode;
  buttonLabel?: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, [open]);
  useDismissOutside(open, () => [menuRef.current, buttonRef.current], () => setOpen(false));

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div className="ytms-menu-wrap">
      <button
        ref={buttonRef}
        type="button"
        aria-label={buttonLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
      </button>
      {open && (
        <div
          ref={menuRef}
          id={id}
          role="menu"
          className="ytms-menu"
          onKeyDown={(event) => {
            if (event.key === 'Escape') close();
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
              // Inside a shadow root, document.activeElement is only the host.
              const root = menuRef.current?.getRootNode() as Document | ShadowRoot | undefined;
              const current = items.indexOf(root?.activeElement as HTMLButtonElement);
              const next = (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
              items[next]?.focus();
            }
          }}
        >
          <MenuClose.Provider value={close}>{children}</MenuClose.Provider>
        </div>
      )}
    </div>
  );
}

/** Stop keystrokes reaching YouTube's page-level shortcuts (e.g. "k", "f", "/"). */
const isolateKeys = {
  onKeyDown: (event: { stopPropagation(): void }) => event.stopPropagation(),
  onKeyUp: (event: { stopPropagation(): void }) => event.stopPropagation(),
  onKeyPress: (event: { stopPropagation(): void }) => event.stopPropagation(),
};

function FilterPopover({ store, onClose }: { store: SessionStore; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const hintId = useId();

  useEffect(() => inputRef.current?.focus(), []);

  const apply = () => store.selectMatching({ query, caseSensitive });

  return (
    <div
      role="dialog"
      aria-labelledby={titleId}
      className="ytms-popover"
      {...isolateKeys}
      onKeyDown={(event) => {
        isolateKeys.onKeyDown(event);
        if (event.key === 'Escape') onClose();
      }}
    >
      <div className="ytms-popover-head">
        <strong id={titleId}>Select with filter</strong>
        <button type="button" aria-label="Close filter" onClick={onClose}>
          ✕
        </button>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          apply();
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder="Title or channel contains…"
          aria-label="Filter text"
          aria-describedby={hintId}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit" disabled={query.trim() === ''}>
          Select
        </button>
      </form>
      <label className="ytms-check">
        <input type="checkbox" checked={caseSensitive} onChange={(event) => setCaseSensitive(event.target.checked)} />
        Case sensitive
      </label>
      <span id={hintId} className="ytms-detail">
        Adds matching loaded entries to the selection.
      </span>
    </div>
  );
}

export function Toolbar({ store }: { store: SessionStore }) {
  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  useDismissOutside(filterOpen, () => [filterRef.current], () => setFilterOpen(false));

  const download = (format: ExportFormat) => () => store.download(format);

  const hasSelection = snap.selected > 0;
  const countLabel = `${snap.selected} selected`;
  const loading = snap.load.status === 'loading' ? snap.load : null;
  const of = snap.expected !== null ? ` of ~${snap.expected}` : '';
  const detail = !snap.listFound
    ? 'Waiting for playlist…'
    : snap.selectedNotLoaded > 0
      ? `${snap.loaded}${of} loaded · ${snap.selectedNotLoaded} selected not shown`
      : `${snap.loaded}${snap.hasMore ? of : ''} loaded`;
  const duplicateCount = snap.duplicateExtras + snap.duplicatesBlocked;

  return (
    <div className="ytms-toolbar" data-theme={snap.theme} role="toolbar" aria-label="Playlist selection">
      <div className="ytms-count">
        <strong>{countLabel}</strong>
        <span className="ytms-detail">{detail}</span>
      </div>
      {loading ? (
        <div className="ytms-progress">
          <progress
            aria-label="Loading playlist entries"
            value={loading.loaded}
            max={loading.expected !== null && loading.expected >= loading.loaded ? loading.expected : undefined}
          />
          <span className="ytms-detail" aria-hidden="true">
            Loading {loading.loaded}
            {loading.expected !== null ? ` / ~${loading.expected}` : ''}…
          </span>
          <button type="button" onClick={store.cancelLoad}>
            Cancel
          </button>
        </div>
      ) : snap.hasMore ? (
        <button type="button" onClick={() => void store.loadAll()} title="Scroll through the playlist until every entry is loaded">
          Load all
        </button>
      ) : null}
      <button type="button" onClick={store.selectLoaded} disabled={snap.loaded === 0}>
        Select loaded
      </button>
      <button type="button" onClick={store.clear} disabled={!hasSelection}>
        Clear
      </button>
      <Menu label="Export ▾" disabled={!hasSelection}>
        <MenuItem onSelect={store.copyText}>Copy titles and URLs</MenuItem>
        <MenuItem onSelect={download('csv')}>Download CSV</MenuItem>
        <MenuItem onSelect={download('json')}>Download JSON</MenuItem>
        <MenuItem onSelect={download('text')}>Download text</MenuItem>
      </Menu>
      <Menu label="⋮" buttonLabel="More selection tools" disabled={snap.loaded === 0}>
        <MenuItem
          onSelect={store.selectDuplicates}
          disabled={snap.duplicateExtras === 0}
          title={
            snap.duplicatesBlocked > 0 && snap.duplicateExtras === 0
              ? 'Duplicates were found, but their identity is position-based, so they are not offered.'
              : 'Select every repeat of an earlier video, keeping the first'
          }
        >
          Select duplicates{duplicateCount > 0 ? ` (${snap.duplicateExtras})` : ''}
        </MenuItem>
        <MenuItem onSelect={() => setFilterOpen(true)}>Select with filter…</MenuItem>
      </Menu>
      {filterOpen && (
        <div ref={filterRef} className="ytms-popover-anchor">
          <FilterPopover store={store} onClose={() => setFilterOpen(false)} />
        </div>
      )}
      {snap.identity === 'positional' || snap.identity === 'mixed' ? (
        <span
          className="ytms-badge"
          title="Per-occurrence IDs were not available for some rows. Duplicate videos are told apart by their position, which changes if the playlist is reordered."
        >
          position-based IDs
        </span>
      ) : null}
      <span className="ytms-sr" aria-live="polite" role="status">
        {snap.notice ?? (loading ? `Loading, ${loading.loaded} loaded` : countLabel)}
      </span>
      {snap.notice ? (
        <span className="ytms-notice" aria-hidden="true">
          {snap.notice}
        </span>
      ) : null}
    </div>
  );
}
