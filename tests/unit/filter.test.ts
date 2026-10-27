import { describe, expect, it } from 'vitest';
import type { PlaylistEntry } from '@/src/adapters/types';
import { findDuplicates, matchesFilter } from '@/src/core/filter';

function entry(key: string, videoId: string, extra: Partial<PlaylistEntry> = {}): PlaylistEntry {
  return {
    key,
    videoId,
    occurrenceId: key,
    identity: 'occurrence',
    title: `Title ${key}`,
    channel: 'Some Channel',
    position: null,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    ...extra,
  };
}

describe('matchesFilter', () => {
  const e = entry('a', 'v1', { title: 'Tokyo Night Walk', channel: 'Walker' });

  it('matches title or channel, ignoring case by default', () => {
    expect(matchesFilter(e, { query: 'tokyo', caseSensitive: false })).toBe(true);
    expect(matchesFilter(e, { query: 'WALKER', caseSensitive: false })).toBe(true);
  });

  it('honours case sensitivity', () => {
    expect(matchesFilter(e, { query: 'tokyo', caseSensitive: true })).toBe(false);
    expect(matchesFilter(e, { query: 'Tokyo', caseSensitive: true })).toBe(true);
  });

  it('matches nothing for blank queries and tolerates a missing channel', () => {
    expect(matchesFilter(e, { query: '  ', caseSensitive: false })).toBe(false);
    expect(matchesFilter({ ...e, channel: null }, { query: 'x', caseSensitive: false })).toBe(false);
  });
});

describe('findDuplicates', () => {
  it('keeps the first occurrence and returns the later ones', () => {
    const report = findDuplicates([entry('a', 'v1'), entry('b', 'v2'), entry('c', 'v1'), entry('d', 'v1')]);
    expect(report).toEqual({ extras: ['c', 'd'], blocked: 0 });
  });

  it('reports but does not offer groups with positional identity', () => {
    const report = findDuplicates([
      entry('a', 'v1'),
      entry('b', 'v1', { identity: 'positional' }),
      entry('c', 'v2'),
      entry('d', 'v2'),
    ]);
    expect(report).toEqual({ extras: ['d'], blocked: 1 });
  });

  it('finds nothing in a list of unique videos', () => {
    expect(findDuplicates([entry('a', 'v1'), entry('b', 'v2')])).toEqual({ extras: [], blocked: 0 });
  });
});
