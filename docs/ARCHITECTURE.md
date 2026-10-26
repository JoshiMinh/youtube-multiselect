# Architecture

## Goals

1. **Correct identity before convenience.** A selection must refer to one specific
   playlist *occurrence*, never "any copy of this video".
2. **Leave no trace.** Every injected node, listener, observer and timer belongs to an
   owner that removes it, so SPA navigation never leaves duplicates or stale state.
3. **YouTube changes, the core does not.** All YouTube knowledge sits behind an adapter.
4. **Read-only for now.** Nothing in this version writes to YouTube.

## Layers

```
entrypoints/
  youtube.content/index.tsx   wiring only: WXT context, bridge injection, toolbar mount, messaging
  youtube-bridge.ts           MAIN-world script: copies per-occurrence IDs onto row attributes
  popup/                      React popup: enable switch + compatibility status
src/
  adapters/types.ts           PlatformAdapter + PlaylistEntry + future PlaylistGateway
  adapters/youtube/           selectors.ts (every YouTube DOM name), entries.ts, adapter.ts
  controller/app.ts           AppController: which session (if any) should exist now
  controller/session.ts       PageSession: everything for one playlist page view
  core/                       selection.ts, export.ts, messages.ts, settings.ts (pure / tiny)
  ui/                         rowControl.ts (vanilla shadow-DOM checkbox), Toolbar.tsx (React)
```

Dependencies point downward: `entrypoints → controller → adapters/core/ui`. The controller
and UI only see `PlatformAdapter`; nothing outside `src/adapters/youtube` and the bridge
uses a YouTube selector.

## Page detection and layouts

`detectYouTubePage` accepts `https://www.youtube.com/playlist?list=<id>` only. YouTube
currently serves two desktop playlist layouts and the adapter supports both:

| Layout | Row | Container | Position |
| --- | --- | --- | --- |
| legacy | `ytd-playlist-video-renderer` | `ytd-playlist-video-list-renderer #contents` | `#index` text |
| lockup (seen live 2026-10-26, signed out) | `yt-lockup-view-model` | `#primary yt-section-list-renderer` | `index=` link param |

Rows whose watch link does not carry the page's `list=` ID are ignored. This filters out
recommendations rendered after the list, and stale rows from the previous playlist while
YouTube reuses the browse page.

## Entry identity

`PlaylistEntry.key` must be unique per occurrence.

- **occurrence** (`o:<setVideoId>`): YouTube's per-occurrence `setVideoId`. It lives in
  framework data on the row element, which isolated content scripts cannot read, so the
  tiny **MAIN-world bridge** copies it to `data-ytms-set-video-id` (paired with
  `data-ytms-video-id`) on demand. The content script dispatches `ytms:refresh-identity`
  synchronously before each scan. The bridge accepts a nested `setVideoId` only inside
  data scoped to the current `playlistId` (so a Watch Later toggle's ID is never used),
  and the content script ignores the attribute if its paired video ID doesn't match the
  row's link (recycled rows).
- **positional** (`p:<videoId>:<position>`): fallback when no occurrence ID is available.
  It distinguishes duplicates on a static page, but **reordering or removing earlier
  entries shifts positions**. The toolbar shows "position-based IDs" and the popup
  explains it. Positional keys must never be used to target writes.
- When a row's key upgrades from positional to occurrence (bridge data arrives late),
  `SelectionModel.rename` carries its selection over.

**Observed:** signed out, YouTube serves the lockup layout and its data contains no
`setVideoId` (only `contentId` and a watch endpoint with `index`), so rows are positional.
Signed in, Watch Later was served in the legacy layout with a distinct `setVideoId` on
every row (52/52). Distinct IDs for duplicate videos in a regular playlist are not yet
verified (see ROADMAP.md).

## Session lifecycle

```
AppController.refresh()   ← yt-navigate-finish | wxt:locationchange | enabled toggled
  ├─ disabled or not a playlist → dispose session
  ├─ same playlist as current   → session.scan()           (keeps selection)
  └─ different playlist         → dispose old, start new PageSession
PageSession
  start(): remove stray hosts → watch theme → scan → mount toolbar
  scan():  find container → (re)attach row observer → bridge refresh → read rows → reconcile
  dispose(): abort signal, disconnect observers, clear timers, remove hosts + toolbar, drop state
```

- One `MutationObserver` per session, scoped to the list container (`childList`, `subtree`,
  `href` attributes), batched to one scan per animation frame; mutations caused only by our
  own hosts are ignored.
- While no container exists, a temporary document observer waits for it and is disconnected
  once found.
- A 1 s liveness check detects the container being detached (ancestor replacement is
  invisible to the scoped observer).
- `ctx.onInvalidated` (extension reload/update) stops the controller; a new instance
  removes stray hosts on start.
- If the toolbar finishes mounting after its session was disposed, it is removed immediately.

## Load all

`controller/loadAll.ts` is a small loop over a `LoadPort` (`loadedCount`, `hasMore`,
`requestMore`, `expectedCount`) with injectable clock and sleep:

- Every 250 ms: if the playlist's sentinel exists, request more (YouTube loads when the
  sentinel *becomes visible*, so the adapter scrolls it into view). Then re-scan and record
  progress.
