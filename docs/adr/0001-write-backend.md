# ADR 0001: Write backend for copy, move and remove

- **Status:** Accepted, 2026-10-27, on the assumption of a **public release** (confirmed by
  the owner). Revisit if that changes.
- **Context:** Phase 4 adds writes (copy, move, remove) behind the `PlaylistGateway`
  interface in `src/adapters/types.ts`. Which backend implements it was left open in
  `docs/ROADMAP.md`.

## Facts checked on 2026-10-27

Sources: Google's YouTube Data API v3 documentation (quota cost table, `playlistItems`
reference, `playlistItems.insert`, revision history, quota and compliance audits page), the
YouTube API Services Terms of Service and Developer Policies, and Chrome's `identity` API
reference.

| Fact | Value |
| --- | --- |
| Default quota | 10,000 units/day **per Google Cloud project** |
| `playlistItems.insert` / `delete` / `update` | 50 units each |
| `playlistItems.list`, `playlists.list` | 1 unit per call |
| Scopes accepted by `insert` | `youtube`, `youtube.force-ssl`, `youtubepartner` |
| Watch Later and watch history | Not accessible via the API. Reads return empty lists (revision history, 2016-09-15, restated 2021-01-28) |
| `insert` duplicate handling | The docs list no duplicate error, so a retried insert can create a second copy |
| Playlist limits | `playlistContainsMaximumNumberOfVideos` (403) when full |
| More quota | A project must "first complete an audit" showing compliance with the API Services Terms; the page states no timeline or approval criteria |
| ToS §7 | Each API client must have a published privacy policy describing the user data it accesses, stores and shares |
| ToS §8, §24.3 | Reasonable safeguards for user data; delete API data on termination |
| ToS §10, §11 | Follow the branding guidelines; don't alter YouTube or Google terms or notices |
| ToS §15 | "will not attempt to, exceed or circumvent use or quota restrictions" |
| Policy III.D.7 | "You must not use undocumented APIs without express permission" |
| Policy III.E.6 / III.I.14 | No scraping, and no access to API data by other technology |
| Policy III.I.2 | No automating likes, uploads, comments and similar without the user's specific, express consent |
| Chrome `identity` | `getAuthToken` uses the manifest `oauth2` client and is documented for Chrome; `launchWebAuthFlow` gives a redirect-based flow |

**Not verified** (the pages fetched did not say): which scopes Google classes as sensitive or
restricted and what verification they trigger, Testing-mode user cap and token expiry,
whether the Developer Policies address credentials embedded in a browser extension,
Chrome Web Store requirements for this permission set, and Firefox or Edge behaviour of
`chrome.identity`. These must be checked before building the auth flow or submitting the
audit.

## Options

### A. Official YouTube Data API v3

- Documented, versioned, and the only option consistent with the developer policies.
- Needs OAuth, a Google Cloud project, a consent screen and app verification before
  non-test users can sign in.
- **The quota is shared by every install of one project.** At 50 units per write, the
  default is 200 inserts or deletes a day *in total*, about 100 moves (insert + delete).
  A public extension is unusable for writes at that size, so it **requires an audit and a
  quota increase**.
- The project has no backend (see `ARCHITECTURE.md`), so it **cannot meter or allocate
  quota fairly between users**. One heavy user can exhaust it for everyone.
- Reads are cheap (1 unit per 50 entries), which suits the "reconcile before retry" step.
- Cannot touch Watch Later or History.
- Responses carry the new item's `id`, so `destOccurrenceId` can be recorded for rollback.

### B. YouTube web client endpoints from the signed-in page

- Same paths the site's own menus use; no consent screen, no Cloud project, no quota we
  can see, and Watch Later works.
- Undocumented: can change or break without notice, and every change needs a live re-check.
- For a **public** product the policy risk is the deciding factor. The developer policies
  forbid undocumented APIs and non-API access for API Services clients, and a widely
  distributed extension that automates writes through private endpoints invites a store or
  account action against it and its users. YouTube's own terms on automated access have not
  been reviewed here.
