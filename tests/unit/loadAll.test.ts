import { describe, expect, it, vi } from 'vitest';
import { loadAll, type LoadPort, type LoadState } from '@/src/controller/loadAll';

/**
 * A simulated site on a virtual clock: each request is answered with one
 * batch after `latencyMs`, until `total` entries are loaded.
 */
function fakeSite(opts: { total: number; batch?: number; initial?: number; latencyMs?: number; respondAfterNudgeOnly?: boolean; expected?: number | null }) {
  const { total, batch = 100, latencyMs = 500 } = opts;
  let loaded = opts.initial ?? Math.min(batch, total);
  let clock = 0;
  let pendingAt: number | null = null;
  let nudged = false;
  const requestMore = vi.fn((nudge: boolean) => {
    if (nudge) {
      nudged = true;
      return;
    }
    if (opts.respondAfterNudgeOnly && !nudged) return;
    pendingAt ??= clock + latencyMs;
  });
  const port: LoadPort = {
    loadedCount: () => loaded,
    hasMore: () => loaded < total,
    requestMore,
    expectedCount: () => opts.expected ?? total,
  };
  const sleep = async (ms: number, signal: AbortSignal) => {
    if (signal.aborted) throw signal.reason;
    clock += ms;
    if (pendingAt !== null && clock >= pendingAt) {
      loaded = Math.min(total, loaded + batch);
      pendingAt = null;
    }
  };
  return { port, requestMore, options: { sleep, now: () => clock, pollMs: 250, stallMs: 4000 } };
}

describe('loadAll', () => {
  it('requests batches until the sentinel disappears', async () => {
    const site = fakeSite({ total: 1234 });
    const progress: LoadState[] = [];
    const result = await loadAll(site.port, new AbortController().signal, (s) => progress.push(s), site.options);
    expect(result).toEqual({ status: 'done', loaded: 1234 });
    const counts = progress.map((s) => (s.status === 'loading' ? s.loaded : -1));
    expect(counts[0]).toBe(100);
    expect(counts.at(-1)).toBe(1234);
    expect([...counts].sort((a, b) => a - b)).toEqual(counts); // monotonic
    expect(progress.every((s) => s.status === 'loading' && s.expected === 1234)).toBe(true);
  });

  it('finishes immediately for an already complete list', async () => {
    const site = fakeSite({ total: 50 });
    const result = await loadAll(site.port, new AbortController().signal, () => {}, site.options);
    expect(result).toEqual({ status: 'done', loaded: 50 });
    expect(site.requestMore).not.toHaveBeenCalled();
  });

  it('stops promptly when cancelled and keeps what loaded', async () => {
    const site = fakeSite({ total: 5000 });
    const controller = new AbortController();
    const result = await loadAll(
      site.port,
      controller.signal,
      (s) => {
        if (s.status === 'loading' && s.loaded >= 300) controller.abort();
      },
      site.options,
    );
    expect(result).toEqual({ status: 'cancelled', loaded: 300 });
    const calls = site.requestMore.mock.calls.length;
    await Promise.resolve();
    expect(site.requestMore.mock.calls.length).toBe(calls);
  });

  it('reports a stall when the site stops responding, after one nudge', async () => {
    const site = fakeSite({ total: 500, latencyMs: Number.POSITIVE_INFINITY });
    const result = await loadAll(site.port, new AbortController().signal, () => {}, site.options);
    expect(result).toEqual({ status: 'stalled', loaded: 100 });
    expect(site.requestMore.mock.calls.filter(([nudge]) => nudge)).toHaveLength(1);
  });

  it('recovers when a nudge re-triggers loading', async () => {
    const site = fakeSite({ total: 300, respondAfterNudgeOnly: true });
    const result = await loadAll(site.port, new AbortController().signal, () => {}, site.options);
    expect(result).toEqual({ status: 'done', loaded: 300 });
  });

  it('stops at the cap', async () => {
    const site = fakeSite({ total: 10_000 });
    const result = await loadAll(site.port, new AbortController().signal, () => {}, { ...site.options, cap: 1000 });
    expect(result).toEqual({ status: 'capped', loaded: 1000, cap: 1000 });
  });

  it('does not finish early when the sentinel briefly disappears between batches', async () => {
    let loaded = 100;
    let polls = 0;
    const port: LoadPort = {
      loadedCount: () => loaded,
      // Sentinel missing for one poll while the next batch renders.
      hasMore: () => loaded < 300 && polls % 4 !== 1,
      requestMore: () => {},
      expectedCount: () => null,
    };
    const result = await loadAll(port, new AbortController().signal, () => {}, {
      settlePolls: 3,
      now: () => polls * 250,
      sleep: async () => {
        polls++;
        if (polls % 4 === 0) loaded = Math.min(300, loaded + 100);
      },
    });
    expect(result).toEqual({ status: 'done', loaded: 300 });
  });
});
