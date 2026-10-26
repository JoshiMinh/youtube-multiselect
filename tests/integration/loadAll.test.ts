import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlatformAdapter } from '@/src/adapters/types';
import { youtubeAdapter } from '@/src/adapters/youtube/adapter';
import { PageSession } from '@/src/controller/session';
import { createContinuation, loadPlaylistPage, sampleRows, type Layout } from '../fixtures/playlist';
import { checkedStates, clickRow, fakeToolbar, flush, rowHosts, timeoutSchedule } from './helpers';

const PL = 'PLload';
let session: PageSession | null = null;

afterEach(() => {
  session?.dispose();
  session = null;
});

/** Adapter whose "scroll into view" triggers a simulated continuation batch. */
function setup(total: number, layout: Layout, options: { batch?: number; respond?: boolean } = {}) {
  const all = sampleRows(total);
  const batch = options.batch ?? 100;
  loadPlaylistPage(document, PL, all.slice(0, batch), { layout, complete: total <= batch, expected: total, title: 'Long' });
  const next = createContinuation(document, PL, all, batch, layout);
  const requestMore = vi.fn((_c: HTMLElement, nudge?: boolean) => {
    if (!nudge && options.respond !== false) setTimeout(next, 0);
  });
  const adapter: PlatformAdapter = { ...youtubeAdapter, requestMore };
  const toolbar = fakeToolbar();
  session = new PageSession({
    adapter,
    doc: document,
    page: { kind: 'playlist', playlistId: PL, title: 'Long' },
    mountToolbar: toolbar.mount,
    schedule: timeoutSchedule,
    loadOptions: { pollMs: 2, stallMs: 60, settlePolls: 2 },
  });
  return { session, requestMore };
}

describe.each(['legacy', 'lockup'] as const)('PageSession.loadAll (%s)', (layout) => {
  it('loads every entry, keeps the selection and reports completion', async () => {
    const { session } = setup(1050, layout);
    await session.start();
    expect(session.getSnapshot()).toMatchObject({ loaded: 100, hasMore: true, expected: 1050, load: { status: 'idle' } });
    clickRow(0);
    clickRow(2, { shiftKey: true });

    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const states: string[] = [];
    session.subscribe(() => states.push(session.getSnapshot().load.status));
    await session.loadAll();
    await flush();

    expect(session.getSnapshot()).toMatchObject({
      loaded: 1050,
      hasMore: false,
      selected: 3,
      load: { status: 'done', loaded: 1050 },
      notice: 'All 1050 entries loaded.',
    });
    expect(states).toContain('loading');
    expect(rowHosts()).toHaveLength(1050);
    expect(checkedStates().filter(Boolean)).toHaveLength(3);
    expect(scrollTo).toHaveBeenCalledTimes(1);

    session.selectLoaded();
    expect(session.getSnapshot().selected).toBe(1050);
  });

  it('can be cancelled and keeps what was loaded', async () => {
    const { session } = setup(2000, layout);
    await session.start();
    session.subscribe(() => {
      const { load } = session.getSnapshot();
      if (load.status === 'loading' && load.loaded >= 300) session.cancelLoad();
    });
    await session.loadAll();
    const snap = session.getSnapshot();
    expect(snap.load.status).toBe('cancelled');
    expect(snap.loaded).toBeGreaterThanOrEqual(300);
    expect(snap.loaded).toBeLessThan(2000);
    expect(snap.hasMore).toBe(true);
    expect(snap.notice).toMatch(/^Loading cancelled at \d+\.$/);
  });

  it('reports a stall when YouTube stops sending rows', async () => {
    const { session, requestMore } = setup(500, layout, { respond: false });
    await session.start();
    await session.loadAll();
    expect(session.getSnapshot()).toMatchObject({ loaded: 100, load: { status: 'stalled', loaded: 100 } });
    expect(requestMore.mock.calls.some(([, nudge]) => nudge)).toBe(true);
  });

  it('ignores a second Load all while one is running', async () => {
    const { session } = setup(400, layout);
    await session.start();
    const first = session.loadAll();
    await session.loadAll();
    expect(session.getSnapshot().load.status).toBe('loading');
    await first;
    expect(session.getSnapshot().load.status).toBe('done');
  });

  it('stops loading when the session is disposed mid-load', async () => {
    const { session, requestMore } = setup(3000, layout);
    await session.start();
    const done = session.loadAll();
    await new Promise((r) => setTimeout(r, 10));
    session.dispose();
    await done;
    const calls = requestMore.mock.calls.length;
    await new Promise((r) => setTimeout(r, 30));
    expect(requestMore.mock.calls.length).toBe(calls);
    expect(rowHosts()).toHaveLength(0);
  });
});
