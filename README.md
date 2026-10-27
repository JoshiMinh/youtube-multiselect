# pollux-private

**Private, personal-use only. Do not publish, commit to a public repo or redistribute.**
This is a WXT port of Pollux's "Multiselect for YouTube" v3.5, which ships without a license.

- `original/` untouched copy of the supplied files (reference only).
- `entrypoints/background.ts`, `entrypoints/content/index.ts` readable ports of `background.js` and `js/content.js`.
- `entrypoints/popup`, `entrypoints/options`, `src/options.js` the original settings UI.
- `public/js/polymer.js` the original page script with **one patch** (below).
- `public/_locales`, `public/icons`, `assets/options.css` copied unchanged.

## The fix

YouTube replaced the playlist header data `header.playlistHeaderRenderer` with
`header.pageHeaderRenderer`. The page script read the playlist ID and `isEditable` from the old
object, got `undefined`, and treated every playlist as read-only, so the multiselect UI never
appeared. `Q()` now falls back to the data on `ytd-playlist-video-list-renderer`, which still has
`playlistId` and `isEditable` (checked on a live signed-in playlist, 2026-10-27).

Not patched: the "load entire playlist" progress estimate reads `numVideosText` from the old
header and falls back to 5000, so its progress bar moves slowly. It still works.

## Use

```bash
npm install
npm run build
```

Remove the original extension first (same shortcuts), then in `chrome://extensions` turn on
Developer mode and **Load unpacked** `.output/chrome-mv3`. Reload open YouTube tabs.
`node smoke.mjs` loads the build in Chromium on a public playlist and checks for errors.