- Failure handling is harder: no documented error codes, and rate limits are unknown.

### C. Drive YouTube's own UI (click its menus)

Rejected. It is slower and more fragile than B, and it makes reliable per-item
confirmation impractical.

## Decision

1. **Writes use option A (Data API v3), for playlists the signed-in user owns.** Option B
   is not used for normal playlists in the public build.
2. **Release in two stages so the public product is useful before quota is.**
   - *Stage 1 (now, no OAuth, no quota):* ship the read-only features publicly: selection,
     Load all, filter, duplicates, keyboard, export.
   - *Stage 2 (writes):* ship only after (a) the OAuth app is verified, (b) the compliance
     audit is passed and a quota increase is granted, and (c) the privacy policy is
     published. Until those hold, the write UI is not shipped.
3. **Interim opt-in for early adopters: a user-supplied OAuth client ID** (an advanced
   setting, off by default), so a person can use their own project's 10,000 units before
   the shared quota is raised. This is for a user's *own* use of their *own* project. The
   extension must not encourage creating several projects to multiply quota. ToS §15
   forbids circumventing quota, and whether this setting is acceptable should be confirmed
   before it ships.
4. **The engine tracks quota locally.** It estimates cost before running ("40 items to move:
   about 4,000 units"), refuses to start an operation it knows cannot finish, and pauses
   cleanly on `quotaExceeded` instead of retrying. With a shared project quota it can only
   see its own usage, so the UI must say a failure may be because the shared quota is used up.
5. **Watch Later (and History) stay out of scope.** They are not available through the API.
   If ever pursued they would need a separate decision, with the policy risk above weighed
   for a public build, and would stay behind the same gateway interface.
6. **`PlaylistGateway` stays the only seam.** The operation engine, journal and reconcile
   logic must not know which backend is in use.

## Consequences

- Public users get a working read-only tool soon. Writes depend on external approvals with
  no stated timeline, so the roadmap's Phase 4 has a calendar risk outside our control.
- Public distribution adds obligations the prototype does not have: a published privacy
  policy, safeguards for tokens (stored locally only, never sent to us), YouTube branding
  and attribution rules, a store listing that justifies the new `identity` permission, and
  responding to periodic audits.
- The "never changes your playlists" text in the README, popup and store listing changes
  in the release that adds writes, and writes require an explicit confirmation step per the
  roadmap.
- The Phase 4 reliability design (journal, reconcile before retry, move = copy → verify →
  remove) applies unchanged. Reconcile is mandatory because retried inserts can duplicate.
- Throughput is capped by whatever quota the audit grants. Large cleanups may take several
  days; the UI states the cost up front.
- Auth differs by browser (`getAuthToken` is Chrome-specific); Edge and Firefox need
  `launchWebAuthFlow`. This is unverified and part of the first Phase 4 task.

## What would change this decision

- The audit is refused or stalls: keep the extension read-only and export-only, or move
  writes to the user's own client ID only. Option B stays rejected for the public build.
- Google exposes Watch Later in the API: it joins option A with no other change.
- The identity check shows duplicate copies of one video do not get distinct IDs: writes
  cannot target a specific copy, so duplicate actions stay disabled regardless of backend.
- The owner drops the public-release plan: revert to a personal-use decision with
  bring-your-own client ID as the default.

## Open items before Phase 4

1. Verify OAuth verification requirements for the chosen scope, Testing-mode limits, and
   per-browser `identity` behaviour.
2. Read the Developer Policies compliance guide and confirm the credentials-in-an-extension
   and user-supplied-client-ID questions.
3. Draft the privacy policy and the audit submission (intended use cases, data handling).
4. Finish the duplicate-ID check on a playlist that really has repeats.
5. Decide whether Watch Later is worth a spike at all, given option B's risk for a public
   build.
