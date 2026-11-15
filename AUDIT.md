# Web Extension Doctor — Youtube Multiselect

Audited November 13, 2026; approved follow-up fixes completed November 15, 2026. Status: reproducible regressions and all three open findings fixed; automated checks pass, subject to the verification limits below. No signed-in account or real playlist was edited during testing.

## Doctor results

| Area | Result | Evidence |
| --- | --- | --- |
| Chrome MV3 build | PASS | Production build completed |
| Firefox MV2 build | PASS | Production build completed; toolbar startup tested with MV2 API mocks |
| Types and patch hygiene | PASS | TypeScript and `git diff --check` |
| Unit/background tests | PASS | 10 tests, including every five-item selection combination in both move directions and a DOM-sink guard |
| Browser feature tests | PASS | Production bundles tested with Polymer and native wrappers |
| Settings | PASS | Every setting, default restoration, storage updates, navigation, theme, tour reset, 320/768/1440px widths |
| Live YouTube startup/reload | PASS | Public playlist: 100 selection boxes before and after refresh; no extension page errors |
| Permissions and executable resources | PASS | Only `storage`; injection restricted to YouTube/Music; no remote executable imports or `eval` found |
| Account restrictions / Trusted Types / modern indexes | PASS | Restrictions removed; DOM-only rendering; modern active-view index badges verified |

Firefox startup now selects `browserAction` for MV2. Mozilla documents `action` as an MV3 API. [Mozilla API documentation](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/action)

Firefox consent metadata now lives under `browser_specific_settings.gecko.data_collection_permissions`, as Mozilla requires. [Mozilla manifest documentation](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings)

## Errors corrected

| Feature | Error and correction |
| --- | --- |
| Shorts/Videos selection | Menu handling immediately cleared the selection it had just created. Type selection now retains its result. |
| Single-item lists | Row lookup could climb to `<html>` when only one modern item remained. Lookup now stays within the item renderer. |
| Group / flip | The async completion reread checkboxes after the menu had cleared them, detaching selected rows without reinserting them. Completion now uses captured rows and a stable insertion marker. |
| Flip entire list | Group/flip were hidden when every item was selected. Both now support the complete selection. |
| Failed removal | Rows disappeared before the server accepted deletion. They now disappear only after success. |
| Native selection fallback | The constructor appended children illegally and selection state was stored on the wrapper instead of its checkbox. Initialization, mouse/keyboard selection, and context focus now use the checkbox correctly. |
| Copy setting | Copy ignored `preserveSelection`. Menu and keyboard copying now honor it. |
| HTML export | Modern cards produced missing IDs/titles; titles were inserted without escaping. Export now reads normalized data and escapes markup. |
| Downloads | Object URLs were revoked immediately because revocation was passed as the timeout delay. Cleanup is now delayed. |
| Import validation | Empty, malformed, short, and unsupported IDs could reach playlist requests; blank text lines and missing MIME types were mishandled. Parsing now validates complete IDs and supports extension-based format detection. |
| Export dialog | The Save fallback was German, and arrow-key interception prevented normal radio selection. Labels, keyboard navigation, and teardown were corrected. |
| Filters | Saved text was not restored, simple-text fields were missed, and missing watched progress was not treated as zero. Filter reentry and matching now work. |
| Filter reopening | The action checked a nonexistent `instance` property. It now checks the real open state. |
| History removal | Missing menu data could throw, and the old resolver path could do nothing. Available feedback endpoints are sent directly; missing data now fails safely. |
| Music | Duplicate detection read the wrong ID field, and title/artist filters missed Music flex-column data. Both now use the appropriate fields. |
| Saved Shorts | Token lookup required `videoId` and missed modern `contentId` entries. Both are recognized. |
| Duplicate playlist entries | Modern rows could resolve to the first copy's playlist item ID. Lookup now accounts for the visible occurrence and prefers row-specific data. |
| Watch Later failures | A failed fallback could still display success. Success now requires an accepted fallback result. |
| Partial Liked Videos moves | A partially completed re-like operation could display the entire selection as successfully moved. Partial completion now refreshes rather than reporting a full move. |
| Playlist saving | Missing/failed dialog responses could leave the operation active without user feedback. Failure state is now cleared and reported. |
| HTTP responses | Invalid JSON could be converted into a successful empty response. Parsing errors now propagate to the existing failure handlers. |
| Async navigation | Completed edits could update or refresh another playlist after navigation. DOM completion checks now verify the captured playlist. |
| Playlist loading | First-tab lookup and modern-only row counting broke other layouts; cancellation was slow to stop. The active contents and selectable rows are now used, with cancellation checks inside the wait loop. |
| Name sorting | Repeated sorting overwrote the original order, so disabling the setting could not restore it. Original orders are retained per array. |
| Hidden lists | Selection could include rows in inactive hidden page sections. Selectable/selected queries now exclude them. |
| Small windows | The bar could extend outside a narrow viewport. Width limits, wrapping, and left positioning now fit 320px windows. |
| Storage / messaging | Other storage areas could affect local preferences, malformed page values were accepted, and arbitrary URL requests were forwarded. Storage-area filtering, value validation, sender checks, and a supported-URL allowlist were added. |
| Theme updates | Theme was only captured at startup. Later YouTube theme changes now update stored theme state. |
| Lifecycle | Pending observers, drag handlers, export dialogs, and reconnect cleanup could survive teardown. Cleanup paths were completed. |
| Update migration | Lexicographic comparisons treated `3.10` as older than `3.4`; older migrations skipped later cleanup. Numeric comparison and independent migration steps correct this. |
| Options navigation | A generated shortcut button duplicated the shortcuts section ID. The button now has its own ID. |
| Smoke test | The previous check contained an unconditional `|| true` and did not assert working controls or refresh. It now checks actual boxes and reloads in a temporary signed-out profile. |

