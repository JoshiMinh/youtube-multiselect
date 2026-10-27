<p align="center">
  <img src="public/icons/logo.svg" alt="Youtube Multiselect" width="96" height="96" />
</p>

# Youtube Multiselect

A browser extension that adds multi-selection to YouTube playlists, Watch Later, subscriptions and
other video lists. Select many videos at once, then copy, cut, paste, add to a playlist or queue,
remove, or download the selection. The interface is styled to match YouTube's own light and dark
themes.

## Features

- Select videos with the mouse or the keyboard, one at a time or all at once.
- Select with a filter on title, channel name or watched progress, with optional case sensitivity.
- Select duplicates, searching forward or backward.
- Select by duration and by position range.
- Copy, cut and paste videos between playlists, and add videos from a file.
- Add the selection to a playlist, Watch Later or the queue, move it to the top or bottom of a
  playlist, or remove it.
- Load an entire playlist before selecting.
- Optional video index in playlists, sorted playlist names, and selection that survives copying.
- Floating action bar that can sit at the bottom center, bottom left, or anywhere you drag it.
- Localized into 14 languages.

The manual and the full list of keyboard shortcuts are on the extension's options page.

## Install

Requirements: Node.js and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm build
```

Then open `chrome://extensions`, turn on Developer mode, choose **Load unpacked** and select
`.output/chrome-mv3`. Reload any open YouTube tabs.

For Firefox, run `pnpm build:firefox` and load `.output/firefox-mv2` from `about:debugging`.

## Development

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start WXT with hot reload in a dev browser |
| `pnpm build` | Production build for Chromium |
| `pnpm build:firefox` | Production build for Firefox |
| `pnpm zip` | Package the build for store upload |
| `pnpm typecheck` | Run the TypeScript checker |
| `node smoke.mjs` | Load the build in Chromium on a public playlist and check for errors |

## Project layout

| Path | Contents |
| --- | --- |
| `entrypoints/background.ts` | Background service worker |
| `entrypoints/content/` | Content script that injects the page script and relays settings |
| `entrypoints/popup/`, `entrypoints/options/` | Popup and options pages |
| `src/options.js` | Shared script for the popup and options pages |
| `assets/options.css` | Styles for the popup and options pages |
| `public/js/polymer.js` | Page script: selection logic, action bar, menus and dialogs |
| `public/_locales/` | Translations |
| `public/icons/` | Logo (`logo.svg`) and the PNG sizes generated from it |

## Playlist header change

YouTube replaced the playlist header data `header.playlistHeaderRenderer` with
`header.pageHeaderRenderer`. The page script read the playlist ID and `isEditable` from the old
object, got `undefined`, and treated every playlist as read-only, so the selection interface never
appeared. The script now falls back to the data on `ytd-playlist-video-list-renderer`, which still
carries both values.

The progress estimate for "load entire playlist" still reads `numVideosText` from the old header
and falls back to 5000, so its bar moves slowly. Loading itself works.

## Credits

This project builds on the original "Multiselect for YouTube" extension by Pollux. The page script
in `public/js/polymer.js` and the translations in `public/_locales/` derive from that work.

## License

See [LICENSE](LICENSE). The license covers only the files that are original to this repository.
It does not cover material derived from the original extension.
