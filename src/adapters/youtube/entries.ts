import type { EntryRow, PlaylistEntry } from '../types';
import { BRIDGE, YT } from './selectors';

const ORIGIN = 'https://www.youtube.com';

/**
 * Read one playlist row. Returns null for rows that are not a playable entry
 * of `playlistId` (placeholders, unavailable items, or stale rows left from a
 * previous playlist while YouTube swaps content).
 */
export function readRow(row: HTMLElement, playlistId: string, domIndex: number): PlaylistEntry | null {
  const link = row.querySelector<HTMLAnchorElement>(YT.titleLink);
  const href = link?.getAttribute('href');
  if (!link || !href) return null;

  let parsed: URL;
  try {
    parsed = new URL(href, ORIGIN);
  } catch {
    return null;
  }
  const videoId = parsed.searchParams.get('v');
  if (!videoId) return null;
  const linkList = parsed.searchParams.get('list');
  if (linkList !== null && linkList !== playlistId) return null;

  const position = parsePosition(row.querySelector(YT.index)?.textContent) ?? parsePosition(parsed.searchParams.get('index'));
  const title = (row.querySelector(YT.titleAttr)?.getAttribute('title') ?? link.textContent ?? '').trim() || videoId;
  const channel = row.querySelector(YT.channelLink)?.textContent?.trim() || null;

  // The bridge pairs the occurrence ID with the video ID it was read for, so a
  // recycled row whose attributes lag behind its new data is not trusted.
  const bridgedVideo = row.getAttribute(BRIDGE.videoAttr);
  const bridgedOccurrence = row.getAttribute(BRIDGE.occurrenceAttr);
  const occurrenceId = bridgedOccurrence && bridgedVideo === videoId ? bridgedOccurrence : null;

  return {
    key: occurrenceId ? `o:${occurrenceId}` : `p:${videoId}:${position ?? `d${domIndex}`}`,
    videoId,
    occurrenceId,
    identity: occurrenceId ? 'occurrence' : 'positional',
    title,
    channel,
    position,
    url: `${ORIGIN}/watch?v=${encodeURIComponent(videoId)}`,
  };
}

export function readRows(container: HTMLElement, playlistId: string): EntryRow[] {
  const rows: EntryRow[] = [];
  const seen = new Set<string>();
  const elements = container.querySelectorAll<HTMLElement>(YT.row);
  elements.forEach((element, index) => {
    const entry = readRow(element, playlistId, index + 1);
    // A duplicate key means identity is ambiguous for this row; skip it
    // rather than letting two rows share one selection state.
    if (!entry || seen.has(entry.key)) return;
    seen.add(entry.key);
    rows.push({ element, entry });
  });
  return rows;
}

function parsePosition(text: string | null | undefined): number | null {
  if (!text) return null;
  const value = Number.parseInt(text.trim(), 10);
  return Number.isInteger(value) && value > 0 ? value : null;
}
