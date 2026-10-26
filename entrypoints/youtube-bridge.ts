/**
 * Runs in YouTube's page (MAIN) world, injected by the content script.
 *
 * YouTube keeps each playlist row's per-occurrence ID (`setVideoId`) in the
 * row's framework data, which the isolated content script cannot read. On
 * request, this script copies it to plain attributes. It is read-only: it
 * makes no requests and touches nothing but those two attributes.
 *
 * Keep this file free of extension APIs.
 */
import { BRIDGE, YT } from '@/src/adapters/youtube/selectors';

type Data = Record<string, unknown>;

type FrameworkElement = HTMLElement & {
  data?: unknown;
  __data?: { data?: unknown };
  polymerController?: { data?: unknown };
};

declare global {
  interface Window {
    __ytmsBridgeInstalled?: boolean;
  }
}

const MAX_NODES = 4000;

function isData(value: unknown): value is Data {
  return typeof value === 'object' && value !== null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

/** Framework data for a row: legacy Polymer rows, or the lockup's wrapper. */
function rowData(el: FrameworkElement): Data | null {
  const parent = el.parentElement as FrameworkElement | null;
  const candidates = [el.data, el.__data?.data, el.polymerController?.data, parent?.data];
  return (candidates.find(isData) as Data | undefined) ?? null;
}

/**
 * Find a `setVideoId` that belongs to `playlistId`. Commands for other
 * playlists (e.g. the Watch Later toggle) carry their own `playlistId` and
 * are skipped, so their IDs are never mistaken for this occurrence's.
 */
export function findOccurrenceId(data: Data, playlistId: string): string | null {
  const direct = str(data.setVideoId);
  if (direct) return direct;
  const stack: [unknown, string | null][] = [[data, null]];
  let visited = 0;
  while (stack.length > 0 && visited++ < MAX_NODES) {
    const [node, scope] = stack.pop()!;
    if (!isData(node)) continue;
    const nodeScope = str(node.playlistId) ?? scope;
    if (nodeScope !== null && nodeScope !== playlistId) continue;
    const id = str(node.setVideoId);
    if (id && nodeScope === playlistId) return id;
    for (const value of Object.values(node)) if (isData(value)) stack.push([value, nodeScope]);
  }
  return null;
}

function videoIdOf(data: Data): string | null {
  return str(data.videoId) ?? str(data.contentId);
}

function setIfChanged(el: Element, name: string, value: string | null): void {
  if (value === null) {
    if (el.hasAttribute(name)) el.removeAttribute(name);
  } else if (el.getAttribute(name) !== value) {
    el.setAttribute(name, value);
  }
}

export function refreshIdentity(doc: Document, playlistId: string | null): void {
  for (const el of doc.querySelectorAll<FrameworkElement>(YT.row)) {
    const data = rowData(el);
    const videoId = data && videoIdOf(data);
    const occurrenceId = data && videoId && playlistId ? findOccurrenceId(data, playlistId) : null;
    setIfChanged(el, BRIDGE.occurrenceAttr, occurrenceId && videoId ? occurrenceId : null);
    setIfChanged(el, BRIDGE.videoAttr, occurrenceId && videoId ? videoId : null);
  }
}

export default defineUnlistedScript(() => {
  // A reloaded extension injects again; one listener is enough.
  if (window.__ytmsBridgeInstalled) return;
  window.__ytmsBridgeInstalled = true;
  document.addEventListener(BRIDGE.refreshEvent, () => {
    try {
      refreshIdentity(document, new URLSearchParams(location.search).get('list'));
    } catch {
      // Unknown data shape: rows simply fall back to positional identity.
    }
  });
});
