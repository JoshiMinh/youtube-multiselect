import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { youtubeAdapter } from '@/src/adapters/youtube/adapter';
import { PageSession } from '@/src/controller/session';
import { loadPlaylistPage, type FixtureRow } from '../fixtures/playlist';
import { fakeToolbar, timeoutSchedule } from './helpers';

const PL = 'PLfilter';

let session: PageSession;

async function start(rows: FixtureRow[], complete = true) {
  loadPlaylistPage(document, PL, rows, { complete });
  session = new PageSession({
    adapter: youtubeAdapter,
    doc: document,
    page: { kind: 'playlist', playlistId: PL, title: 'Fixture' },
    mountToolbar: fakeToolbar().mount,
    schedule: timeoutSchedule,
    livenessIntervalMs: 1,
  });
  await session.start();
}

const rows: FixtureRow[] = [
  { videoId: 'aaaaaaaaaaa', title: 'Tokyo Night Walk', channel: 'Walker', setVideoId: 'S1' },
  { videoId: 'bbbbbbbbbbb', title: 'Beach Guide', channel: 'Travel', setVideoId: 'S2' },
  { videoId: 'aaaaaaaaaaa', title: 'Tokyo Night Walk', channel: 'Walker', setVideoId: 'S3' },
  { videoId: 'ccccccccccc', title: 'tokyo lowercase', channel: 'Other', setVideoId: 'S4' },
  { videoId: 'aaaaaaaaaaa', title: 'Tokyo Night Walk', channel: 'Walker', setVideoId: 'S5' },
];

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => session.dispose());

describe('selectMatching', () => {
  it('adds entries whose title or channel contains the text', async () => {
    await start(rows);
    session.selectMatching({ query: 'tokyo', caseSensitive: false });
    expect(session.selectedEntries().map((e) => e.occurrenceId)).toEqual(['S1', 'S3', 'S4', 'S5']);
    expect(session.getSnapshot().notice).toBe('Matched 4 entries.');
  });

  it('is case sensitive on request and adds to the existing selection', async () => {
    await start(rows);
    session.selectMatching({ query: 'Travel', caseSensitive: true });
    session.selectMatching({ query: 'tokyo', caseSensitive: true });
    expect(session.selectedEntries().map((e) => e.occurrenceId)).toEqual(['S2', 'S4']);
  });

  it('says so when nothing matches or the query is blank', async () => {
    await start(rows);
    session.selectMatching({ query: 'zzz', caseSensitive: false });
    expect(session.getSnapshot().notice).toBe('No loaded entries match.');
    session.selectMatching({ query: ' ', caseSensitive: false });
    expect(session.getSnapshot().selected).toBe(0);
    expect(session.getSnapshot().notice).toBe('Type some text to filter by.');
  });

  it('warns that only loaded entries were searched when more remain', async () => {
    await start(rows, false);
    session.selectMatching({ query: 'zzz', caseSensitive: false });
    expect(session.getSnapshot().notice).toContain('Load all first');
  });
});

describe('selectDuplicates', () => {
  it('selects every repeat but keeps the first occurrence', async () => {
    await start(rows);
    expect(session.getSnapshot().duplicateExtras).toBe(2);
    session.selectDuplicates();
    expect(session.selectedEntries().map((e) => e.occurrenceId)).toEqual(['S3', 'S5']);
    expect(session.getSnapshot().notice).toBe('Selected 2 duplicates.');
  });

  it('does not act on duplicates that only have positional identity', async () => {
    await start(rows.map(({ setVideoId: _ignored, ...row }) => row));
    const snap = session.getSnapshot();
    expect(snap.duplicateExtras).toBe(0);
    expect(snap.duplicatesBlocked).toBe(2);
    session.selectDuplicates();
    expect(session.getSnapshot().selected).toBe(0);
    expect(session.getSnapshot().notice).toContain('2 more skipped');
  });
});
