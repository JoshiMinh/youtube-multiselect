# Roadmap

Each phase ends with green `npm run check`, fixture e2e tests, and a recorded live check.
Facts about YouTube APIs below must be **re-verified at the start of each phase**; they
were current to our knowledge in October 2026.

## Phase 1: read-only selection prototype (done)

Playlist detection (legacy + lockup layouts), per-row accessible checkboxes, Shift ranges,
select loaded, clear, toolbar, popup with enable switch and status, export (copy, CSV,
JSON, text), SPA navigation lifecycle, theme following, identity bridge, test pyramid.

## Phase 2: complete loading, filtering, duplicate detection (still read-only)

- **Load complete playlist.** Two candidates, to be prototyped side by side:
  1. *Drive continuation in the page*: scroll the continuation sentinel into view until it
     disappears. Simple, but slow on long lists and dependent on the layout.
  2. *Read continuation data*: request the page's own continuation responses from the
     MAIN world. Faster, but uses undocumented endpoints.

  Both must be cancellable, show progress, and stop at a configurable cap. Entries become
  "known" even when not rendered, so selection and export can cover the whole list.
- **Filtering**: title/channel text, unavailable/private videos, duration, position range.
  Filters act on known entries and compose with "select all matching".
- **Duplicate detection**: group by `videoId`; offer "select all but the first occurrence".
  This requires occurrence identity for *every* entry in the group; with positional keys
  the UI may report duplicates but must not offer actions on them.
- **Signed-in identity check**: verify whether the lockup layout exposes `setVideoId` for
  playlists the user owns (the bridge already looks for it). If not, find another
  per-occurrence source before Phase 4.

## Phase 3: choose the write backend

| | Official YouTube Data API v3 | YouTube web client endpoints (signed-in page session) |
| --- | --- | --- |
| Auth | OAuth via `identity` API; needs a Google Cloud project and consent screen review | the user's existing YouTube session; no extra consent |
| Stability | versioned and documented | undocumented; can change without notice |
| Quota | playlistItems insert/delete cost 50 units each against a default 10,000/day project quota (≈200 writes/day for all users together, unless raised) | rate-limited per account, limits unknown |
| Watch Later / History | not supported (see below) | the same UI paths the site uses |
| Policy | API Terms of Service and branding rules | must review YouTube ToS for automated use |

**Decision (accepted for a public release): see [ADR 0001](adr/0001-write-backend.md).** Data
API v3 for playlists the user owns. Read-only features ship publicly first; writes ship only
after OAuth verification, the quota audit and a published privacy policy. Watch Later is out
of scope. Facts in the table above were re-checked on 2026-10-27 and are listed there.

The decision gets recorded as an ADR. The `PlaylistGateway` interface
(`src/adapters/types.ts`) hides the choice from the operation engine. A hybrid is possible:
API for normal playlists, web client only where the API cannot work.

## Phase 4: reliable copy, move and remove

### Operation model

```
Operation { id, kind: copy|move|remove, source, destination?, createdAt, state, items[] }
Item      { key, videoId, occurrenceId, state, attempts, lastError?, destOccurrenceId? }
item.state: pending → in-flight → (confirmed | failed | skipped)
                         ↘ uncertain → (reconcile) → confirmed | pending | failed
```

- **Persistent checkpoints**: the operation journal lives in `storage.local` (or IndexedDB
  if it grows) and is written *before* each request (`in-flight`) and *after* each result.
  The MV3 service worker can be terminated at any time. On startup (`runtime.onStartup`,
  `onInstalled`) and on a keep-alive `alarms` tick, the worker resumes unfinished
  operations from the journal. No operation state lives only in memory.
- **Controlled concurrency**: a small fixed pool (start at 2) with exponential backoff and
  jitter on 429/5xx, and a global pause when the backend signals rate limiting.
- **Cancellation**: a persisted `cancelRequested` flag checked between items. In-flight
  requests are aborted where possible; their items become `uncertain`, never assumed
  failed.
- **Per-item outcomes**: the UI shows confirmed/failed/skipped/uncertain counts and a
  downloadable report (reusing the export module).
- **Reconcile before retry**: an `in-flight` or `uncertain` item (timeout, worker death,
  network drop) is never blindly retried. The engine re-reads the destination (or source,
  for removes), matches by video ID and new occurrence IDs not seen before the operation,
  then marks it `confirmed` or puts it back to `pending`. This prevents duplicate inserts.
- **Move = copy → verify → remove**: the source occurrence (by `occurrenceId`, never by
  position) is removed only after the destination copy has been **confirmed by reading it
  back**. If verification fails, the source is left untouched and the item is reported.
- **Preconditions**: writes require occurrence identity for every targeted item. Positional
  keys block write actions with an explanation.
- **Honest recovery**: no universal undo. A removal can be "undone" only by re-adding,
  which creates a *new* occurrence at a different position and loses the original
  added-date. The UI states this before destructive actions, and the report lists exactly
  what changed so users can repair by hand. Copies can be rolled back by removing the
  recorded `destOccurrenceId`s.
