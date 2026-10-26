import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { youtubeAdapter } from '@/src/adapters/youtube/adapter';
import { YT } from '@/src/adapters/youtube/selectors';
import { PageSession } from '@/src/controller/session';
import type { ExportFile } from '@/src/core/export';
import { appendRows, loadPlaylistPage, sampleRows, type FixtureRow } from '../fixtures/playlist';
import { checkedStates, clickRow, fakeToolbar, flush, rowHosts, timeoutSchedule } from './helpers';

const PL = 'PLsession';
const page = { kind: 'playlist' as const, playlistId: PL, title: 'Fixture' };

function createSession(overrides: Partial<ConstructorParameters<typeof PageSession>[0]> = {}) {
  const toolbar = fakeToolbar();
  const session = new PageSession({
    adapter: youtubeAdapter,
    doc: document,
    page,
    mountToolbar: toolbar.mount,
    schedule: timeoutSchedule,
    livenessIntervalMs: 1,
    ...overrides,
  });
  return { session, toolbar };
}

let active: PageSession | null = null;

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  active?.dispose();
  active = null;
});

describe.each(['legacy', 'lockup'] as const)('PageSession (%s layout)', (layout) => {
  const load = (rows: FixtureRow[]) => loadPlaylistPage(document, PL, rows, { layout });

  it('injects exactly one accessible checkbox per row, idempotently', async () => {
    load(sampleRows(3));
    const { session } = createSession();
    active = session;
    await session.start();
    session.scan();
    session.scan();
    await flush();
    const hosts = rowHosts();
    expect(hosts).toHaveLength(3);
    expect(hosts.map((h) => h.shadowRoot!.querySelector('input')!.getAttribute('aria-label'))).toEqual([
      'Select: Video 1',
      'Select: Video 2',
      'Select: Video 3',
    ]);
    for (const row of document.querySelectorAll(YT.row)) {
      expect(row.querySelectorAll('[data-ytms-host]')).toHaveLength(1);
    }
  });

  it('supports click, Shift-click ranges, select loaded and clear', async () => {
    load(sampleRows(6));
    const { session } = createSession();
    active = session;
    await session.start();

    clickRow(1);
    clickRow(4, { shiftKey: true });
    expect(checkedStates()).toEqual([false, true, true, true, true, false]);
    expect(session.getSnapshot().selected).toBe(4);

    session.clear();
    expect(checkedStates().some(Boolean)).toBe(false);

    session.selectLoaded();
    expect(session.getSnapshot()).toMatchObject({ selected: 6, loaded: 6 });
  });

  it('treats Shift+Space on a focused checkbox as a range selection', async () => {
    load(sampleRows(4));
    const { session } = createSession();
    active = session;
    await session.start();
    clickRow(0);
    const input = rowHosts()[2]!.shadowRoot!.querySelector('input')!;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', shiftKey: true, bubbles: true }));
    input.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(checkedStates()).toEqual([true, true, true, false]);
  });

  it('does not let checkbox clicks reach YouTube row handlers', async () => {
    load(sampleRows(1));
    const { session } = createSession();
    active = session;
    await session.start();
    const rowHandler = vi.fn();
    document.querySelector(YT.row)!.addEventListener('click', rowHandler);
    clickRow(0);
    expect(rowHandler).not.toHaveBeenCalled();
  });

  it('keeps selection stable and adds controls when more rows load', async () => {
    load(sampleRows(3));
    const { session } = createSession();
    active = session;
    await session.start();
    clickRow(0);
    clickRow(2);

    const more = sampleRows(5).slice(3);
    appendRows(document, PL, more, 4, layout);
    await flush();

    expect(rowHosts()).toHaveLength(5);
    expect(checkedStates()).toEqual([true, false, true, false, false]);
    clickRow(4, { shiftKey: true });
    expect(checkedStates()).toEqual([true, false, true, true, true]);
    expect(session.getSnapshot()).toMatchObject({ loaded: 5, selected: 4 });
  });

  it('treats duplicate occurrences of one video independently', async () => {
    load([
      { videoId: 'dupdupdupdu', title: 'Same', setVideoId: 'S1' },
      { videoId: 'other000000', title: 'Other', setVideoId: 'S2' },
      { videoId: 'dupdupdupdu', title: 'Same', setVideoId: 'S3' },
    ]);
    const { session } = createSession();
    active = session;
    await session.start();
    clickRow(2);
    expect(checkedStates()).toEqual([false, false, true]);
    expect(session.selectedEntries().map((e) => e.occurrenceId)).toEqual(['S3']);
  });

  it('upgrades positional keys to occurrence keys without losing selection', async () => {
    load([
      { videoId: 'aaaaaaaaaaa', title: 'A' },
      { videoId: 'bbbbbbbbbbb', title: 'B' },
    ]);
    const { session } = createSession();
    active = session;
    await session.start();
    clickRow(1);
    expect(session.getSnapshot().identity).toBe('positional');

    const rows = document.querySelectorAll(YT.row);
    ['S1', 'S2'].forEach((id, i) => {
      rows[i]!.setAttribute('data-ytms-set-video-id', id);
      rows[i]!.setAttribute('data-ytms-video-id', i === 0 ? 'aaaaaaaaaaa' : 'bbbbbbbbbbb');
    });
    session.scan();
    expect(session.getSnapshot().identity).toBe('occurrence');
    expect(session.selectedEntries().map((e) => e.key)).toEqual(['o:S2']);
    expect(checkedStates()).toEqual([false, true]);
  });

  it('re-attaches when YouTube replaces the list container', async () => {
    load(sampleRows(2));
    const { session } = createSession();
    active = session;
    await session.start();
    clickRow(0);
    // Re-render the whole page with the same entries plus one more.
    load(sampleRows(3));
    await new Promise((resolve) => setTimeout(resolve, 20));
    await flush();
    expect(rowHosts()).toHaveLength(3);
    expect(checkedStates()).toEqual([true, false, false]);
  });

  it('waits for the list to appear', async () => {
    const { session } = createSession();
    active = session;
    await session.start();
    expect(session.getSnapshot().listFound).toBe(false);
    load(sampleRows(2));
    await flush();
    expect(session.getSnapshot()).toMatchObject({ listFound: true, loaded: 2 });
  });

  it('dispose removes controls, toolbar, observers and timers', async () => {
    load(sampleRows(2));
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    const clear = vi.spyOn(globalThis, 'clearInterval');
    const { session, toolbar } = createSession();
    await session.start();
    expect(toolbar.mount).toHaveBeenCalledTimes(1);
    session.dispose();
    expect(rowHosts()).toHaveLength(0);
    expect(toolbar.removed).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalled();
    expect(clear).toHaveBeenCalled();

    // Further DOM changes must not resurrect controls.
    appendRows(document, PL, sampleRows(3).slice(2), 3, layout);
    await flush();
    expect(rowHosts()).toHaveLength(0);
  });

  it('removes a toolbar that finished mounting after dispose', async () => {
    load(sampleRows(1));
    const removed = vi.fn();
    let resolveMount!: (handle: { remove(): void }) => void;
    const { session } = createSession({ mountToolbar: () => new Promise((resolve) => (resolveMount = resolve)) });
    const started = session.start();
    session.dispose();
    resolveMount({ remove: removed });
    await started;
    expect(removed).toHaveBeenCalledTimes(1);
  });

  it('exports selected entries in playlist order without touching the page', async () => {
    load(sampleRows(4));
    const saved: ExportFile[] = [];
    const clipboard = vi.fn(async (_text: string) => {});
    const { session } = createSession({ saveFile: (f) => saved.push(f), writeClipboard: clipboard });
    active = session;
    await session.start();
    const before = document.body.innerHTML;
    clickRow(3);
    clickRow(1);
    session.download('csv');
    await session.copyText();
    expect(saved[0]!.filename).toMatch(/^Fixture-.*\.csv$/);
    expect(saved[0]!.content).toContain('2,Video 2');
    expect(saved[0]!.content.indexOf('Video 2')).toBeLessThan(saved[0]!.content.indexOf('Video 4'));
    expect(clipboard.mock.calls[0]![0]).toBe(
      'Video 2\thttps://www.youtube.com/watch?v=vid00000002\nVideo 4\thttps://www.youtube.com/watch?v=vid00000004',
    );
    expect(session.getSnapshot().notice).toBe('Copied 2 entries.');
    // Only our checkbox state changed; no YouTube markup was modified.
    expect(document.body.innerHTML).toBe(before);
  });

  it('follows YouTube theme changes', async () => {
    load(sampleRows(1));
    const { session } = createSession();
    active = session;
    await session.start();
    expect(rowHosts()[0]!.getAttribute('data-theme')).toBe('light');
    document.documentElement.setAttribute('dark', '');
    await flush();
    expect(rowHosts()[0]!.getAttribute('data-theme')).toBe('dark');
    expect(session.getSnapshot().theme).toBe('dark');
  });
});
