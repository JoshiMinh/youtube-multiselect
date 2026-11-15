const videoId = /^[\w-]{11}$/;
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

export function selectionHtml(videos) {
  return videos.map(({ id, title, thumbnail }) => {
    if (!videoId.test(id)) throw new Error('Invalid video ID');
    const image = /^https?:\/\//.test(thumbnail ?? '')
      ? `<img src="${escapeHtml(thumbnail)}" alt="" style="width:150px">` : '';
    return `<a href="https://www.youtube.com/watch?v=${id}" style="display:block">${image}${escapeHtml(title || id)}</a>`;
  }).join('\n');
}

export function parseSelectionFile(text, type, name = '') {
  const extension = name.split('.').at(-1)?.toLowerCase();
  let ids;
  if (type === 'application/json' || extension === 'json') ids = JSON.parse(text);
  else if (type === 'text/html' || extension === 'html' || extension === 'htm') {
    ids = [...text.matchAll(/\/(?:watch\?v=|shorts\/)([\w-]{11})(?=["&?/#\s<]|$)/g)].map((match) => match[1]);
  } else if (type === 'text/plain' || extension === 'txt') ids = text.trim().split(/\r?\n/).map((id) => id.trim()).filter(Boolean);
  if (!Array.isArray(ids) || !ids.length || ids.some((id) => typeof id !== 'string' || !videoId.test(id))) {
    throw new Error('Invalid selection file');
  }
  return ids;
}
