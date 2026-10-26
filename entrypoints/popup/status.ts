import type { ContentStatus } from '@/src/core/messages';

export type TabProbe =
  | { kind: 'no-tab' }
  | { kind: 'no-response'; url: string | undefined }
  | { kind: 'status'; status: ContentStatus };

export interface StatusView {
  tone: 'ok' | 'neutral' | 'warn';
  title: string;
  lines: string[];
}

/** Turn a probe of the active tab into the popup's compatibility message. */
export function describeStatus(probe: TabProbe, enabled: boolean): StatusView {
  if (probe.kind === 'no-tab') return { tone: 'neutral', title: 'No active tab', lines: [] };

  if (probe.kind === 'no-response') {
    const onYouTube = probe.url?.startsWith('https://www.youtube.com/') ?? false;
    return onYouTube
      ? {
          tone: 'warn',
          title: 'Reload this YouTube tab',
          lines: ['The tab was opened before the extension was installed or updated.'],
        }
      : {
          tone: 'neutral',
          title: 'Not a YouTube tab',
          lines: ['Open a playlist on www.youtube.com (for example youtube.com/playlist?list=…).'],
        };
  }

  const { status } = probe;
  if (!enabled || !status.enabled) {
    return { tone: 'neutral', title: 'Disabled', lines: ['Turn the switch on to add selection controls.'] };
  }
  if (status.page.kind !== 'playlist') {
    return { tone: 'neutral', title: 'Not a supported page', lines: [status.page.reason] };
  }
  const session = status.session;
  if (!session || !session.listFound) {
    return { tone: 'neutral', title: 'Waiting for the playlist to load', lines: ['If this persists, YouTube may have changed its layout.'] };
  }
  const of = session.hasMore && session.expected !== null ? ` of ~${session.expected}` : '';
  const lines = [`${session.loaded}${of} entries loaded, ${session.selected} selected.`];
  if (session.loaded === 0) lines.push('No supported entries found on this page yet.');
  if (session.load.status === 'loading') lines.push('Loading more entries…');
  else if (session.hasMore) lines.push('Use “Load all” in the page toolbar to load the rest.');
  if (session.identity === 'positional' || session.identity === 'mixed') {
    lines.push('Duplicates are told apart by position; reordering the playlist can shift them.');
  }
  return { tone: 'ok', title: `Active on ${session.playlistTitle ?? 'this playlist'}`, lines };
}
