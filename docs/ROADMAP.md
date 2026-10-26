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

## Next concrete milestone

**Phase 2a: signed-in identity and full-list loading spike.**
1. With a signed-in test account that owns a playlist containing the same video twice,
   record which layout and data shape YouTube serves, and whether the bridge produces
   occurrence IDs (`npm run test:live` with a pinned playlist, plus manual check).
2. Prototype "Load all" via continuation scrolling with progress and cancel, behind the
   adapter, with fixture tests for 1,000+ rows and a live check on the 182-entry public list.
3. Update this roadmap with the findings before starting filters/duplicates.
