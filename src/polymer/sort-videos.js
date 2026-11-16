const text = (value) => typeof value === 'string' ? value : value?.simpleText ?? value?.runs?.map((run) => run.text).join('') ?? value?.content ?? '';

function duration(data, row) {
  const seconds = Number(data.lengthSeconds);
  if (data.lengthSeconds != null && Number.isFinite(seconds) && seconds >= 0) return seconds;
  const candidates = [text(data.lengthText), ...(data.thumbnailOverlays ?? []).map((overlay) => text(overlay.thumbnailOverlayTimeStatusRenderer?.text)),
    ...Array.from(row?.querySelectorAll('ytd-thumbnail-overlay-time-status-renderer, yt-thumbnail-overlay-badge-view-model, yt-badge-view-model, badge-shape, .yt-badge-shape__text, [class*="badgeShape"], [class*="BadgeText"], #overlays #text') ?? [], (node) => node.textContent)];
  for (const candidate of candidates) {
    const value = candidate.trim().replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '');
    if (/^\d+(?::\d{2}){1,2}$/.test(value)) return value.split(':').reduce((sum, part) => sum * 60 + Number(part), 0);
  }
  return null;
}

function date(data, row, now) {
  for (const value of [data.publishDate, data.uploadDate, data.microformat?.playerMicroformatRenderer?.publishDate, row?.querySelector('time[datetime]')?.getAttribute('datetime')]) {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value) && Number.isFinite(Date.parse(value))) return Date.parse(value);
  }
  const value = text(data.publishedTimeText).trim() || Array.from(row?.querySelectorAll('yt-content-metadata-view-model, #video-info, #metadata-line, ytd-video-meta-block') ?? [], (node) => node.textContent).join(' ');
  const absolute = value.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (absolute && Number.isFinite(Date.parse(absolute[0]))) return Date.parse(absolute[0]);
  const relative = value.match(/(\d[\d,]*)\s*(second|minute|hour|day|week|month|year)s?\s+ago/i) ?? value.match(/(\d[\d,]*)\s*(秒|分|時間|日|週間|か月|ヶ月|年)前/);
  if (!relative) return null;
  const units = {second:1,minute:60,hour:3600,day:86400,week:604800,month:2629800,year:31557600,'秒':1,'分':60,'時間':3600,'日':86400,'週間':604800,'か月':2629800,'ヶ月':2629800,'年':31557600};
  return now - Number(relative[1].replaceAll(',', '')) * units[relative[2].toLowerCase()] * 1000;
}

export function sortedVideos(items, field, direction, now = Date.now()) {
  const values = items.map((item) => ({ ...item, value: field === 'duration' ? duration(item.data ?? {}, item.row) : date(item.data ?? {}, item.row, now) }));
  const known = values.filter((item) => item.value !== null).length;
  values.sort((a, b) => a.value === null ? (b.value === null ? 0 : 1) : b.value === null ? -1 : (a.value - b.value) * (direction === 'desc' ? -1 : 1));
  return { order: values.map((item) => item.id), known };
}
