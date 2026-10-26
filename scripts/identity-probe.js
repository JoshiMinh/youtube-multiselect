// Read-only diagnostic for occurrence identity on a YouTube playlist page.
//
// Paste into the DevTools console (top frame) on youtube.com/playlist?list=…
// while signed in. It reads row data the same way entrypoints/youtube-bridge.ts
// does and prints a table; it changes nothing and sends nothing.
// Keep the logic in sync with findOccurrenceId() in the bridge.
(() => {
  const list = new URLSearchParams(location.search).get('list');
  const isData = (v) => typeof v === 'object' && v !== null;
  const str = (v) => (typeof v === 'string' && v ? v : null);
  const dataOf = (el) => [el.data, el.__data?.data, el.polymerController?.data, el.parentElement?.data].find(isData) ?? null;

  function findOccurrenceId(data) {
    if (str(data.setVideoId)) return { id: data.setVideoId, path: 'setVideoId' };
    const stack = [[data, null, '']];
    let visited = 0;
    while (stack.length && visited++ < 4000) {
      const [node, scope, path] = stack.pop();
      if (!isData(node)) continue;
      const nodeScope = str(node.playlistId) ?? scope;
      if (nodeScope !== null && nodeScope !== list) continue;
      if (str(node.setVideoId) && nodeScope === list) return { id: node.setVideoId, path: `${path}.setVideoId` };
      for (const [k, v] of Object.entries(node)) if (isData(v)) stack.push([v, nodeScope, `${path}.${k}`]);
    }
    return null;
  }

  // Also report every setVideoId anywhere in the data, with its scope, to see where YouTube puts it.
  function allSetVideoIds(data) {
    const out = [];
    const stack = [[data, null, '']];
    let visited = 0;
    while (stack.length && visited++ < 4000) {
      const [node, scope, path] = stack.pop();
      if (!isData(node)) continue;
      const nodeScope = str(node.playlistId) ?? scope;
      if (str(node.setVideoId)) out.push(`${nodeScope ?? '(none)'} ${path}`);
      for (const [k, v] of Object.entries(node)) if (isData(v)) stack.push([v, nodeScope, `${path}.${k}`]);
    }
    return out;
  }

  const rows = [...document.querySelectorAll('ytd-browse:not([hidden]) ytd-playlist-video-renderer, ytd-browse:not([hidden]) yt-lockup-view-model')];
  const table = rows.slice(0, 200).map((el, i) => {
    const data = dataOf(el);
    const href = el.querySelector('a#video-title, a.ytLockupMetadataViewModelTitle')?.getAttribute('href') ?? '';
    const videoId = new URL(href, location.origin).searchParams.get('v');
    const found = data ? findOccurrenceId(data) : null;
    return {
      i: i + 1,
      layout: el.tagName.toLowerCase(),
      videoId,
      occurrenceId: found?.id ?? null,
      foundAt: found?.path ?? null,
      allSetVideoIdPaths: data ? allSetVideoIds(data).slice(0, 3).join(' | ') : 'no data',
    };
  });
  const loggedIn = window.ytcfg?.get?.('LOGGED_IN');
  const withId = table.filter((r) => r.occurrenceId).length;
  const ids = table.map((r) => r.occurrenceId).filter(Boolean);
  const vids = table.map((r) => r.videoId);
  console.log(`[ytms probe] list=${list} loggedIn=${loggedIn} rows=${rows.length} withOccurrenceId=${withId}`);
  console.log(`[ytms probe] duplicate videoIds=${vids.length - new Set(vids).size} duplicate occurrenceIds=${ids.length - new Set(ids).size}`);
  console.table(table);
  return { list, loggedIn, rows: rows.length, withOccurrenceId: withId, sample: table.slice(0, 10) };
})();