The prior reload/Shorts work is also retained: active-tab playlist extraction, up/down/top/bottom moves, thumbnail-sized selection boxes, Cast-marker-independent injection, and reload-safe initialization. DOM-only rendering now makes a Trusted Types policy unnecessary.

## Feature coverage

| Feature family | Verification |
| --- | --- |
| Individual / all / clear / Shorts / Videos / shift ranges | Browser fixtures, both wrapper paths |
| Keyboard navigation and copy/select shortcuts | Browser fixtures, including reinjection |
| Context menu and move-after | Browser fixture and request predecessor assertion |
| Up/down/top/bottom/group/flip | Browser fixtures; step moves also exhaustively checked for five-item selections |
| Duplicates, including backwards | Browser fixtures; Music ID variant included |
| Title/channel/watched filters and invalid regex | Browser fixtures; Music artist variant included |
| Copy/paste and preserve-selection setting | Browser fixtures and request assertions |
| Cut | Shared clipboard/removal path inspected; destructive branches separately tested with mocked responses |
| Watch Later / likes / queue | Mocked requests or native commands, including Watch Later failures |
| Save to playlist / create-playlist payload | Mocked dialog response; every selected ID verified |
| JSON/TEXT/HTML export/import | Parser/serializer tests plus actual browser HTML download and valid/invalid file imports |
| Playlist / History / Saved Shorts removal | Mocked success paths, cancellation/failure checks, removal of the final item |
| Liked Videos ordering | Mocked unlike/re-like requests |
| Full-list loading | Active-tab extraction, start/cancel tested; live full pagination remains unverified |
| Name sorting | Repeated sorting and restoration tested with dialog fixtures |
| Bar placement / dragging / onboarding | All three placements at 320px, persisted drag coordinates, all seven tour steps |
| Every options toggle / radio group | Defaults, changes, restoration, external local-storage updates |
| Toolbar / commands / updates | Chrome and Firefox background API mocks |
| Modern indexes | Hover/focus/selection visibility, active-view numbering, duplicate Shorts, hidden rows, loading, reorders, renderer reuse, cleanup, and reinjection |
| Trusted Types | Enforced CSP forbidding policies, an existing site default policy (never invoked), and absence of the API |
| Retired account restrictions | Successful storage migration, unrelated preference preservation, and initialization despite cleanup failure |
| Playlist guide shortcut | Code inspection; verification limits below |

## Follow-up findings resolved November 15

1. **Account restrictions removed.** The blacklist, account-identity lookup, and blocking checks were removed. The page bridge no longer accepts or forwards retired `blacklisted`/`handle` fields. Startup deletes both saved keys; cleanup failure does not block initialization or revive restrictions.

2. **Global Trusted Types policy removed.** Menus, dialogs, wrappers, filters, onboarding, and SVGs now use native DOM construction and text nodes. The page runtime has no HTML-parsing insertion sinks and creates no trust policy. Existing page policies are neither changed nor invoked. Legacy template teardown also removes the exact inserted nodes, avoiding stale wrappers after reinjection.

3. **Modern video and Shorts indexes added.** The existing setting controls thumbnail badges on hover, keyboard focus, and during selection mode. One-based numbers follow loaded items in the active playlist view and update after loading, reordering, removal, navigation, and renderer reuse. Duplicate videos retain separate positions; nested Shorts do not receive duplicate badges. Checkboxes receive a localized position description. Disabling or teardown removes extension badges and restores accessibility references and temporary positioning. Native legacy indexes and non-playlist/Music surfaces retain their existing behavior.

## Verification limits

- Real signed-in server changes were not performed. Mocked payload checks cannot prove that every current YouTube account, experiment, permission, or API variant accepts the operation.
- History fixtures cover renderers exposing menu feedback tokens. A modern renderer without accessible menu data fails safely and needs signed-in inspection.
- Firefox was built and its background API path was tested with mocks; a native Firefox browser session was not run.
- Live full pagination and the native playlist-guide expand/collapse methods were not exercised.
- Non-English catalogs use the extension's English fallback for newly added messages; translation quality was not reviewed.
- Copy/cut/paste use a clipboard held within the current tab's page runtime. Full refresh clears that clipboard.

## Reproduce

```sh
pnpm build
pnpm build:firefox
pnpm typecheck
pnpm test
pnpm exec playwright install chromium
pnpm test:browser
node smoke.mjs
```

The browser suites use local response fixtures. Only `smoke.mjs` contacts a real public YouTube page, in a temporary signed-out profile.
