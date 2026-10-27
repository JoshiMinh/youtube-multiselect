# YouTube Multiselect

A browser extension for selecting YouTube playlist entries in bulk. This version is a
**read-only prototype**: it selects and exports, and never changes your playlists.

Built with TypeScript, [WXT](https://wxt.dev) 0.21, React 19 and Manifest V3. Targets
Chrome and Edge; a Firefox build is produced but not yet tested.

## Features

- Checkbox beside every entry on desktop playlist pages (`youtube.com/playlist?list=…`)
- Click to toggle, **Shift-click** (or Shift+Space) to select a range
- **Select loaded** / **Clear**, with a small toolbar showing the count
- **Load all**: scrolls the playlist until every entry is loaded, with progress and Cancel,
  then returns you to where you were
- **⋮ menu**: *Select with filter…* (title or channel text, optional case-sensitive, plus
  duration in minutes and position range; every field you fill in must match) and
  *Select duplicates* (keeps the first copy; only offered when every copy has a stable
  per-occurrence ID). Both act on loaded entries, so use Load all first for a full list
- **Keyboard** (with a row checkbox focused): ↑/↓ move between rows, Home/End jump to the
  first/last loaded row, Ctrl+←/→ jump to the previous/next selected row, Space toggles
  (Shift+Space extends a range). Ctrl/Cmd+A selects all loaded entries, or clears when they
  all are selected; it works anywhere on the page except in text fields
- Selection survives more rows loading as you scroll
- Handles YouTube's in-page navigation: no duplicate controls, no stale selection
- Duplicate videos in one playlist are separate entries (see *Limitations*)
- Follows YouTube's light/dark theme; keyboard accessible with visible focus
- Export the selection: copy titles + URLs, or download CSV / JSON / text
- Popup with an on/off switch and a compatibility status for the current tab

## Install (Load unpacked)

Requires Node.js 22 or newer.

```bash
npm ci
```

```bash
npm run build
```

Then:

1. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and pick the `.output/chrome-mv3` folder in this repository.
4. Open a playlist on www.youtube.com. Reload any YouTube tab that was already open.

After rebuilding, click the reload icon on the extension card and reload the YouTube tab.

## Development

| Command | What it does |
| --- | --- |
| `npm run dev` | Chrome with the extension loaded and hot reload |
| `npm run dev:edge` / `npm run dev:firefox` | same for Edge / Firefox |
| `npm run build` | production build to `.output/chrome-mv3` |
| `npm run build:edge` / `npm run build:firefox` | other targets (`.output/edge-mv3`, `.output/firefox-mv2`) |
| `npm run zip` | zipped Chrome build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | unit + integration tests (Vitest, happy-dom) |
| `npm run test:e2e` | Playwright: built extension in Chromium against **fixture** pages |
| `npm run test:live` | Playwright: **real youtube.com**, signed out, read-only (network) |
| `npm run check` | typecheck + lint + test + build |
| `npm run icons` | regenerate `public/icon/*.png` |

First-time e2e setup downloads Playwright's Chromium:

```bash
npx playwright install chromium
```

Full verification:

```bash
npm run check && npm run test:e2e
```

`test:live` is opt-in because it depends on the live site. Set `YTMS_LIVE_PLAYLIST` /
`YTMS_LIVE_LONG_PLAYLIST` to pin public playlists.

To check whether YouTube exposes per-occurrence IDs on a page, for example signed in on
your own playlist, paste [scripts/identity-probe.js](scripts/identity-probe.js) into
DevTools there. It is read-only.

## Limitations

- **Entry identity**: the extension prefers YouTube's per-occurrence ID (`setVideoId`). When
  YouTube doesn't expose it, as on the current layout when signed out, duplicates are told
  apart by **position**. The toolbar then shows "position-based IDs". Positions shift if the
  playlist is reordered or earlier entries are removed while the page is open.
- Only loaded entries can be selected; use **Load all** for the rest. Unavailable videos in
  YouTube's count are never shown, so "266 of ~272" can be the complete list.
- "Load all" scrolls the page while it runs and works best in the foreground tab.
- Desktop `www.youtube.com` playlist pages only. Not supported: `m.youtube.com`, watch-page
  playlist panels, channel pages, Shorts, YouTube Music.
- No playlist changes of any kind in this version.
- Signed-in behaviour and Firefox have not been verified yet.

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): design, identity, lifecycle, permissions
- [docs/ROADMAP.md](docs/ROADMAP.md): next phases, including reliable copy/move/remove
- [docs/PROVENANCE.md](docs/PROVENANCE.md): relationship to "Multiselect for YouTube" and licensing

## Privacy

No accounts, analytics, network requests or backend. The only stored value is the on/off
switch (`storage.local`). Exports are generated locally.

## License

MIT. See [LICENSE](LICENSE).
