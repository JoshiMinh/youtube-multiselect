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

  requestIdentityRefresh(doc) {
    // Dispatched synchronously into the page world, where the bridge copies
    // per-occurrence IDs onto row attributes before this call returns.
    doc.dispatchEvent(new CustomEvent(BRIDGE.refreshEvent));
  },
};
