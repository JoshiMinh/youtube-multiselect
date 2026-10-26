/**
 * Drives a site's incremental list loading until the list is complete,
 * cancelled, capped, or stops making progress. Site specifics stay behind
 * `LoadPort`; timing is injectable so tests run on fake timers.
 */
export type LoadState =
  | { status: 'idle' }
  | { status: 'loading'; loaded: number; expected: number | null }
  | { status: 'done'; loaded: number }
  | { status: 'cancelled'; loaded: number }
  | { status: 'stalled'; loaded: number }
  | { status: 'capped'; loaded: number; cap: number };

export interface LoadPort {
  /** Entries currently loaded (after re-reading the page). */
  loadedCount(): number;
  /** Whether the site still shows a "load more" sentinel. */
  hasMore(): boolean;
  /** Ask for the next batch; `nudge` retries after a pause in progress. */
  requestMore(nudge: boolean): void;
  expectedCount(): number | null;
}

export interface LoadOptions {
  /** How often to check progress. */
  pollMs?: number;
  /** Give up after this long without new entries while more are advertised. */
  stallMs?: number;
  /** Stop after this many entries (YouTube playlists hold at most 5,000). */
  cap?: number;
  /** Consecutive polls without a sentinel before the list counts as complete. */
  settlePolls?: number;
  now?: () => number;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
}

export async function loadAll(
  port: LoadPort,
  signal: AbortSignal,
  onProgress: (state: LoadState) => void,
  options: LoadOptions = {},
): Promise<LoadState> {
  const { pollMs = 250, stallMs = 12_000, cap = 5000, settlePolls = 3, now = Date.now, sleep = abortableSleep } = options;

  let loaded = port.loadedCount();
  let lastProgressAt = now();
  let nudged = false;
  let emptyPolls = 0;
  onProgress({ status: 'loading', loaded, expected: port.expectedCount() });

  while (true) {
    if (signal.aborted) return { status: 'cancelled', loaded };
    if (loaded >= cap) return { status: 'capped', loaded, cap };

    if (port.hasMore()) {
      emptyPolls = 0;
      const waited = now() - lastProgressAt;
      if (waited >= stallMs) return { status: 'stalled', loaded };
      // Halfway to a stall, retry once in a way that re-triggers the site's loader.
      const nudge = !nudged && waited >= stallMs / 2;
      if (nudge) nudged = true;
      port.requestMore(nudge);
    } else if (++emptyPolls >= settlePolls) {
      return { status: 'done', loaded: port.loadedCount() };
    }

    try {
      await sleep(pollMs, signal);
    } catch {
      return { status: 'cancelled', loaded };
    }

    const count = port.loadedCount();
    if (count > loaded) {
      loaded = count;
      lastProgressAt = now();
      nudged = false;
      onProgress({ status: 'loading', loaded, expected: port.expectedCount() });
    }
  }
}

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const id = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(id);
      reject(signal.reason);
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
