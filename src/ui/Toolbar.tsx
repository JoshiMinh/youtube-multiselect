import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import type { SessionStore } from '../controller/session';
import type { ExportFormat } from '../core/export';

export function Toolbar({ store }: { store: SessionStore }) {
  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    menuRef.current?.querySelector('button')?.focus();
    const close = (event: Event) => {
      const path = event.composedPath();
      if (!path.includes(menuRef.current!) && !path.includes(buttonRef.current!)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', close, true);
    return () => document.removeEventListener('pointerdown', close, true);
  }, [menuOpen]);

  const closeMenu = () => {
    setMenuOpen(false);
    buttonRef.current?.focus();
  };
  const runExport = (action: () => void | Promise<void>) => {
    closeMenu();
    void action();
  };
  const download = (format: ExportFormat) => runExport(() => store.download(format));

  const hasSelection = snap.selected > 0;
  const countLabel = `${snap.selected} selected`;
  const detail = !snap.listFound
    ? 'Waiting for playlist…'
    : snap.selectedNotLoaded > 0
      ? `${snap.loaded} loaded · ${snap.selectedNotLoaded} selected not shown`
      : `${snap.loaded} loaded`;

  return (
    <div className="ytms-toolbar" data-theme={snap.theme} role="toolbar" aria-label="Playlist selection">
      <div className="ytms-count">
        <strong>{countLabel}</strong>
        <span className="ytms-detail">{detail}</span>
      </div>
      <button type="button" onClick={store.selectLoaded} disabled={snap.loaded === 0}>
        Select loaded
      </button>
      <button type="button" onClick={store.clear} disabled={!hasSelection}>
        Clear
      </button>
      <div className="ytms-menu-wrap">
        <button
          ref={buttonRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          disabled={!hasSelection}
          onClick={() => setMenuOpen((open) => !open)}
        >
          Export ▾
        </button>
        {menuOpen && (
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            className="ytms-menu"
            onKeyDown={(event) => {
              if (event.key === 'Escape') closeMenu();
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                const items = [...(menuRef.current?.querySelectorAll('button') ?? [])];
                // Inside a shadow root, document.activeElement is only the host.
                const root = menuRef.current?.getRootNode() as Document | ShadowRoot | undefined;
                const current = items.indexOf(root?.activeElement as HTMLButtonElement);
                const next = (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
                items[next]?.focus();
              }
            }}
          >
            <button type="button" role="menuitem" onClick={() => runExport(store.copyText)}>
              Copy titles and URLs
            </button>
            <button type="button" role="menuitem" onClick={() => download('csv')}>
              Download CSV
            </button>
            <button type="button" role="menuitem" onClick={() => download('json')}>
              Download JSON
            </button>
            <button type="button" role="menuitem" onClick={() => download('text')}>
              Download text
            </button>
          </div>
        )}
      </div>
      {snap.identity === 'positional' || snap.identity === 'mixed' ? (
        <span
          className="ytms-badge"
          title="Per-occurrence IDs were not available for some rows. Duplicate videos are told apart by their position, which changes if the playlist is reordered."
        >
          position-based IDs
        </span>
      ) : null}
      <span className="ytms-sr" aria-live="polite" role="status">
        {snap.notice ?? countLabel}
      </span>
      {snap.notice ? (
        <span className="ytms-notice" aria-hidden="true">
          {snap.notice}
        </span>
      ) : null}
    </div>
  );
}
