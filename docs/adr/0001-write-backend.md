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

### Follow-up verification (2026-10-27)

Sources: Google Cloud Console help (app audience and publishing status, sensitive-scope
verification), the YouTube Developer Policies compliance guide, Chrome's OAuth guide and
Web Store user-data FAQ, MDN's `identity` page, and Microsoft's Edge extension API support
page.

| Question | Finding |
| --- | --- |
| Are the YouTube scopes sensitive? | **Google's scope list and verification pages do not label them.** Secondary sources, including a developer-forum post by a team whose app was approved, say `youtube` and `youtube.force-ssl` are sensitive. Treat as sensitive until the Cloud Console consent-screen page shows the indicator for the chosen scope. |
| What does verification need? | Public home page, a privacy policy **hosted on the same domain as the home page**, an unlisted demo video of the consent flow, a written justification for each scope (why a narrower one would not do), and domain ownership proven in Search Console. Typical review: 3–5 business days. **This means we need a domain.** |
| Testing status | Up to 100 test users. Test-user authorizations (including refresh tokens) **expire after 7 days**. |
| In production, unverified | **100 new users, lifetime, cannot be reset**, after which sign-in is blocked. |
| Quota sharding | The developer policies guide forbids creating multiple projects for the same service or use case to get more quota ("sharding"). Separate projects for different use cases or environments are allowed. |
| Users supplying their own credentials | The guide **does not address it**. It is therefore neither allowed nor forbidden in writing. |
| Client credentials in an extension | The guide does not address it. Chrome's own OAuth setup uses a client ID in the manifest, with an OAuth client of type "Chrome Extension" and no client secret. |
| Edge | `identity.getAuthToken` and `getAccounts` are **not supported**; Microsoft points to `launchWebAuthFlow` instead. |
| Firefox | No `getAuthToken`. `launchWebAuthFlow` only, with a redirect URL derived from the add-on ID. Google rejects unverified redirect domains, so the loopback form `http://127.0.0.1/mozoauth2/<subdomain>` (Firefox 86+) is the route. |
| Chrome Web Store | A privacy policy is required for any product that handles user data, **even if stored only locally**. A prominent in-extension disclosure with an explicit consent action must come before data is handled (a policy link or store listing does not count). A Limited Use disclosure must be on the homepage or one click away. Request the narrowest permissions, use optional permissions for extra capabilities, and add a new permission only in the update that needs it. Mismatches between policy, dashboard disclosures and behaviour can lead to suspension or a publisher ban. |
| Data retention (policies guide) | Users must be able to ask for deletion of their data, and stored data must not be kept indefinitely; deletion requests are handled within 30 days. |

**Still not verified:** the exact sensitivity label in the Cloud Console for our scope; the
OAuth client type and flow that work with `launchWebAuthFlow` without a client secret
(authorization code with PKCE versus implicit); the Edge Add-ons store's own policy
requirements; and whether the read-only Stage 1 release already needs a privacy policy and
consent disclosure (the Chrome FAQ suggests it may, because the extension reads playlist
content on the page, but that was not tested against our exact behaviour).

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
3. **No user-supplied OAuth client ID in the public build** unless YouTube API Services
   confirms in writing that it is acceptable. The policies guide is silent on users bringing
   their own credentials, but it forbids quota "sharding", ToS §15 forbids circumventing
   quota, and a feature whose purpose is to multiply quota across projects looks like both.
   It remains an option for a private or personal build.
4. **One OAuth path for all browsers: `launchWebAuthFlow`.** Edge has no `getAuthToken` and
   Firefox never had it, so using `launchWebAuthFlow` everywhere avoids two code paths. The
   Firefox redirect must use the loopback form. The flow type (authorization code with PKCE
   versus implicit) is still to be verified.
5. **Request `identity` as an optional permission**, only in the release that adds writes,
   with the in-extension disclosure and explicit consent step the Chrome Web Store requires
   before any user data is handled.
6. **The engine tracks quota locally.** It estimates cost before running ("40 items to move:
   about 4,000 units"), refuses to start an operation it knows cannot finish, and pauses
   cleanly on `quotaExceeded` instead of retrying. With a shared project quota it can only
   see its own usage, so the UI must say a failure may be because the shared quota is used up.
7. **Watch Later (and History) stay out of scope.** They are not available through the API.
   If ever pursued they would need a separate decision, with the policy risk above weighed
   for a public build, and would stay behind the same gateway interface.
8. **`PlaylistGateway` stays the only seam.** The operation engine, journal and reconcile
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
- Auth uses `launchWebAuthFlow` on every browser (Edge and Firefox lack `getAuthToken`).
  Until the app is verified, sign-in is limited to 100 test users whose authorization expires
  every 7 days, or 100 lifetime new users once in production, so an unverified write
  release cannot reach a public audience. Writes wait for verification.
- Verification needs a domain, a privacy policy on it and a public home page, so setting
  those up is on the critical path for Stage 2.

## What would change this decision

- The audit is refused or stalls: keep the extension read-only and export-only, or move
  writes to the user's own client ID only. Option B stays rejected for the public build.
- Google exposes Watch Later in the API: it joins option A with no other change.
- The identity check shows duplicate copies of one video do not get distinct IDs: writes
  cannot target a specific copy, so duplicate actions stay disabled regardless of backend.
- The owner drops the public-release plan: revert to a personal-use decision with
  bring-your-own client ID as the default.

## Open items before Phase 4

1. **Get a domain** for the project home page and privacy policy (verification requires the
   policy on the same domain as the home page, and Search Console ownership).
2. Confirm the sensitivity label for the chosen scope in the Cloud Console, and pick the
   narrowest scope that allows `playlistItems` insert and delete.
3. Verify the `launchWebAuthFlow` OAuth setup (client type, PKCE or implicit, redirect URIs for
   Chrome, Edge and the Firefox loopback form) with a throwaway project in Testing status.
4. Draft the privacy policy, Limited Use disclosure, in-extension consent disclosure, demo
   video script and per-scope justification. Check whether Stage 1 (read-only) already needs
   the privacy policy and disclosure for the Chrome Web Store and the Edge Add-ons store.
5. Ask YouTube API Services whether a user-supplied client ID is acceptable (only if that
   feature is still wanted).
6. Finish the duplicate-ID check on a playlist that really has repeats.
7. Decide whether Watch Later is worth a spike at all, given option B's risk for a public
   build.