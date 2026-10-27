import { describe, expect, it } from 'vitest';
import type { PlaylistEntry } from '@/src/adapters/types';
import { findDuplicates, hasCriteria, matchesFilter, type FilterCriteria } from '@/src/core/filter';

function entry(key: string, videoId: string, extra: Partial<PlaylistEntry> = {}): PlaylistEntry {
  return {
    key,
    videoId,
    occurrenceId: key,
    identity: 'occurrence',
    title: `Title ${key}`,
    channel: 'Some Channel',
    position: null,
    durationSeconds: null,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    ...extra,
  };
}

const text = (query: string, caseSensitive = false): FilterCriteria => ({ query, caseSensitive });

describe('matchesFilter', () => {
  const e = entry('a', 'v1', { title: 'Tokyo Night Walk', channel: 'Walker', position: 5, durationSeconds: 300 });

  it('matches title or channel, ignoring case by default', () => {
    expect(matchesFilter(e, text('tokyo'))).toBe(true);
    expect(matchesFilter(e, text('WALKER'))).toBe(true);
  });

  it('honours case sensitivity', () => {
    expect(matchesFilter(e, text('tokyo', true))).toBe(false);
    expect(matchesFilter(e, text('Tokyo', true))).toBe(true);
  });

  it('matches nothing without criteria and tolerates a missing channel', () => {
    expect(hasCriteria(text('  '))).toBe(false);
    expect(matchesFilter(e, text('  '))).toBe(false);
    expect(matchesFilter({ ...e, channel: null }, text('x'))).toBe(false);
  });

  it('filters by inclusive duration bounds', () => {
    expect(matchesFilter(e, { ...text(''), minSeconds: 300 })).toBe(true);
    expect(matchesFilter(e, { ...text(''), minSeconds: 301 })).toBe(false);
    expect(matchesFilter(e, { ...text(''), maxSeconds: 300 })).toBe(true);
    expect(matchesFilter(e, { ...text(''), maxSeconds: 299 })).toBe(false);
  });

  it('filters by inclusive position range', () => {
    expect(matchesFilter(e, { ...text(''), fromPosition: 5, toPosition: 5 })).toBe(true);
    expect(matchesFilter(e, { ...text(''), fromPosition: 6 })).toBe(false);
    expect(matchesFilter(e, { ...text(''), toPosition: 4 })).toBe(false);
  });

  it('requires every set criterion to match', () => {
    expect(matchesFilter(e, { ...text('tokyo'), maxSeconds: 600, fromPosition: 1 })).toBe(true);
    expect(matchesFilter(e, { ...text('tokyo'), maxSeconds: 100 })).toBe(false);
    expect(matchesFilter(e, { ...text('nope'), maxSeconds: 600 })).toBe(false);
  });

  it('never matches a range criterion on an unknown duration or position', () => {
    const unknown = entry('b', 'v2');
    expect(matchesFilter(unknown, { ...text(''), maxSeconds: 999999 })).toBe(false);
    expect(matchesFilter(unknown, { ...text(''), fromPosition: 1 })).toBe(false);
    expect(matchesFilter(unknown, text('title'))).toBe(true);
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
