<p align="center">
  <img src="assets/icon_logo.svg" alt="Youtube Multiselect logo" width="96" height="96">
</p>

# Youtube Multiselect

Youtube Multiselect is a browser extension for selecting and managing multiple
videos at once on YouTube and YouTube Music.

It adds batch controls to playlists, Watch Later, subscriptions, search results,
and other video lists. The interface follows YouTube's light and dark themes and
keeps preferences in the local browser profile.

## What it can do

- Select individual videos with the mouse or keyboard.
- Select all videos or select by title, channel, watched progress, duration, or
  position.
- Search for duplicate videos, including in the reverse direction.
- Copy, cut, and paste videos between playlists.
- Add videos to a playlist, Watch Later, or the queue.
- Move selected videos to the top or bottom of an editable playlist.
- Remove selected videos and optionally skip the removal confirmation.
- Group selected videos by channel or reverse playlist order.
- Load an entire playlist before selecting videos.
- Keep a selection while copying and optionally display video indexes.
- Sort playlist names.
- Use a floating action bar at the bottom center, bottom left, or a custom
  position.
- Configure the extension through the options page.
- Use the interface in 14 languages.

The options page includes the complete keyboard shortcut reference and settings
for selection behavior, playlist display, and the action bar.

## Privacy

Youtube Multiselect processes the video and playlist information needed to carry
out actions that you request on YouTube and YouTube Music. Preferences and
interface state are stored locally through the browser storage API.

The extension does not operate a remote analytics service, sell personal
information, or transfer user data to third parties. It does not collect
passwords, payment information, messages, health information, or precise
location data.

Read the complete policy in [privacy.html](privacy.html).

## Install from a local build

### Requirements

- Node.js
- pnpm
- Chromium or Firefox for loading an unpacked extension

### Chromium

```bash
pnpm install
pnpm build
```

Open `chrome://extensions`, enable Developer mode, select **Load unpacked**,
and choose `.output/chrome-mv3`.

If an earlier build was loaded from another location, open a new YouTube tab
after loading the new build. Existing tabs usually reconnect without a refresh.

### Firefox

```bash
pnpm install
pnpm build:firefox
```

Open `about:debugging`, choose **This Firefox**, select **Load Temporary Add-on**,
and load the generated extension from `.output/firefox-mv2`.

## Development

Start WXT in development mode:

```bash
pnpm dev
```

WXT provides hot reload while developing the extension. The options page is
defined in [entrypoints/options/index.html](entrypoints/options/index.html).
The popup uses the same shared settings logic from [src/options.js](src/options.js).

Run the type checker:

```bash
pnpm typecheck
```

Create a production build:

```bash
pnpm build
```

Build the Firefox variant:

```bash
pnpm build:firefox
```

Create a package for store upload:

```bash
pnpm zip
```

## Smoke test

After creating a Chromium build, the Playwright smoke test loads it in a
persistent Chromium context and opens a public YouTube playlist while checking
for extension-related page errors:

```bash
node smoke.mjs
```

The smoke test requires Playwright's Chromium channel to be available locally.
It uses a public playlist and does not sign in to YouTube.

## Repository structure

| Path | Purpose |
| --- | --- |
| `entrypoints/background.ts` | Background service worker and extension events |
| `entrypoints/content/index.ts` | Content-script entrypoint and page-script bridge |
| `entrypoints/content/style.css` | Content-script styles |
| `entrypoints/options/index.html` | Settings and keyboard-shortcuts page |
| `src/options.js` | Shared popup and options-page behavior |
| `src/options.css` | Popup and options-page styles |
| `src/polymer/entry.js` | Page-script bundle entrypoint |
| `src/polymer/core.js` | Page-side selection logic, menus, dialogs, and action bar |
| `src/_locales/` | Translations |
| `assets/` | Extension logo, icons, and generated static assets |
| `index.html` | Project overview page |
| `privacy.html` | Privacy policy |
| `site.css` | Shared styles for the project pages |
| `smoke.mjs` | Chromium Playwright smoke test |
| `wxt.config.ts` | WXT and extension manifest configuration |

## Architecture notes

The content script runs on YouTube and YouTube Music pages and injects the
page-side script that interacts with the video-list UI. The background service
worker handles extension-level events. The popup and options page share the
same settings definitions and browser storage behavior.

The page-side source is split into a small bundle entrypoint and a core runtime,
but production builds still emit one `polymer.js` file. This preserves the
existing page-script injection, message protocol, and teardown behavior while
allowing future behavior-focused modules to be extracted safely.

The extension uses the browser's existing signed-in session to perform actions
that the user initiates. It does not provide a separate YouTube API service or
backend.

## Localization

Translations live under [src/_locales](src/_locales). English is the
default locale. When adding a user-facing message, add the message to the
English catalog first and update the other locale files as appropriate.

## Attribution and licensing

This project builds on the original Multiselect for YouTube extension by
Pollux. The page-side runtime in `src/polymer/core.js` and the translations in
`src/_locales/` derive from that work.

The repository license applies only to files identified as original work by
the copyright holder. See [LICENSE](LICENSE) for the precise scope and the
licensing terms. Material derived from the original extension remains subject
to the terms set by its original author.

## Support

Report bugs, request features, and ask questions in the
[GitHub issue tracker](https://github.com/JoshiMinh/youtube-multiselect/issues).