- **Confirmation UX**: destructive actions show a summary (counts, source/destination)
  and require explicit confirmation. Large operations require typing a confirmation word.

### Tests to add

A fake `PlaylistGateway` with injectable latency, failures, timeouts after commit
("succeeded but the response was lost"), and rate limits. Simulated worker restarts at every
journal state. Property tests that a move never removes a source without a confirmed copy.

## Watch Later: separate investigation

The official Data API no longer exposes Watch Later (`WL`) contents. Listing returns no
items and writes are rejected. Supporting it means using the web client's own data and
commands for that list, with all the stability and policy risks above, plus a separate
identity check (Watch Later rows may use a different layout). Treat it as its own spike
with a go/no-go decision. Don't assume the Phase 4 engine works for it unchanged.

## Phase 2a status (2026-10-26)

**Load all: done.** Continuation scrolling with progress, cancel, stall detection
with one nudge, a 5,000 cap, and scroll restore. Tested with fixtures (1,050–3,000 rows in
happy-dom; 1,200 rows in real Chromium for both layouts, with cancel) and live, signed out:

| Public playlist | Advertised | Loaded | Time |
| --- | --- | --- | --- |
| PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI | 182 videos | 182 | 1.8 s |
| PLkKvotUGCyLeSDxODsglLJ0ET5PJ8K7e2 (course) | 245 lessons | 245 | 2.1 s |
| PLQKBpQZcRycrvUUxLdVmlfMChJS0S5Zw0 | 272 videos | 266 (rest unavailable) | 2.4 s |

The live run exposed the trailing section-list sentinel (see ARCHITECTURE.md › Load all),
now fixed and covered by fixtures.

Not yet verified: playlists over ~300 entries live, background-tab behaviour, and
Watch Later / Liked videos.

**Signed-in occurrence identity: partly verified.**

| Session | Page | Layout | Rows with `setVideoId` |
| --- | --- | --- | --- |
| signed out | public playlists | `yt-lockup-view-model` | 0 (none anywhere in row data) |
| signed in (2026-10-26) | Watch Later (`list=WL`), 52 entries | `ytd-playlist-video-renderer` | **52 / 52, all distinct** |

Signed in, the ID sits directly on the row data (`data.setVideoId`) and again inside
`menu…playlistEditEndpoint.actions[*]` scoped to this playlist. Both paths are read by the
bridge's `findOccurrenceId`, so signed-in rows should get `occurrence` identity. The layout
depends on sign-in state; the adapter supports both.

**Still unverified:** whether two copies of the *same* video in a regular playlist get
distinct IDs. Watch Later can't hold duplicates. To finish, open a regular playlist with a
repeated video while signed in, paste `scripts/identity-probe.js` into DevTools, and check
that `duplicate occurrenceIds=0` while `duplicate videoIds>0`.

Outcomes:
- IDs present and scoped to the playlist: the bridge already uses them; add a fixture with
  the observed data path and a live assertion.
- IDs only appear after opening a row's menu: investigate reading them without UI
  interaction before Phase 4.
- No IDs: Phase 4 needs another identity source (e.g. reading the playlist via the write
  backend chosen in Phase 3). Duplicate actions stay disabled meanwhile.

## Phase 2b status (2026-10-27)

**Done:** text filter (title/channel, case-sensitive option) and *Select duplicates* in the
toolbar's ⋮ menu (`src/core/filter.ts`). Duplicates keep the first copy and are offered only
for groups where every copy has occurrence identity; positional groups are counted and
reported but not acted on. Covered by unit, session and toolbar tests.

**Also done (2026-10-27):** duration (min/max minutes) and position-range criteria in the
same filter popover. All set criteria must match; rows with an unknown duration (LIVE) or
position never match a criterion on it. Duration comes from the thumbnail badge; checked
live on the legacy layout, and covered by fixtures for both layouts. The lockup layout's
real badge markup has not been observed signed in.

**Not done:** unavailable/private filter. Unavailable rows currently have no usable link and
are skipped by the adapter, so selecting them needs their markup observed on a playlist that
actually contains one (none of the account's playlists did on 2026-10-27).

**Signed-in identity check (2026-10-27), read-only fetch of each playlist's first page
(`ytInitialData`), 17 non-empty playlists incl. Watch Later:** every row had a `setVideoId`
(1–100 rows per playlist) and all IDs were distinct within each playlist. None contained a
repeated video, so whether two copies of one video get distinct IDs is still unverified.
To settle it, add the same video twice to a throwaway playlist (a deliberate write, done by
the account owner) and re-run `scripts/identity-probe.js`.

## Next concrete milestone

1. Finish the signed-in identity check above.
2. Remaining Phase 2b filters (unavailable, duration, position range).
3. Keyboard layer: **done** (2026-10-27): arrows, Home/End, Ctrl+←/→ between selected rows,
   Ctrl/Cmd+A toggle (`src/core/keyboard.ts`; unit, session and Chromium e2e tests).
   Delete/cut/paste shortcuts wait for Phase 4.
