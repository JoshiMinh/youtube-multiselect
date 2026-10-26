import { describe, expect, it } from 'vitest';
import type { PlaylistEntry } from '@/src/adapters/types';
import { buildExport, csvCell, sanitizeFilename, toCsv, toJson, toText } from '@/src/core/export';

function entry(overrides: Partial<PlaylistEntry> = {}): PlaylistEntry {
  return {
    key: 'o:SET1',
    videoId: 'abcdefghijk',
    occurrenceId: 'SET1',
    identity: 'occurrence',
    title: 'A title',
    channel: 'Channel',
    position: 1,
    url: 'https://www.youtube.com/watch?v=abcdefghijk',
    ...overrides,
  };
}

describe('export formats', () => {
  it('formats text as tab-separated title and URL', () => {
    expect(toText([entry(), entry({ title: 'B', url: 'u2' })])).toBe('A title\thttps://www.youtube.com/watch?v=abcdefghijk\nB\tu2');
  });

  it('escapes CSV quotes, commas and newlines', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
  });

  it('neutralises spreadsheet formulas in titles', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('-1')).toBe("'-1");
    expect(csvCell('@cmd')).toBe("'@cmd");
  });

  it('writes a header and keeps duplicate videos as separate rows', () => {
    const csv = toCsv([entry(), entry({ key: 'o:SET2', occurrenceId: 'SET2', position: 5, channel: null })]);
    const lines = csv.trimEnd().split('\r\n');
    expect(lines[0]).toBe('position,title,channel,videoId,url');
    expect(lines).toHaveLength(3);
    expect(lines[2]).toBe('5,A title,,abcdefghijk,https://www.youtube.com/watch?v=abcdefghijk');
  });

  it('produces JSON without internal keys', () => {
    const data = JSON.parse(toJson([entry()]));
    expect(data).toEqual([{ position: 1, title: 'A title', channel: 'Channel', videoId: 'abcdefghijk', url: entry().url }]);
  });

  it('builds files with safe names and a BOM for CSV', () => {
    const now = new Date('2026-10-26T12:34:56Z');
    const csv = buildExport('csv', [entry()], 'My: list/2026?', now);
    expect(csv.filename).toBe('My-list2026-2026-10-26T12-34-56.csv');
    expect(csv.content.startsWith('﻿')).toBe(true);
    expect(buildExport('json', [], 'x', now).mimeType).toBe('application/json');
    expect(sanitizeFilename('...')).toBe('playlist');
  });
});
