import { beforeAll, describe, expect, it } from 'vitest';
import bridge, { findOccurrenceId, refreshIdentity } from '@/entrypoints/youtube-bridge';
import { youtubeAdapter } from '@/src/adapters/youtube/adapter';
import { loadPlaylistPage } from '../fixtures/playlist';

type WithData = HTMLElement & { data?: unknown; __data?: unknown };

const PL = 'PL1';
const page = { kind: 'playlist' as const, playlistId: PL, title: null };

function keys() {
  return youtubeAdapter.readRows(youtubeAdapter.findListContainer(document)!, page).map((r) => r.entry.key);
}

describe('findOccurrenceId', () => {
  it('reads a direct setVideoId (legacy row data)', () => {
    expect(findOccurrenceId({ setVideoId: 'S1', videoId: 'v' }, PL)).toBe('S1');
  });

  it('reads a setVideoId scoped to this playlist from nested commands (lockup data)', () => {
    const data = {
      contentId: 'v',
      menu: { items: [{ playlistEditEndpoint: { playlistId: PL, actions: [{ action: 'ACTION_REMOVE_VIDEO', setVideoId: 'S9' }] } }] },
    };
    expect(findOccurrenceId(data, PL)).toBe('S9');
  });

  it('ignores IDs scoped to another playlist, such as Watch Later toggles', () => {
    const data = {
      contentId: 'v',
      overlay: { playlistEditEndpoint: { playlistId: 'WL', actions: [{ setVideoId: 'WRONG' }] } },
      unscoped: { setVideoId: 'ALSO_WRONG' },
    };
    expect(findOccurrenceId(data, PL)).toBeNull();
  });
});

describe('MAIN-world identity bridge', () => {
  beforeAll(() => {
    (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(`https://www.youtube.com/playlist?list=${PL}`);
    bridge.main();
    // A second injection (extension reload) must not add a second listener.
    bridge.main();
  });

  it('copies setVideoId from legacy Polymer data on request', () => {
    loadPlaylistPage(document, PL, [
      { videoId: 'aaaaaaaaaaa', title: 'A' },
      { videoId: 'aaaaaaaaaaa', title: 'A again' },
      { videoId: 'ccccccccccc', title: 'C' },
    ]);
    const rows = document.querySelectorAll<WithData>('ytd-playlist-video-renderer');
    rows[0]!.data = { videoId: 'aaaaaaaaaaa', setVideoId: 'SETA1' };
    rows[1]!.__data = { data: { videoId: 'aaaaaaaaaaa', setVideoId: 'SETA2' } };
    // rows[2] has no data: stays positional.
    youtubeAdapter.requestIdentityRefresh!(document);
    expect(keys()).toEqual(['o:SETA1', 'o:SETA2', 'p:ccccccccccc:3']);
  });

  it('reads lockup data from the wrapper element', () => {
    loadPlaylistPage(document, PL, [{ videoId: 'aaaaaaaaaaa', title: 'A' }, { videoId: 'bbbbbbbbbbb', title: 'B' }], { layout: 'lockup' });
    const lockups = document.querySelectorAll<HTMLElement>('yt-lockup-view-model');
    (lockups[0]!.parentElement as WithData).data = {
      contentId: 'aaaaaaaaaaa',
      cmd: { playlistEditEndpoint: { playlistId: PL, actions: [{ setVideoId: 'L1' }] } },
    };
    // Signed-out shape: watch endpoint only, no setVideoId.
    (lockups[1]!.parentElement as WithData).data = { contentId: 'bbbbbbbbbbb', cmd: { watchEndpoint: { playlistId: PL, videoId: 'bbbbbbbbbbb' } } };
    youtubeAdapter.requestIdentityRefresh!(document);
    expect(keys()).toEqual(['o:L1', 'p:bbbbbbbbbbb:2']);
  });

  it('clears attributes when a recycled row loses its data', () => {
    loadPlaylistPage(document, PL, [{ videoId: 'aaaaaaaaaaa', title: 'A' }]);
    const row = document.querySelector<WithData>('ytd-playlist-video-renderer')!;
    row.data = { videoId: 'aaaaaaaaaaa', setVideoId: 'SET1' };
    refreshIdentity(document, PL);
    expect(row.getAttribute('data-ytms-set-video-id')).toBe('SET1');
    row.data = {};
    refreshIdentity(document, PL);
    expect(row.hasAttribute('data-ytms-set-video-id')).toBe(false);
  });
});
