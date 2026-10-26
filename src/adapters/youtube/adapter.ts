import type { PageInfo, PlatformAdapter, Theme } from '../types';
import { readRows } from './entries';
import { BRIDGE, YT } from './selectors';

export function detectYouTubePage(url: URL, doc: Document): PageInfo {
  if (url.hostname !== 'www.youtube.com') return { kind: 'unsupported', reason: 'Not desktop YouTube (www.youtube.com).' };
  if (url.pathname !== '/playlist') return { kind: 'unsupported', reason: 'Open a playlist page (youtube.com/playlist?list=…).' };
  const playlistId = url.searchParams.get('list');
  if (!playlistId) return { kind: 'unsupported', reason: 'This playlist URL has no list ID.' };
  const title = doc.title.replace(/\s*-\s*YouTube\s*$/, '').trim() || null;
  return { kind: 'playlist', playlistId, title };
}

/**
 * Parse "182 videos", "1,234 videos", "1.234 Videos", "182 video" or
 * "245 lessons" (course playlists). Only matches a number directly followed
 * by such a word, so view counts are ignored. Other UI languages may return null.
 */
export function parseVideoCount(text: string): number | null {
  // \s also covers the no-break spaces some locales use as thousands separators.
  const match = /(\d{1,3}(?:[,.\s]\d{3})*|\d+)\s*(?:video|lesson)/i.exec(text);
  if (!match?.[1]) return null;
  const value = Number(match[1].replace(/[^\d]/g, ''));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function currentTheme(doc: Document): Theme {
  return doc.documentElement.hasAttribute(YT.darkAttribute) ? 'dark' : 'light';
}

export const youtubeAdapter: PlatformAdapter = {
  detectPage: detectYouTubePage,

  findListContainer(doc) {
    for (const selector of YT.listContainers) {
      const container = doc.querySelector<HTMLElement>(selector);
      if (container) return container;
    }
    return null;
  },

  readRows(container, page) {
    return readRows(container, page.playlistId);
  },

  placeControl(row, host) {
    const target = row.querySelector<HTMLElement>(YT.lockupInner) ?? row;
    if (target.firstElementChild !== host) target.prepend(host);
  },

  onNavigate(doc, listener, signal) {
    doc.addEventListener(YT.navigateFinishEvent, listener, { signal });
  },

  watchTheme(doc, listener, signal) {
    let theme = currentTheme(doc);
    const observer = new MutationObserver(() => {
      const next = currentTheme(doc);
      if (next === theme) return;
      theme = next;
      listener(next);
    });
    observer.observe(doc.documentElement, { attributes: true, attributeFilter: [YT.darkAttribute] });
    signal.addEventListener('abort', () => observer.disconnect(), { once: true });
    return theme;
  },

  findContinuation(container, page) {
    // Legacy: the container is the list itself.
    if (!container.matches('yt-section-list-renderer')) return container.querySelector<HTMLElement>(YT.continuation);
    const playlistLink = `a[href*="list=${page.playlistId}"]`;
    for (const section of container.querySelectorAll(YT.itemSection)) {
      if (!section.querySelector(playlistLink)) continue;
      const sentinel = section.querySelector<HTMLElement>(YT.continuation);
      if (sentinel) return sentinel;
    }
    return null;
  },

  requestMore(continuation, nudge = false) {
    // YouTube loads the next batch when the sentinel *becomes* visible, so a
    // nudge scrolls it out of view; the next request scrolls it back in.
    const view = continuation.ownerDocument.defaultView;
    if (nudge && view) view.scrollBy(0, -view.innerHeight);
    else continuation.scrollIntoView({ block: 'end' });
  },

  readExpectedCount(doc) {
    for (const selector of YT.headerCount) {
      for (const el of doc.querySelectorAll(selector)) {
        const count = parseVideoCount(el.textContent ?? '');
        if (count !== null) return count;
      }
    }
    return null;
  },

  requestIdentityRefresh(doc) {
    // Dispatched synchronously into the page world, where the bridge copies
    // per-occurrence IDs onto row attributes before this call returns.
    doc.dispatchEvent(new CustomEvent(BRIDGE.refreshEvent));
  },
};
