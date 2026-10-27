import type { PlaylistEntry } from '../adapters/types';

export interface TextFilter {
  query: string;
  caseSensitive: boolean;
}

/** An entry matches when the query occurs in its title or channel name. Blank queries match nothing. */
export function matchesFilter(entry: PlaylistEntry, { query, caseSensitive }: TextFilter): boolean {
  const needle = caseSensitive ? query : query.toLowerCase();
  if (needle.trim() === '') return false;
  const fold = (text: string) => (caseSensitive ? text : text.toLowerCase());
  return fold(entry.title).includes(needle) || fold(entry.channel ?? '').includes(needle);
}

export interface DuplicateReport {
  /** Entries to select: every occurrence after the first, in groups that are safe to act on. */
  extras: string[];
  /** Extra occurrences found in groups where some entry only has a positional key. */
  blocked: number;
}

/**
 * Group entries (in display order) by video. Acting on a group needs a stable
 * identity for every member, otherwise "the first one" can change on reorder.
 */
export function findDuplicates(entries: readonly PlaylistEntry[]): DuplicateReport {
  const groups = new Map<string, PlaylistEntry[]>();
  for (const entry of entries) {
    const group = groups.get(entry.videoId);
    if (group) group.push(entry);
    else groups.set(entry.videoId, [entry]);
  }
  const extras: string[] = [];
  let blocked = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    if (group.every((entry) => entry.identity === 'occurrence')) {
      extras.push(...group.slice(1).map((entry) => entry.key));
    } else {
      blocked += group.length - 1;
    }
  }
  return { extras, blocked };
}
