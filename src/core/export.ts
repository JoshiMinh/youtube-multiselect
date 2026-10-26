import type { PlaylistEntry } from '../adapters/types';

export type ExportFormat = 'text' | 'csv' | 'json';

export interface ExportFile {
  filename: string;
  mimeType: string;
  content: string;
}

/** Plain text: one tab-separated "title, url" line per entry. */
export function toText(entries: readonly PlaylistEntry[]): string {
  return entries.map((e) => `${e.title}\t${e.url}`).join('\n');
}

const CSV_COLUMNS = ['position', 'title', 'channel', 'videoId', 'url'] as const;

/**
 * RFC 4180 CSV. Cells starting with characters that spreadsheets treat as a
 * formula are prefixed with an apostrophe to prevent formula injection from
 * video titles.
 */
export function toCsv(entries: readonly PlaylistEntry[]): string {
  const rows = entries.map((e) =>
    [e.position === null ? '' : String(e.position), e.title, e.channel ?? '', e.videoId, e.url].map(csvCell).join(','),
  );
  return [CSV_COLUMNS.join(','), ...rows].join('\r\n') + '\r\n';
}

export function toJson(entries: readonly PlaylistEntry[]): string {
  const data = entries.map((e) => ({
    position: e.position,
    title: e.title,
    channel: e.channel,
    videoId: e.videoId,
    url: e.url,
  }));
  return JSON.stringify(data, null, 2) + '\n';
}

export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function buildExport(format: ExportFormat, entries: readonly PlaylistEntry[], baseName: string, now = new Date()): ExportFile {
  const stamp = now.toISOString().slice(0, 19).replaceAll(':', '-');
  const name = `${sanitizeFilename(baseName)}-${stamp}`;
  switch (format) {
    case 'text':
      return { filename: `${name}.txt`, mimeType: 'text/plain;charset=utf-8', content: toText(entries) + '\n' };
    case 'csv':
      return { filename: `${name}.csv`, mimeType: 'text/csv;charset=utf-8', content: '﻿' + toCsv(entries) };
    case 'json':
      return { filename: `${name}.json`, mimeType: 'application/json', content: toJson(entries) };
  }
}

export function sanitizeFilename(value: string): string {
  const cleaned = value
    // eslint-disable-next-line no-control-regex -- control characters are invalid in filenames
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 60);
  return cleaned || 'playlist';
}
