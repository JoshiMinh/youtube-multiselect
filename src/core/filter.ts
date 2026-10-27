import type { PlaylistEntry } from '../adapters/types';

/** Every criterion that is set must match; unset ones are ignored. */
export interface FilterCriteria {
  /** Text that must occur in the title or channel. */
  query: string;
  caseSensitive: boolean;
  minSeconds?: number;
  maxSeconds?: number;
  /** Inclusive range of positions as shown by the site (1-based). */
  fromPosition?: number;
  toPosition?: number;
}

export function hasCriteria(criteria: FilterCriteria): boolean {
  return (
    criteria.query.trim() !== '' ||
    criteria.minSeconds !== undefined ||
    criteria.maxSeconds !== undefined ||
    criteria.fromPosition !== undefined ||
    criteria.toPosition !== undefined
  );
}

/** An entry with an unknown duration or position never matches a criterion on it. */
export function matchesFilter(entry: PlaylistEntry, criteria: FilterCriteria): boolean {
  if (!hasCriteria(criteria)) return false;
  const { caseSensitive, minSeconds, maxSeconds, fromPosition, toPosition } = criteria;

  if (criteria.query.trim() !== '') {
    const fold = (text: string) => (caseSensitive ? text : text.toLowerCase());
    const needle = fold(criteria.query);
    if (!fold(entry.title).includes(needle) && !fold(entry.channel ?? '').includes(needle)) return false;
  }
  if (minSeconds !== undefined || maxSeconds !== undefined) {
    const seconds = entry.durationSeconds;
    if (seconds === null) return false;
    if (minSeconds !== undefined && seconds < minSeconds) return false;
    if (maxSeconds !== undefined && seconds > maxSeconds) return false;
  }
  if (fromPosition !== undefined || toPosition !== undefined) {
    const position = entry.position;
    if (position === null) return false;
    if (fromPosition !== undefined && position < fromPosition) return false;
    if (toPosition !== undefined && position > toPosition) return false;
  }
  return true;
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
