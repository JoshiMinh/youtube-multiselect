// Read the active playlist view, including Shorts tabs and nested rich grids.
export function playlistTab(data) {
  const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs ?? [];
  return tabs.find((tab) => tab.tabRenderer?.selected)?.tabRenderer ?? tabs[0]?.tabRenderer;
}

export function playlistContents(data) {
  const content = playlistTab(data)?.content;
  const find = (node) => {
    if (!node || typeof node !== 'object') return;
    for (const key of ['playlistVideoListRenderer', 'richGridRenderer']) {
      if (node[key]?.contents) return node[key].contents;
    }
    if (node.itemSectionRenderer?.contents) {
      const contents = node.itemSectionRenderer.contents;
      return contents.map(find).find(Boolean) ?? contents;
    }
    for (const value of Object.values(node)) {
      const items = find(value);
      if (items) return items;
    }
  };
  return find(content);
}

export function playlistSetVideoId(data, videoId) {
  if (!data || !videoId) return;
  if (Array.isArray(data)) {
    for (const item of data) {
      const id = playlistSetVideoId(item, videoId);
      if (id) return id;
    }
  } else if (typeof data === 'object') {
    // Match an item before looking for its edit ID; duplicate videos may have different IDs.
    if (data.videoId === videoId || data.contentId === videoId) {
      const id = JSON.stringify(data).match(/"(?:setVideoId|playlistSetVideoId)":"([^"]+)"/)?.[1];
      if (id) return id;
    }
    for (const value of Object.values(data)) {
      const id = playlistSetVideoId(value, videoId);
      if (id) return id;
    }
  }
}

// Move every selected run by one visible item, keeping the selection's relative order.
export function stepMove(items, selected, direction) {
  const order = items.slice();
  const actions = [];
  const indexes = order.map((_, index) => index);
  if (direction === 'down') indexes.reverse();
  for (const index of indexes) {
    const next = index + (direction === 'up' ? -1 : 1);
    if (!selected.has(order[index]) || next < 0 || next >= order.length || selected.has(order[next])) continue;
    const id = order[index];
    [order[index], order[next]] = [order[next], order[index]];
    actions.push({
      action: 'ACTION_MOVE_VIDEO_AFTER',
      setVideoId: id,
      ...(next > 0 ? { movedSetVideoIdPredecessor: order[next - 1] } : {}),
    });
  }
  return { order, actions };
}