- **Done** when no sentinel is seen for 3 consecutive polls, so a sentinel that briefly
  disappears between batches doesn't end the load early.
- **Stalled** after 12 s with no new rows. Halfway there it nudges once: scrolls the sentinel
  out of view so the next request re-triggers YouTube's loader.
- **Cancelled** via an `AbortController` (toolbar Cancel, navigation, or disable). Rows
  already loaded stay loaded and selectable.
- **Capped** at 5,000 entries (YouTube's playlist limit) as a safety stop.

The session re-reads rows directly on each poll, because animation-frame scans pause in
background tabs, and restores the original scroll position when loading ends. The toolbar
shows a `<progress>` with "N / ~expected" and a Cancel button; the advertised count comes
from the header ("182 videos" / "245 lessons") and is approximate. Unavailable videos are
counted there but not rendered: live, a "272 videos" list loads 266 rows.

**Sentinel scoping (found live):** in the lockup layout YouTube also renders a second
continuation directly in the section list, for content after the playlist. It can stay
after the playlist is complete. `findContinuation` only accepts a sentinel inside an item
section that contains rows linking to this playlist. Without that, "Load all" stalled
instead of finishing on complete lists.

The MAIN-world bridge caches each row's last data object, so repeated scans during long
loads only re-walk rows whose data changed.

## Selection

`SelectionModel` stores keys, not nodes, and an anchor. Shift-click (or Shift+Space)
applies the clicked state to the range between the anchor and the target in the current
loaded order. If the anchor isn't loaded, the click is a single toggle. Selections of
entries that scrolled out or were re-rendered persist; the session keeps their last known
data in a registry for export.

## UI and isolation

- **Row control**: a `div[data-ytms-host="row"]` with an open shadow root containing a
  native `<input type="checkbox">`, `aria-label="Select: <title>"` and a `:focus-visible`
  ring. It is plain DOM rather than one React root per row, so thousands of rows stay cheap.
  Click, pointer, drag and key events are stopped at the shadow root so YouTube's row
  handlers and global shortcuts don't fire.
- **Toolbar**: React inside WXT `createShadowRootUi` (`cssInjectionMode: 'ui'`,
  `isolateEvents` for key events), fixed bottom-center: count, loaded count, Select loaded,
  Clear, Export menu (Copy titles and URLs, CSV, JSON, text), identity badge, and a polite
  live region.
- **Theme**: `html[dark]` is observed; hosts get `data-theme` and switch CSS custom
  properties. A forced-colors fallback is included.

## Export

`core/export.ts` produces text (`title<TAB>url`), CSV (RFC 4180, UTF-8 BOM, formula-injection
guard) and JSON. Downloads use a Blob URL and a temporary `<a download>`, so no `downloads`
permission is needed; copying uses `navigator.clipboard.writeText` from the click gesture.

## Permissions

| Permission | Why |
| --- | --- |
| `storage` | the enable/disable switch (`storage.local`) |
| host `https://www.youtube.com/*` | content script; also lets the popup see whether the active tab is YouTube (same scope and install warning as the content script) |
| web-accessible `youtube-bridge.js` (youtube.com only) | injecting the MAIN-world bridge |

No `tabs`, `clipboardRead`, `downloads`, remote code, analytics, accounts or backend.

## Browsers

Chrome and Edge (MV3) are the targets. `npm run build:firefox` produces an MV2 build that
uses only `browser.*` APIs via `wxt/browser`. It has not been manually tested.

## Testing strategy

| Layer | Tool | What it proves |
| --- | --- | --- |
| unit | Vitest | selection rules, export escaping, page detection, row parsing, popup status text |
| integration | Vitest + happy-dom | sessions/controllers against fixtures: injection idempotence, new rows, navigation, disable, cleanup, bridge |
| e2e (fixtures) | Playwright + real Chromium + built extension | real content script, MAIN-world bridge, shadow DOM, keyboard, downloads, popup messaging, with youtube.com **routed to fixture pages** |
| live (opt-in) | Playwright against real youtube.com, signed out | selectors, continuation loading and navigation on the current site |
