import { beforeEach, describe, expect, it, vi } from 'vitest';
import { detectYouTubePage, youtubeAdapter } from '@/src/adapters/youtube/adapter';
import { BRIDGE } from '@/src/adapters/youtube/selectors';
import { loadPlaylistPage } from '../fixtures/playlist';

const PL = 'PLfixture1';
const page = { kind: 'playlist' as const, playlistId: PL, title: null };

describe('detectYouTubePage', () => {
  it('recognises desktop playlist pages', () => {
    document.title = 'Road trip - YouTube';
    expect(detectYouTubePage(new URL(`https://www.youtube.com/playlist?list=${PL}`), document)).toEqual({
      kind: 'playlist',
      playlistId: PL,
      title: 'Road trip',
    });
  });

  it.each([
    'https://www.youtube.com/watch?v=abc&list=PL1',
    'https://www.youtube.com/playlist',
    'https://m.youtube.com/playlist?list=PL1',
    'https://www.youtube.com/',
  ])('rejects %s', (url) => {
    expect(detectYouTubePage(new URL(url), document).kind).toBe('unsupported');
  });
});

describe('youtubeAdapter rows', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('reads rows with occurrence identity, title, channel and position', () => {
    loadPlaylistPage(document, PL, [
      { videoId: 'aaaaaaaaaaa', title: 'First', channel: 'Chan', setVideoId: 'S1' },
      { videoId: 'bbbbbbbbbbb', title: 'Second', setVideoId: 'S2' },
    ]);
    const rows = youtubeAdapter.readRows(youtubeAdapter.findListContainer(document)!, page);
    expect(rows.map((r) => r.entry)).toEqual([
      expect.objectContaining({ key: 'o:S1', videoId: 'aaaaaaaaaaa', title: 'First', channel: 'Chan', position: 1, identity: 'occurrence' }),
      expect.objectContaining({ key: 'o:S2', position: 2, url: 'https://www.youtube.com/watch?v=bbbbbbbbbbb' }),
    ]);
  });

  it('distinguishes duplicate videos by occurrence ID', () => {
    loadPlaylistPage(document, PL, [
      { videoId: 'dupdupdupdu', title: 'Dup', setVideoId: 'S1' },
      { videoId: 'dupdupdupdu', title: 'Dup', setVideoId: 'S2' },
    ]);
    const keys = youtubeAdapter.readRows(youtubeAdapter.findListContainer(document)!, page).map((r) => r.entry.key);
    expect(keys).toEqual(['o:S1', 'o:S2']);
  });

  it('falls back to positional identity for duplicates without the bridge', () => {
    loadPlaylistPage(document, PL, [
      { videoId: 'dupdupdupdu', title: 'Dup' },
      { videoId: 'dupdupdupdu', title: 'Dup' },
    ]);
    const entries = youtubeAdapter.readRows(youtubeAdapter.findListContainer(document)!, page).map((r) => r.entry);
    expect(entries.map((e) => e.key)).toEqual(['p:dupdupdupdu:1', 'p:dupdupdupdu:2']);
    expect(entries.every((e) => e.identity === 'positional')).toBe(true);
  });

  it('ignores bridge data that belongs to a different video (recycled row)', () => {
    loadPlaylistPage(document, PL, [{ videoId: 'aaaaaaaaaaa', title: 'A', setVideoId: 'S1' }]);
    const row = document.querySelector('ytd-playlist-video-renderer')!;
    row.setAttribute(BRIDGE.videoAttr, 'zzzzzzzzzzz');
    const [first] = youtubeAdapter.readRows(youtubeAdapter.findListContainer(document)!, page);
    expect(first?.entry.identity).toBe('positional');
  });

  it('skips stale rows that link to a different playlist', () => {
    loadPlaylistPage(document, PL, [
      { videoId: 'aaaaaaaaaaa', title: 'Current', setVideoId: 'S1' },
      { videoId: 'bbbbbbbbbbb', title: 'Stale', setVideoId: 'S2', list: 'PLother' },
    ]);
    const rows = youtubeAdapter.readRows(youtubeAdapter.findListContainer(document)!, page);
    expect(rows.map((r) => r.entry.title)).toEqual(['Current']);
  });

  it('ignores lists inside hidden (cached) browse pages', () => {
    loadPlaylistPage(document, PL, [{ videoId: 'aaaaaaaaaaa', title: 'A' }]);
    document.querySelector('ytd-browse[page-subtype="playlist"]')!.setAttribute('hidden', '');
    expect(youtubeAdapter.findListContainer(document)).toBeNull();
  });

  it('places the control as the first child exactly once', () => {
    loadPlaylistPage(document, PL, [{ videoId: 'aaaaaaaaaaa', title: 'A' }]);
    const row = document.querySelector<HTMLElement>('ytd-playlist-video-renderer')!;
    const host = document.createElement('div');
    youtubeAdapter.placeControl(row, host);
    youtubeAdapter.placeControl(row, host);
    expect(row.firstElementChild).toBe(host);
    expect(row.querySelectorAll(':scope > div').length).toBe(3);
  });

  it('reports theme changes from the html[dark] attribute until aborted', async () => {
    document.documentElement.removeAttribute('dark');
    const listener = vi.fn();
    const controller = new AbortController();
    expect(youtubeAdapter.watchTheme(document, listener, controller.signal)).toBe('light');
    document.documentElement.setAttribute('dark', '');
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(listener).toHaveBeenCalledWith('dark');
    controller.abort();
    document.documentElement.removeAttribute('dark');
    await new Promise((r) => setTimeout(r, 0));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
