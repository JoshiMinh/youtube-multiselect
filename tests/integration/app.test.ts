import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { youtubeAdapter } from '@/src/adapters/youtube/adapter';
import { AppController } from '@/src/controller/app';
import { loadPlaylistPage, sampleRows } from '../fixtures/playlist';
import { checkedStates, clickRow, fakeToolbar, flush, rowHosts, timeoutSchedule } from './helpers';

let url = new URL('https://www.youtube.com/');
let enabled = true;
let enabledListener: ((value: boolean) => void) | null = null;
let app: AppController | null = null;

function navigate(to: string) {
  url = new URL(to);
  document.dispatchEvent(new CustomEvent('yt-navigate-finish'));
}

async function startApp() {
  const toolbar = fakeToolbar();
  app = new AppController({
    adapter: youtubeAdapter,
    doc: document,
    getUrl: () => url,
    isEnabled: async () => enabled,
    watchEnabled: (listener) => {
      enabledListener = listener;
      return () => (enabledListener = null);
    },
    mountToolbar: toolbar.mount,
    schedule: timeoutSchedule,
  });
  await app.start();
  await flush();
  return toolbar;
}

beforeEach(() => {
  document.body.innerHTML = '';
  url = new URL('https://www.youtube.com/');
  enabled = true;
});

afterEach(() => {
  app?.stop();
  app = null;
});

describe('AppController navigation lifecycle', () => {
  it('does nothing on non-playlist pages', async () => {
    const toolbar = await startApp();
    expect(app!.currentSession).toBeNull();
    expect(toolbar.mount).not.toHaveBeenCalled();
    expect(app!.status().page.kind).toBe('unsupported');
  });

  it('creates a session on SPA navigation into a playlist and tears it down when leaving', async () => {
    const toolbar = await startApp();
    loadPlaylistPage(document, 'PLa', sampleRows(3));
    navigate('https://www.youtube.com/playlist?list=PLa');
    await flush();
    expect(rowHosts()).toHaveLength(3);
    expect(toolbar.mount).toHaveBeenCalledTimes(1);

    navigate('https://www.youtube.com/watch?v=vid00000001&list=PLa');
    await flush();
    expect(app!.currentSession).toBeNull();
    expect(rowHosts()).toHaveLength(0);
    expect(toolbar.removed).toHaveBeenCalledTimes(1);
  });

  it('starts fresh, without duplicates or stale selection, on another playlist', async () => {
    const toolbar = await startApp();
    loadPlaylistPage(document, 'PLa', sampleRows(3));
    navigate('https://www.youtube.com/playlist?list=PLa');
    await flush();
    clickRow(0);
    const first = app!.currentSession;

    // YouTube reuses the playlist browse page and swaps its rows.
    loadPlaylistPage(document, 'PLb', sampleRows(2, 'oth'));
    navigate('https://www.youtube.com/playlist?list=PLb');
    await flush();

    expect(first!.isDisposed).toBe(true);
    expect(app!.currentSession).not.toBe(first);
    expect(rowHosts()).toHaveLength(2);
    expect(checkedStates()).toEqual([false, false]);
    expect(toolbar.mount).toHaveBeenCalledTimes(2);
    expect(toolbar.removed).toHaveBeenCalledTimes(1);
    expect(app!.status().session).toMatchObject({ playlistId: 'PLb', selected: 0 });
  });

  it('keeps selection on repeated navigate events for the same playlist', async () => {
    await startApp();
    loadPlaylistPage(document, 'PLa', sampleRows(2));
    navigate('https://www.youtube.com/playlist?list=PLa');
    await flush();
    clickRow(1);
    navigate('https://www.youtube.com/playlist?list=PLa');
    await flush();
    expect(rowHosts()).toHaveLength(2);
    expect(checkedStates()).toEqual([false, true]);
  });

  it('removes and restores controls when disabled and re-enabled', async () => {
    loadPlaylistPage(document, 'PLa', sampleRows(2));
    url = new URL('https://www.youtube.com/playlist?list=PLa');
    await startApp();
    expect(rowHosts()).toHaveLength(2);
    enabledListener!(false);
    await flush();
    expect(rowHosts()).toHaveLength(0);
    expect(app!.status()).toMatchObject({ enabled: false, session: null });
    enabledListener!(true);
    await flush();
    expect(rowHosts()).toHaveLength(2);
  });

  it('starts disabled when the stored setting is off', async () => {
    enabled = false;
    loadPlaylistPage(document, 'PLa', sampleRows(2));
    url = new URL('https://www.youtube.com/playlist?list=PLa');
    await startApp();
    expect(rowHosts()).toHaveLength(0);
  });

  it('stop() removes everything and ignores later navigation', async () => {
    loadPlaylistPage(document, 'PLa', sampleRows(2));
    url = new URL('https://www.youtube.com/playlist?list=PLa');
    await startApp();
    app!.stop();
    expect(rowHosts()).toHaveLength(0);
    expect(enabledListener).toBeNull();
    navigate('https://www.youtube.com/playlist?list=PLa');
    await flush();
    expect(rowHosts()).toHaveLength(0);
  });
});
