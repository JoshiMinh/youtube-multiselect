import { describe, expect, it } from 'vitest';
import { describeStatus } from '@/entrypoints/popup/status';
import type { SessionSnapshot } from '@/src/controller/session';

const session: SessionSnapshot = {
  playlistId: 'PL1',
  playlistTitle: 'Mix',
  loaded: 10,
  selected: 2,
  selectedNotLoaded: 0,
  identity: 'occurrence',
  theme: 'light',
  listFound: true,
  hasMore: false,
  expected: 10,
  load: { status: 'idle' },
  duplicateExtras: 0,
  duplicatesBlocked: 0,
  notice: null,
};

describe('describeStatus', () => {
  it('asks to reload YouTube tabs without a content script', () => {
    expect(describeStatus({ kind: 'no-response', url: 'https://www.youtube.com/playlist?list=x' }, true).title).toBe('Reload this YouTube tab');
  });

  it('explains non-YouTube tabs', () => {
    expect(describeStatus({ kind: 'no-response', url: undefined }, true).title).toBe('Not a YouTube tab');
  });

  it('reports disabled state', () => {
    const view = describeStatus({ kind: 'status', status: { enabled: false, page: { kind: 'unsupported', reason: 'x' }, session: null } }, false);
    expect(view.title).toBe('Disabled');
  });

  it('reports unsupported pages with the adapter reason', () => {
    const view = describeStatus({ kind: 'status', status: { enabled: true, page: { kind: 'unsupported', reason: 'Open a playlist page.' }, session: null } }, true);
    expect(view.lines).toEqual(['Open a playlist page.']);
  });

  it('summarises an active session and warns about positional identity', () => {
    const page = { kind: 'playlist' as const, playlistId: 'PL1', title: 'Mix' };
    const ok = describeStatus({ kind: 'status', status: { enabled: true, page, session } }, true);
    expect(ok).toMatchObject({ tone: 'ok', title: 'Active on Mix', lines: ['10 entries loaded, 2 selected.'] });
    const positional = describeStatus({ kind: 'status', status: { enabled: true, page, session: { ...session, identity: 'positional' } } }, true);
    expect(positional.lines).toHaveLength(2);
  });

  it('mentions Load all when more entries exist', () => {
    const page = { kind: 'playlist' as const, playlistId: 'PL1', title: 'Mix' };
    const view = describeStatus({ kind: 'status', status: { enabled: true, page, session: { ...session, hasMore: true, expected: 300 } } }, true);
    expect(view.lines[0]).toBe('10 of ~300 entries loaded, 2 selected.');
    expect(view.lines).toContain('Use “Load all” in the page toolbar to load the rest.');
  });
});
