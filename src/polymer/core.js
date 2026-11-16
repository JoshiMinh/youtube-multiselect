import { FROM_PAGE, PAGE_PREFIX, TO_PAGE } from './contracts.js';
import { playlistContents, playlistSetVideoId, playlistTab, stepMove } from './playlist.js';
import { parseSelectionFile, selectionHtml } from './selection-files.js';
import { element as el, svg, dragHandle } from './dom.js';
import { iconSet } from './icons.js';
import { createPlaylistIndexes } from './indexes.js';
import { createFilter } from './filter.js';
import filterStyles from './filter.css?inline';
import { anchorToolbarMenu } from './menu-position.js';
import { sortedVideos } from './sort-videos.js';

export default function runPolymer() {
"use strict";
!(function (t, e) {
  if (!("customElements" in t)) return;
  const n = "https://www.youtube.com",
    isMusic = location.hostname === "music.youtube.com",
    o = "ACTION_ADD_VIDEO",
    i = "ACTION_REMOVE_VIDEO_BY_VIDEO_ID",
    r = -1 !== navigator.userAgent.indexOf("Firefox"),
    a = -1 !== navigator.userAgent.indexOf("Edg/"),
    c = Date.now().toString(36),
    s = PAGE_PREFIX,
    d = FROM_PAGE,
    l = TO_PAGE,
    f = s + "-penalty-icon-" + c,
    h = s + "-wrapper-" + c,
    m = s + "-dialog-" + c,
    b = isMusic ? "ytmusic-app" : '.ytd-page-manager[role="main"]',
    $ = s + "-popup-menu",
    y = $ + "-item",
    g = s + "-video-checkbox",
    x = `#${g}.${g}`,
    v = `${b} :not([is-hidden]):not([hidden]) > ${h} > ${x}`,
    w = `${v}[checked]`,
    _ = "rgba(0, 0, 0, 0.5)",
    k = "12px",
    T = s + "-progress-bar",
    I = T + "-close",
    A = ["application/json", "text/plain", "text/html"],
    z = {
      counts: { copy: 0, cut: 0, move: 0, paste: 0 },
      preserveSelection: !1,
      sortPlaylistNames: !1,
      noRemovalConfirmation: !1,
      outlineIcon: !1,
      callout: 0,
      showVideoIndex: !1,
      findDuplicatesBackwards: !1,
      positioning: "center",
      barPosition: { x: 0, y: t.innerHeight - 72 },
      filterPosition: { x: 0, y: 1 },
      filter: {
        title: { value: "", option: !1 },
        channel: { value: "", option: !1 },
        watched: { value: "100", option: !1 },
      },
    };
  let L,
    M,
    C,
    O = !1;
  const pendingObservers = new Set();
  const indexes = createPlaylistIndexes({
    prefix: s, runtimeId: c,
    canShow: () => R() && !isMusic && z.showVideoIndex,
    isModern: (row) => row.matches(LK),
    label: (position) => (L?.messages.playlistPosition || 'Playlist position {index}').replace('{index}', String(position)),
  });
  const V = (function () {
      let t;
      return {
        get t() {
          return t;
        },
        set t(e) {
          t = e;
        },
        get o() {
          return Array.isArray(t) && t.length > 0;
        },
        get i() {
          return Array.isArray(t) ? t.length : 0;
        },
      };
    })(),
    D = () => "/feed/history" === t.location.pathname,
    R = () => "/playlist" === t.location.pathname,
    visible = (checkbox) => {
      const row = checkbox.parentElement?.parentElement;
      return row && !row.closest('[hidden], [is-hidden]') && row.getClientRects().length > 0;
    },
    P = () => [...e.querySelectorAll(v)].filter(visible),
    S = () => [...e.querySelectorAll(w)].filter(visible),
    N = () => S()[0],
    Y = () => !!N(),
    H = (t, e) =>
      t.playlistId ? (t[e] = t.videos?.[0]?.childVideoRenderer?.[e]) : t[e],
    setVideoIdFromData = (data) =>
      data?.playlistItemData?.playlistSetVideoId ||
      data?.setVideoId ||
      data?.playlistSetVideoId ||
      JSON.stringify(data)?.match(/"(?:setVideoId|playlistSetVideoId)":"([^"]+)"/)?.[1],
    // A Short is rendered as -v2 wrapping the plain element; only the outer one gets a checkbox.
    LKN = [
      "yt-lockup-view-model",
      "ytm-shorts-lockup-view-model-v2",
      "ytm-shorts-lockup-view-model:not(ytm-shorts-lockup-view-model-v2 > ytm-shorts-lockup-view-model)",
    ],
    LK = LKN.join(", "),
    lkId = (r) => {
      const u = r.querySelector('a[href*="/watch?v="], a[href^="/shorts/"]')?.getAttribute("href");
      return (u?.match(/[?&]v=([\w-]{11})/) || u?.match(/^\/shorts\/([\w-]{11})/))?.[1];
    },
    lkData = (r) => {
      const runs = (s) => ({ runs: [{ text: r.querySelector(s)?.textContent?.trim() ?? "" }] }),
        pct = parseFloat(r.querySelector('[class*="WatchedProgressBarSegment"]')?.style.width),
        raw = r.data ?? r.__data?.data ?? {};
      return {
        ...raw,
        videoId: lkId(r),
        get setVideoId() {
          return playlistSetVideoId(r.data ?? r.__data?.data, lkId(r)) || svid(lkId(r), r);
        },
        isPlayable: true,
        title: r.querySelector('h3') ? runs("h3") : raw.title,
        shortBylineText: r.querySelector('yt-content-metadata-view-model') ? runs("yt-content-metadata-view-model a, yt-content-metadata-view-model span") : raw.shortBylineText,
        thumbnailOverlays: isNaN(pct)
          ? raw.thumbnailOverlays ?? []
          : [{ thumbnailOverlayResumePlaybackRenderer: { percentDurationWatched: pct } }],
      };
    },
    musicData = (row) => {
      const data = row.data ?? {};
      const column = (index) => data.flexColumns?.[index]?.musicResponsiveListItemFlexColumnRenderer?.text;
      return { ...data, title: data.title ?? column(0), shortBylineText: data.shortBylineText ?? column(1) };
    },
    lk = (r, getData = lkData) =>
      new Proxy(r, {
        get: (o, k) => {
          if ("data" === k) return getData(o);
          const v = Reflect.get(o, k);
          return "function" == typeof v ? v.bind(o) : v;
        },
      }),
    j = (t) => {
      const r =
        t?.parentElement?.parentElement ||
        t?.__dataHost?.__dataHost ||
        t?.getRootNode?.()?.host?.parentElement;
      return r?.matches?.(LK) ? lk(r) : isMusic && r?.matches?.('ytmusic-responsive-list-item-renderer') ? lk(r, musicData) : r;
    },
    F = (t) => {
      const data = j(t).data;
      return isMusic ? data?.playlistItemData?.videoId : H(data, "videoId");
    },
    U = (t) => {
      const data = j(t).data,
        videoId = isMusic ? data?.playlistItemData?.videoId : H(data, "videoId"),
        setVideoId = setVideoIdFromData(data);
      return setVideoId || svid(videoId, t?.parentElement?.parentElement);
    },
    B = (t) => isMusic || j(t).data.isPlayable,
    G = ([...t] = S()) => (R() ? t.filter(B).map(F) : t.map(F)),
    q = () =>
      isMusic
        ? e.querySelector("ytmusic-playlist-shelf-renderer")?.data
        : e.querySelector(b + '[page-subtype="playlist"]')?.__data?.data,
    Q = () =>
      q()?.header?.playlistHeaderRenderer ??
      (isMusic
        ? q()
        : e.querySelector(b + '[page-subtype="playlist"] ytd-playlist-video-list-renderer')?.data),
    // Playlist pages now list lockupViewModel items instead of playlistVideoListRenderer.
    PL = () =>
      isMusic
        ? q()?.contents
        : playlistContents(q()),
    svid = (id, row) => {
      const matches = id && PL()?.filter?.((x) => {
        const json = JSON.stringify(x);
        return json.includes(`"contentId":"${id}"`) || json.includes(`"videoId":"${id}"`);
      });
      const occurrence = row ? [...e.querySelectorAll(LK)]
        .filter((candidate) => candidate.getClientRects().length && lkId(candidate) === id).indexOf(row) : 0;
      const item = matches?.[Math.max(0, occurrence)];
      return playlistSetVideoId(item, id) || setVideoIdFromData(item);
    },
    J = () => Q()?.playlistId ?? new URLSearchParams(t.location.search).get("list"),
    X = () =>
      (isMusic && Boolean(J())) ||
      Q()?.isEditable ||
      D() ||
      (R() &&
        ("WL" === J() ||
          PL()?.some?.((item) => /"(?:setVideoId|playlistSetVideoId)"/.test(JSON.stringify(item))))),
    W = () => "LL" === J(),
    // Saved Shorts: no setVideoIds and not marked editable, but items can be removed by video id.
    SS = () => "YS" === J(),
    Z = Y,
    K = () => V.o && !D() && X(),
    tt = (t) => t.shiftKey && !t.ctrlKey && !t.altKey,
    et = (t, e) =>
      el('yt-icon-button', { id: t }, el('yt-icon', { icon: e })),
    nt = (t, e) =>
      el('tp-yt-paper-tooltip', { for: t, position: 'top' }, e),
    it = (t) => (t.preventDefault(), t.stopPropagation()),
    rt = (e, n = d, o = t) => o.dispatchEvent(new CustomEvent(n, e)),
    at = (t, e) => rt({ detail: JSON.stringify({ type: t, value: e }) }),
    ct = () => at("counts", z.counts);
  function st(t, n) {
    e.querySelectorAll(t).forEach((t) => (t.checked = n));
  }
  function dt() {
    P().forEach((checkbox) => (checkbox.checked = !0)), kt.l();
  }
  function lt() {
    st(x, !1), kt.l();
  }
  function pt(t) {
    if (t && t.getAttribute("position") !== z.positioning)
      return (
        z.positioning,
        t.setAttribute("position", z.positioning),
        "custom" === z.positioning
      );
  }
  function ut(t, e) {
    for (const n of e) {
      if (!t.hasOwnProperty(n)) return;
      t = t[n];
    }
    return t;
  }
  function ft(t, e) {
    if (Array.isArray(t))
      for (let n = 0; n < t.length; n++) {
        const o = ut(t[n], e);
        if (o) return o;
      }
  }
  function ht(t, n) {
    return new Promise((o) => {
      let i = e.querySelector(t);
      if (i) o(i);
      else {
        const r = (n && e.querySelector(n)) || e.documentElement;
        let a = new MutationObserver(() => {
          (i = r.querySelector(t)), i && (a.disconnect(), pendingObservers.delete(a), (a = null), o(i));
        });
        pendingObservers.add(a);
        a.observe(r, { childList: !0, subtree: !0 });
      }
    });
  }
  location;
  const bt = (function () {
      const n = e.querySelector("ytd-app, ytmusic-app");
      function i(t, e, n, o = "setVideoId") {
        const i = {
            webCommandMetadata: {
              sendPost: !0,
              apiUrl: "/youtubei/v1/browse/edit_playlist",
            },
          },
          r = { playlistId: e, actions: n.map((e) => ({ [o]: e, action: t })) };
        return (
          "setVideoId" === o && (r.params = "CAFAAQ%3D%3D"),
          { commandMetadata: i, playlistEditEndpoint: r }
        );
      }
      return {
        p(t, e = n, refresh = !0) {
          const edit = t?.playlistEditEndpoint;
          if (!edit) {
            if (typeof e?.resolveCommand === "function") return e.resolveCommand(t);
            console.warn("[multi-select] YouTube Music command is not supported by this page");
            return Promise.resolve(!1);
          }
          if (!edit.actions?.length) return;
          // resolveCommand no longer performs playlist edits, so send them directly.
          const { clientActions, ...request } = edit;
          const done = () => (
              clientActions &&
                typeof n?.resolveCommand === "function" &&
                n.resolveCommand({
                  signalServiceEndpoint: { signal: "CLIENT_SIGNAL", actions: clientActions },
                }),
              (() => {
                // Navigating re-renders the playlist and discards the user's state; callers that
                // update the DOM themselves (moves, removals) pass refresh = false.
                if (!refresh) return;
                try {
                  this.$();
                } catch (err) {
                  console.warn("[multi-select] Playlist refresh failed:", err);
                }
              })(),
              !0
            ),
            fail = (err) => {
              console.warn("[multi-select] Playlist edit failed:", err, JSON.stringify(request));
              Kt("👎   " + (err?.message || L.messages.invalidData));
              return !1;
            };
          return serviceRequest({ playlistEditEndpoint: request }).then(done, (err) => {
            const { clientActions: _, ...alt } = t.fallback?.playlistEditEndpoint ?? {};
            if (!alt.actions) return fail(err);
            console.warn("[multi-select] Retrying removal by video id:", err);
            return serviceRequest({ playlistEditEndpoint: alt }).then(done, fail);
          });
        },
        h: (t) => serviceRequest(t),
        m(t, e = null, o = !0, i = n) {
          if (!e || void 0 !== e[0]) {
            const n = {
              bubbles: !0,
              composed: !0,
              detail: {
                actionName: t,
                optionalAction: o,
                args: e,
                disableBroadcast: !1,
                returnValue: [],
              },
            };
            rt(n, "yt-action", i);
          }
        },
        $() {
          const t = J(),
            e = "/playlist?list=" + t,
            o = {
              endpoint: {
                commandMetadata: {
                  webCommandMetadata: {
                    url: e,
                    rootVe: 5754,
                    webPageType: "WEB_PAGE_TYPE_PLAYLIST",
                    apiUrl: "/youtubei/v1/browse",
                  },
                },
                browseEndpoint: { browseId: "VL" + t },
              },
              pageType: "playlist",
              url: e,
              reload: !1,
            };
          return typeof n?.onYtNavigate === "function" ? n.onYtNavigate({ detail: o }) : void 0;
        },
        get v() {
          return n;
        },
        get _() {
          return n?.mastheadHeight || 56;
        },
        get k() {
          return t.ytcfg?.get("LOGGED_IN");
        },
        T: {
          get I() {
            return e.querySelector("ytd-miniplayer")?.active;
          },
          get A() {
            return J();
          },
          get L() {
            return G();
          },
          get M() {
            return (([...t] = S()) => t.map(U))();
          },
          get C() {
            const t = [],
              e = this.L;
            if (e.length) {
              z.counts.copy += e.length;
              const n = {
                videoIds: e,
                listType: "PLAYLIST_EDIT_LIST_TYPE_QUEUE",
              };
              this.I ||
                ((n.openMiniplayer = !0),
                (n.onCreateListCommand = {
                  createPlaylistServiceEndpoint: { params: "CAQ%3D" },
                })),
                t.push({ addToPlaylistCommand: n });
            }
            return {
              signalServiceEndpoint: { signal: "CLIENT_SIGNAL", actions: t },
            };
          },
          O(t) {
            const e = this.M;
            if ((z.counts.cut += e.length), t && (V.t = this.L), e.some((t) => !t))
              return i("ACTION_REMOVE_VIDEO_BY_VIDEO_ID", this.A, this.L, "removedVideoId");
            const n = i("ACTION_REMOVE_VIDEO", this.A, e);
            n.fallback = i("ACTION_REMOVE_VIDEO_BY_VIDEO_ID", this.A, this.L, "removedVideoId");
            return (
              (n.playlistEditEndpoint.clientActions = [
                { playlistRemoveVideosAction: { setVideoIds: [...e] } },
              ]),
              n
            );
          },
          get V() {
            const t = this.L;
            return (z.counts.copy += t.length), i(o, "WL", t, "addedVideoId");
          },
          get D() {
            const t = $t.R,
              e = this.M.reverse(),
              n = e.indexOf(t);
            -1 !== n && e.splice(n, 1), (z.counts.move += e.length);
            const o = i("ACTION_MOVE_VIDEO_AFTER", this.A, e);
            return (
              o.playlistEditEndpoint.actions.forEach(
                (e) => (e.movedSetVideoIdPredecessor = t)
              ),
              o
            );
          },
          get P() {
            const t = this.M.reverse();
            return (
              (z.counts.move += t.length),
              i("ACTION_MOVE_VIDEO_AFTER", this.A, t)
            );
          },
          get S() {
            const t = this.M;
            return (
              (z.counts.move += t.length),
              i("ACTION_MOVE_VIDEO_BEFORE", this.A, t)
            );
          },
          N(t) {
            return i(o, this.A, t, "addedVideoId");
          },
        },
      };
    })(),
    $t = (function () {
      let t, n;
      const o = () => {
        (t = n = void 0), e.activeElement.blur();
      };
      return {
        H(e) {
          t = n = e;
        },
        j: (o) => ((n = t), o?.focus(), (t = e.activeElement), t),
        F: () => setTimeout(o),
        U: () => (t.blur(), t.focus()),
        get B() {
          return t;
        },
        get G() {
          return n;
        },
        get q() {
          return j(t)?.data?.videoId;
        },
        get R() {
          return t && U(t);
        },
        get J() {
          return t?.id === g;
        },
        get X() {
          return [
            ...e.querySelectorAll(
              'input:not([type="hidden"]):not([type="checkbox"]), textarea'
            ),
          ].some((t) => t.contains(e.activeElement));
        },
      };
    })(),
    yt = (function () {
      let t, n;
      function o(t, loaded, total) {
        let o = e.querySelector("#" + T);
        if (!o) {
          (o = e.createElement("div")), (o.id = T);
          o.append(
            el('header', {}, el('span', { id: 'title' }, L.messages.loadingEntirePlaylist), et(I, 'close'), nt(I, L.messages.close)),
            el('p', { id: 'status' }),
            el('div', { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100 })
          ),
            o.querySelector("#" + I).addEventListener("click", () => (n = !0)),
            e.body.appendChild(o);
        }
        const i = Math.min(100, Math.round(100 * t)) + "%";
        return (
          (o.querySelector('[role="progressbar"]').style.width = i),
          (o.querySelector('[role="progressbar"]').textContent = i),
          (o.querySelector('[role="progressbar"]').setAttribute("aria-valuenow", String(Math.round(100 * t)))),
          (o.querySelector("#status").textContent = loaded == null ? "" : `${loaded} / ${total}`),
          (o.style.display = ""),
          o
        );
      }
      const i = (t) => ({ contents: isMusic ? t?.contents : playlistContents(t) }),
        r = (t) =>
          t?.[t.length - 1]?.continuationItemRenderer?.continuationEndpoint ??
          t?.[t.length - 1]?.continuationItemViewModel?.continuationCommand?.innertubeCommand;
      async function a() {
        t = !0;
        n = !1;
        const e = q(),
          a = ((t) => {
            const e = t?.header?.playlistHeaderRenderer?.numVideosText?.runs;
            if (Array.isArray(e))
              for (const t of e) {
                const e = +t.text?.replace(/[. , ]/g, "");
                if (!isNaN(e)) return e;
              }
            const n = JSON.stringify(t?.header ?? "").match(/"(\d[\d.,]*) videos?"/i)?.[1];
            return n ? +n.replace(/[.,]/g, "") : 5e3;
          })(e),
          c = i(e);
        let s = c?.contents,
          d = r(s),
          l = (s?.length || 0) - (d ? 1 : 0);
        const p = d && o(l / a),
          u = location.href;
        // Scrolling to the end lets YouTube fetch and render the next page itself.
        for (; !O && !n && d && location.href === u; ) {
          const count = () => P().length,
            before = count(),
            beforeToken = d && JSON.stringify(d);
          window.scrollTo(0, document.documentElement.scrollHeight);
          for (let tries = 0; tries < 40; tries++) {
            await new Promise((resolve) => setTimeout(resolve, 250));
            if (O || n || location.href !== u) break;
            const next = r(i(q())?.contents),
              changed = count() > before || (next && JSON.stringify(next) !== beforeToken);
            if (changed) break;
          }
          const after = count();
          if (after === before && (!d || JSON.stringify(r(i(q())?.contents)) === beforeToken)) break;
          (s = i(q())?.contents), (d = r(s)), (l = (s?.length || 0) - (d ? 1 : 0)), o(d ? l / a : 1, l, a);
        }
        !(function (e) {
          e
            ? n
              ? ((e.style.display = "none"), (t = n = !1))
              : e.style.animation ||
                (e.addEventListener(
                  "animationend",
                  function o() {
                    e.removeEventListener("animationend", o, !0),
                      (e.style.animation = ""),
                      (e.style.display = "none"),
                      (t = n = !1);
                  },
                  !0
                ),
                (e.style.animation = `180ms ${T + "-fade-out"} forwards`))
            : (t = n = !1);
        })(p);
      }
      return {
        W() {
          if (!t) a();
        },
        get Z() {
          return !r(i(q())?.contents);
        },
        get K() {
          return t;
        },
      };
    })(),
    gt = (function () {
      const n = `${s}-action-menu`;
      let o, i, r, a, c, d, l, p, anchoring, available;
      const u = [
        {
          id: s + "-action-move-after",
          handler: Lt,
          icon: "arrow_back",
          label: () => L.messages.moveAfter,
          enabled: () => p && a && c && !r && $t.R,
          separator: () => "bottom",
        },
        {
          id: s + "-action-add-to-queue",
          handler: At,
          icon: "add_to_queue_tail",
          label: () => L.messages.addToQueue,
          enabled: () => a,
        },
        {
          id: s + "-action-add-to-watch-later",
          handler: zt,
          icon: "watch_later",
          label: () => L.messages.addToWatchLater,
          enabled: () => a && !l && bt.k,
        },
        {
          id: s + "-action-like-videos",
          handler: likeVideos,
          icon: "thumb_up",
          label: () => L.messages.likeVideos || "Like selected videos",
          enabled: () => a && bt.k,
        },
        {
          id: s + "-action-add-to-playlist",
          handler: Ot,
          icon: "playlist_add",
          label: () => L.messages.addToPlaylist,
          enabled: () => a && bt.k,
        },
        {
          id: s + "-action-remove-videos",
          handler: St,
          icon: "delete",
          label: () => L.messages.removeVideos,
          enabled: () => a && (c || W() || SS()),
        },
        {
          id: s + "-action-move-up",
          handler: () => moveStep("up"),
          icon: `${s}:${s}-move-up`,
          label: () => L.messages.moveUp,
          enabled: () => a && c && !d && !r,
        },
        {
          id: s + "-action-move-down",
          handler: () => moveStep("down"),
          icon: `${s}:${s}-move-down`,
          label: () => L.messages.moveDown,
          enabled: () => a && c && !d && !r,
        },
        {
          id: s + "-action-move-to-top",
          handler: Mt,
          icon: `${s}:${s}-move-top`,
          label: () => L.messages.moveToTop,
          enabled: () => a && (c || W()) && !d && !r,
        },
        {
          id: s + "-action-move-to-bottom",
          handler: Ct,
          icon: `${s}:${s}-move-bottom`,
          label: () => L.messages.moveToBottom,
          enabled: () => a && c && !d && !r,
        },
        {
          id: s + "-action-group-by-channel",
          handler: groupByChannel,
          icon: "view_module",
          label: () => L.messages.groupByChannel,
          enabled: () => a && c && !d,
        },
        {
          id: s + "-action-flip-list",
          handler: flipSelected,
          icon: `${s}:${s}-flip-list`,
          label: () => L.messages.flipList,
          enabled: () => a && c && !d,
        },
        {
          id: s + "-action-select-duplicates",
          handler: Yt,
          icon: "icons:find-in-page",
          label: () => L.messages.selectDuplicates,
          enabled: () => c,
        },
        {
          id: s + "-action-select-filter",
          handler: () => Zt.tt(),
          icon: "icons:filter-list",
          label: () => L.messages.selectWithFilter,
          enabled: () => !Zt.lt,
        },
        {
          id: s + "-action-sort-duration-asc",
          handler: () => sortSelected("duration", "asc"),
          icon: `${s}:${s}-move-up`,
          label: () => L.messages.sortDurationAsc,
          enabled: () => a && c && !d,
        },
        {
          id: s + "-action-sort-duration-desc",
          handler: () => sortSelected("duration", "desc"),
          icon: `${s}:${s}-move-down`,
          label: () => L.messages.sortDurationDesc,
          enabled: () => a && c && !d,
        },
        {
          id: s + "-action-sort-date-asc",
          handler: () => sortSelected("date", "asc"),
          icon: `${s}:${s}-move-up`,
          label: () => L.messages.sortDateAsc,
          enabled: () => a && c && !d,
        },
        {
          id: s + "-action-sort-date-desc",
          handler: () => sortSelected("date", "desc"),
          icon: `${s}:${s}-move-down`,
          label: () => L.messages.sortDateDesc,
          enabled: () => a && c && !d,
        },
        {
          id: s + "-action-load-entire-playlist",
          handler: () => yt.W(),
          icon: "icons:archive",
          label: () => L.messages.loadEntirePlaylist,
          enabled: () => R() && !yt.Z && !yt.K,
        },
        {
          id: s + "-download-selection",
          handler: jt,
          icon: `${s}:${s}-file-download`,
          label: () => L.messages.downloadSelection,
          enabled: () => a,
        },
        {
          id: s + "-add-videos-from-file",
          handler: Ft,
          icon: `${s}:${s}-file-upload`,
          label: () => L.messages.addVideosFromFile,
          enabled: () => c && !d,
        },
        {
          id: s + "-action-copy",
          handler: Dt,
          icon: "icons:content-copy",
          label: () => L.messages.copy,
          enabled: () => a,
          separator: () => "top",
        },
        {
          id: s + "-action-cut",
          handler: Pt,
          icon: "icons:content-cut",
          label: () => L.messages.cut,
          enabled: () => a && (c || W() || SS()),
        },
        {
          id: s + "-action-paste",
          handler: Rt,
          icon: "icons:content-paste",
          label: () => `${L.messages.paste} (${V.i})`,
          enabled: () => V.o && c && !d,
          separator: () => (a ? "" : "top"),
        },
      ];
      function renderMenu() {
        const list = o.firstElementChild;
        const actionNode = (action, paired = false) => {
          return el(paired ? 'button' : 'div', {
            id: action.id, tabindex: 0, role: 'menuitem', type: paired ? 'button' : null,
            title: action.label(), 'aria-label': action.label(),
          }, el('yt-icon', { icon: action.icon }), paired ? null : el('span', { class: `${s}-menu-label` }, action.label()));
        };
        const groups = [
          { ids: ['msfy-action-move-up', 'msfy-action-move-down'], label: L.messages.menuMoveStep, icon: 'move-step' },
          { ids: ['msfy-action-move-to-top', 'msfy-action-move-to-bottom'], label: L.messages.menuMoveEnds, icon: 'move-ends' },
          { ids: ['msfy-action-sort-duration-asc', 'msfy-action-sort-duration-desc'], label: L.messages.menuDuration, icon: 'clock' },
          { ids: ['msfy-action-sort-date-asc', 'msfy-action-sort-date-desc'], label: L.messages.menuDate, icon: 'calendar' },
          { ids: ['msfy-add-videos-from-file', 'msfy-download-selection'], label: L.messages.menuFiles, icon: 'file-transfer' },
        ];
        const paired = new Set();
        const rows = [];
        for (const action of available) {
          if (paired.has(action.id)) continue;
          const group = groups.find(group => group.ids.includes(action.id));
          let content;
          if (group) {
            const buttons = group.ids.map(id => available.find(candidate => candidate.id === id)).filter(Boolean);
            buttons.forEach(candidate => paired.add(candidate.id));
            content = el('div', { class: 'msfy-menu-pair', role: 'group', 'aria-label': group.label },
              el('yt-icon', { icon: `${s}:${s}-${group.icon}` }),
              el('span', { class: `${s}-menu-label` }, group.label), ...buttons.map(candidate => actionNode(candidate, true)));
          } else content = actionNode(action);
          const row = el('div', { class: y, separator: action.separator?.() || null }, content);
          rows.push(row);
        }
        list.replaceChildren(...rows);
        i = [...list.querySelectorAll('[role="menuitem"]')];
      }
      function f(t) {
        t.stopPropagation();
        const id = t.target.closest?.('[role="menuitem"]')?.id;
        const action = u.find(action => action.id === id);
        if (action) { gt.et(); if (action.handler()) lt(); }
      }
      const h = (() => {
        const t = (t = i.at(0)) => (i.at(i.indexOf(t) - 1) || i.at(-1)).focus(),
          e = (t = i.at(-1)) => (i.at(i.indexOf(t) + 1) || i.at(0)).focus(),
          n = {
            Escape: () => gt.et(),
            Home: () => i.at(0).focus(),
            End: () => i.at(-1).focus(),
            Tab: (n, o) => (tt(o) ? t(n) : e(n)),
            ArrowUp: t,
            ArrowLeft: t,
            ArrowDown: e,
            ArrowRight: e,
            " ": (t, e) => f(e),
            Enter: (t, e) => f(e),
          };
        return { handler: (t) => n[t] };
      })();
      function m(t) {
        if (!$t.X) {
          const e = h.handler(t.key);
          if (e) {
            const n = i.find((e) => e === t.target);
            it(t), e(n, t);
          }
        }
      }
      function b() {
        gt.et();
      }
      return {
        position() { anchoring?.update(); },
        ot(h, x) {
          const v = !o || p;
          if ((this.et(), v)) {
            p = "number" == typeof h && "number" == typeof x;
            const v = kt.it,
              w = kt.rt;
            (r = v === w),
              (a = !!v),
              (c = X() && bt.k),
              (d = D()),
              (l = "WL" === J());
            const _ = u.filter((t) => t.enabled());
            _.length &&
              (!(function (r, a, c) {
                (o = e.createElement("div")),
                  (o.id = n),
                  o.append(el('div', { id: 'msfy-menu-list', class: $, tabindex: -1, role: 'menu' })),
                  (available = r), renderMenu(),
                  p
                    ? ((o.className = s + "-context-menu"),
                      o.style.setProperty("--x", a + t.scrollX + "px"),
                      o.style.setProperty("--y", c + t.scrollY + "px"),
                      o.style.setProperty("--scroll-y", t.scrollY + "px"),
                      e.body.appendChild(o))
                    : ((o.className = s + "-bar-menu"), kt.ct(o)),
                  (i = [...o.querySelectorAll('[role="menuitem"]')]);
                if (!p) anchoring = anchorToolbarMenu(o, kt.element);
              })(_, h, x),
              e.addEventListener("keydown", m, !0),
              o.addEventListener("click", f, !0),
              o.addEventListener("contextmenu", it, !0),
              setTimeout(() => o && t.addEventListener("click", b)));
          }
        },
        et() {
          anchoring?.destroy();
          anchoring = null;
          o &&
            (e.removeEventListener("keydown", m, !0),
            o.removeEventListener("click", f, !0),
            o.removeEventListener("contextmenu", it, !0),
            t.removeEventListener("click", b),
            o.remove(),
            (o = i = null));
        },
      };
    })(),
    xt = (function () {
      const t = s + "-confirm-remove-" + c,
        n = !0;
      let o, i, r;
      const a = (t) => {
          e.removeEventListener("keydown", r, n), o.close(t), i(t), (i = null);
        },
        d = () => {
          if (!o) {
            (o = e.createElement("dialog")),
              (o.id = t),
              (o.className = m),
              o.append(el('form', { method: 'dialog' }, el('header'),
                el('section', {}, L.messages.confirmRemoveContent),
                el('footer', {}, el('button', { type: 'button', id: 'cancel' }, L.messages.cancel), el('button', { type: 'button', id: 'submit' }, L.messages.remove))));
            const n = o.querySelector("button#cancel"),
              i = o.querySelector("button#submit");
            n.addEventListener("click", (t) => a(!1)),
              i.addEventListener("click", (t) => a(!0)),
              (r = (t) => {
                switch (t.key) {
                  case "Escape":
                    a(!1);
                    break;
                  case " ":
                  case "Enter":
                    a(t.target === i);
                    break;
                  case "Tab":
                  case "ArrowLeft":
                  case "ArrowRight":
                    t.target === n ? i.focus() : n.focus();
                }
                it(t);
              }),
              e.body.appendChild(o);
          }
        };
      return {
        ot() {
          if (!o?.open)
            return (
              !o && d(),
              (o.querySelector("header").textContent = L.messages.removeVideos),
              e.addEventListener("keydown", r, n),
              o.showModal(),
              new Promise((t) => (i = t))
            );
        },
        st() {
          o && (i && a(!1), e.removeEventListener("keydown", r, n), o.remove(), (o = null));
        },
        get dt() {
          return t;
        },
      };
    })(),
    vt = (function () {
      const t = s + "-toggle-bar-button-" + c;
      let n;
      const o = (o) => {
        if (o && !O) {
          (n = e.createElement("div")), (n.id = t);
          const i = svg('svg', { viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
              svg('path', { d: 'M3.5 5.5l1.5 1.5l2.5-2.5M3.5 11.5l1.5 1.5l2.5-2.5M3.5 17.5l1.5 1.5l2.5-2.5M11 6h9M11 12h9M11 18h9' })),
            r = L.messages.extensionName;
          n.append(el('yt-icon-button', { id: 'button' }, i), el('tp-yt-paper-tooltip', {}, r)),
            n.firstElementChild.addEventListener("click", (t) => Et(), !0),
            o.insertBefore(n, o.firstElementChild);
        }
      };
      return {
        tt() {
          !n &&
            ht(isMusic ? "ytmusic-nav-bar #right-content" : "#end.ytd-masthead").then(o);
        },
        st() {
          n && (n.remove(), (n = null));
        },
        get dt() {
          return t;
        },
      };
    })(),
    wt = (function () {
      const t = s + "-bezel-" + c;
      let n;
      function o(t) {
        n.style.display = "";
      }
      return {
        tt() {
          !n &&
            (e.getElementById(t) ||
              ((n = e.createElement("div")),
              (n.id = t),
              e.body.appendChild(n),
              n.addEventListener("animationend", o, !0)));
        },
        st() {
          n &&
            (n.removeEventListener("animationend", o, !0),
            n.remove(),
            (n = null));
        },
        U(t) {
          if (n) {
            const o = e.querySelector(`iron-iconset-svg #content-${t} path`);
            o &&
              (n.replaceChildren(el('div', { id: 'icon' }, svg('svg', { fill: '#fff', viewBox: '0 0 24 24', width: '80%', height: '80%' }, o.cloneNode(true)))),
              (n.style.display = "block"));
          }
        },
        get dt() {
          return t;
        },
      };
    })(),
    _t = (t) => (it(t), gt.et());
  const kt = (function () {
      const o = s + "-bar-" + c,
        i = `${s}:${s}`;
      let r, a, d, l;
      const f = (t, e) =>
          e ? t.setAttribute("disabled", "") : t.removeAttribute("disabled"),
        h = [
          {
            id: s + "-close",
            icon: "close",
            handler: (t) => Et(!1),
            tooltip: () => L.messages.close,
            html() {
              return [et(this.id, this.icon), nt(this.id, L.messages.close)];
            },
          },
          {
            id: "selection",
            update() {
              this.node.textContent = `${d} / ${a}`;
            },
            html() {
              return [el('span', { id: this.id }), el('span', { class: `${s}-selection-label` }, L.messages.selected)];
            },
          },
          {
            id: "select",
            icon: `${i}-select-all`,
            handler: (t) => (_t(t), dt()),
            tooltip: () => L.messages.selectAllVideos,
            update() {
              f(this.node, d === a);
            },
            html() {
              return (
                [et(this.id, this.icon), nt(this.id, L.messages.selectAllVideos)]
              );
            },
          },
          {
            id: "unselect",
            icon: `${i}-unselect-all`,
            handler: (t) => (_t(t), lt()),
            tooltip: () => L.messages.deselectAllVideos,
            update() {
              f(this.node, !d);
            },
            html() {
              return (
                [et(this.id, this.icon), nt(this.id, L.messages.deselectAllVideos)]
              );
            },
          },
          {
            id: "menu",
            icon: "more_vert",
            handler: (t) => (it(t), gt.ot()),
            update() {
              f(this.node, !(d || X() || !Zt.lt));
            },
            html() {
              return et(this.id, this.icon);
            },
          },
        ];
      function m() {
        (d = S().length), (a = P().length), h.forEach((t) => t.update?.());
      }
      function b() {
        gt.position();
      }
      function $() {
        l && (l(), (l = null)), pt(r) && (l = Wt(r, "barPosition", b));
      }
      return {
        tt() {
          r ||
            (!(function () {
              const t = h.flatMap((item) => item.html());
              (r = e.createElement("div")),
                (r.id = o),
                r.append(dragHandle(), el('div', { id: 'content', tabindex: 0 }, t)),
                e.body.appendChild(r),
                h.forEach((t) => (t.node = r.querySelector("#" + t.id))),
                m(),
                $();
            })(),
            r.addEventListener("contextmenu", it, !0),
            h.forEach(
              (t) => t.handler && t.node.addEventListener("click", t.handler, !0)
            ),
            b());
        },
        st() {
          r &&
            (l && (l(), (l = null)),
            r.removeEventListener("contextmenu", it, !0),
            h.forEach(
              (t) =>
                t.handler && t.node.removeEventListener("click", t.handler, !0)
            ),
            r.remove(),
            (r = null));
        },
        ct(t) {
          e.body.appendChild(t);
        },
        l() {
          r && m();
        },
        ut() {
          $();
        },
        nt() {
          b();
        },
        get dt() {
          return o;
        },
        get element() { return r; },
        get ft() {
          return r?.contains(e.activeElement);
        },
        get rt() {
          return a;
        },
        get it() {
          return d;
        },
        get ht() {
          return d === a;
        },
      };
    })(),
    Et = (function () {
      const n = (() => {
          let n, o;
          const i = (() => {
              let e;
              const i = (t, n) => {
                  const o = ((t, n) => {
                    const o = e.at(t).checked;
                    t > n && ([t, n] = [n, t]);
                    for (let i = t; i <= n; i++)
                      if (e.at(i).checked !== o) return o;
                    return !o;
                  })(t, n);
                  t > n && ([t, n] = [n, t]);
                  for (let i = t; i <= n; i++) e.at(i).checked = o;
                  kt.l();
                },
                g = (t, n) => {
                  const o = e.indexOf(t),
                    i = e.indexOf(n);
                  if (o < 0 || i < 0) return;
                  const a = Math.min(o, i),
                    c = Math.max(o, i);
                  for (let t = a; t <= c; t++) e.at(t).checked = !0;
                  kt.l();
                },
                a = (t, n) => {
                  let o;
                  for (; (o = e.at(t)); ) {
                    if (o.checked) return o;
                    t += n;
                  }
                },
                c = (t) => Math.abs(t) < 10,
                s = (t) => (n ? a(t - 1, -1) : e.at(t - 1)),
                d = (t) =>
                  n ? a(t + 1, 1) || a(0, 1) : e.at(t + 1) || e.at(0),
                l = (t) => {
                  const n = e.at(t).getBoundingClientRect();
                  for (let o = t - 1; o >= 0; o--) {
                    const t = e.at(o),
                      i = t.getBoundingClientRect();
                    if (
                      i.width &&
                      i.height &&
                      n.top >= i.bottom &&
                      (c(i.left - n.left) ||
                        c(i.right - n.right) ||
                        i.left < n.left)
                    )
                      return t;
                  }
                  return s(t);
                },
                p = (t) => {
                  const n = e.at(t).getBoundingClientRect();
                  for (let o = t + 1; o < e.length; o++) {
                    const t = e.at(o),
                      i = t.getBoundingClientRect();
                    if (
                      i.width &&
                      i.height &&
                      i.top >= n.bottom &&
                      (c(i.left - n.left) ||
                        c(i.right - n.right) ||
                        i.right > n.right)
                    )
                      return t;
                  }
                  return d(t);
                },
                u = () =>
                  e.find((e) => {
                    return (
                      (n = e.getBoundingClientRect()).top >= bt._ &&
                      n.bottom <= t.innerHeight
                    );
                    var n;
                  }),
                f = (t, n, i = o) => {
                  e = [...P()];
                  const r = e.indexOf(t);
                  if (-1 !== r) {
                    $t.j(n(r));
                    if (i) {
                      const n = $t.G;
                      o && n && e.includes(n) ? g(n, t) : (t.checked = !t.checked);
                      kt.l();
                    }
                  }
                  else {
                    const n = $t.B;
                    $t.j(
                      (n && n !== t && (a = n) && e.find((t) => t === a)) ||
                        u() ||
                        e.at(0)
                    );
                  }
                  var a, c;
                  e = null;
                },
                h = (t, n) => {
                  e = [...P()];
                  const a = e.at(n);
                  if (
                    a &&
                    ($t.j(a),
                    n
                      ? r && a.scrollIntoView({ block: "center" })
                      : a.scrollIntoView(!1),
                    o)) {
                    const n = e.indexOf(t);
                    -1 !== n && (o ? g(t, a) : i(n, e.indexOf(a)));
                  }
                  e = null;
                },
                m = {
                  Tab: (t) => f(t, o ? s : d, !1),
                  ArrowUp: (t) => f(t, l),
                  ArrowDown: (t) => f(t, p),
                  ArrowLeft: (t) => f(t, s),
                  ArrowRight: (t) => f(t, d),
                  Home: (t) => h(t, 0),
                  End: (t) => h(t, -1),
                };
              return { getHandler: (t) => m[t] };
            })(),
            a = (t) => {
              if ($t.X) return;
              const e = t.key;
              switch (
                ((n = ((t) => t.ctrlKey && !t.shiftKey && !t.altKey)(t)),
                (o = tt(t)),
                e)
              ) {
                case "a":
                  return void (n && (_t(t), kt.ht ? lt() : dt()));
                case "c":
                  return void (n && Z() && (_t(t), Dt() && lt()));
                case "v":
                  return void (n && K() && (_t(t), Rt()));
                case "x":
                  return void (n && Y() && (X() || W() || SS()) && (_t(t), St(!0)));
                case "Insert":
                  return void (n
                    ? Z() && (_t(t), Dt() && lt())
                    : o && K() && (_t(t), Rt()));
                case "Delete":
                  return void (
                    (X() || W() || SS()) &&
                    (!Y() && $t.J && (($t.B.checked = !0), $t.U(), kt.l()),
                    Y() && (_t(t), St(o)))
                  );
              }
              if (kt.ft || t.target.closest?.(`#${s}-action-menu`)) return;
              const r = i.getHandler(e);
              r && (it(t), r(t.target));
            };
          return (t) => {
            t
              ? e.addEventListener("keydown", a, true)
              : e.removeEventListener("keydown", a, true);
          };
        })(),
        o = [
          `#${kt.dt} { display: block; }`,
          `${h}, #index.ytd-playlist-video-renderer { display: flex; }`,
          `${h}:hover { background-color: var(--yt-spec-10-percent-layer); }`,
          `#${vt.dt} > #button { border-radius: 50%; background-color: var(--yt-spec-10-percent-layer); color: var(--yt-spec-call-to-action, #3ea6ff); }`,
          `#${vt.dt} > #button:hover { background-color: var(--${s}-spec-20-percent-layer); }`,
          `#${vt.dt} > #button > button:focus { border-radius: 50%; background-color: var(--${s}-spec-20-percent-layer); }`,
          "ytd-playlist-video-renderer { position: relative; }",
          "ytd-radio-renderer { pointer-events: none; }",
          ...LKN.flatMap((n) => [
            `${n} { position: relative; }`,
            `${n} > :not(${h}), ${n} > :not(${h}) * { pointer-events: none !important; }`,
          ]),
          "#content.ytd-playlist-video-renderer, #dismissible.ytd-video-renderer, #dismissible.ytd-rich-grid-media, #dismissible.ytd-grid-video-renderer, #dismissible.ytd-compact-video-renderer { pointer-events: none; }",
          "#menu.ytd-playlist-video-renderer, #menu.ytd-video-renderer, #menu.ytd-rich-grid-media, #menu.ytd-grid-video-renderer, #menu.ytd-compact-video-renderer, #menu.ytd-reel-shelf-renderer { pointer-events: none; opacity: 0; }",
          "#reorder.ytd-playlist-video-renderer, #mouseover-overlay.ytd-thumbnail, #hover-overlays.ytd-thumbnail { display: none; }",
          `#interaction.ytd-video-renderer > .yt-interaction, #interaction.ytd-grid-video-renderer > .yt-interaction, #interaction.ytd-compact-video-renderer > .yt-interaction { border-radius: ${k}; }`,
          "body { user-select: none; }",
        ];
      let i = !1;
      return (t = !i) => {
        "boolean" == typeof t &&
            t !== i &&
            ((i = t),
            indexes.setMode(t),
            o.forEach((e) => Bt.bt(t, e)),
            It.refresh(),
            n(t),
            t
              ? (e
                  .querySelector("ytd-popup-container > tp-yt-iron-dropdown")
                  ?.close?.(),
                $t.F(),
                kt.tt(),
                wt.tt(),
                Xt.$t())
              : (Zt.st(), kt.l()));
      };
    })(),
    Tt = (function () {
      const t = {},
        n = h,
        o = () => el(n),
        i = (t = n) => {
          if (customElements.get(t)) return;
          const n = {
            is: t,
            _template: () => {
              const t = e.createElement("template");
              return (
                t.content.append(el('tp-yt-paper-checkbox', { id: g, class: g, 'on-tap': 'onTap', 'on-contextmenu': 'onContextMenu' })),
                t
              );
            },
            attached() {
              !O && kt.l();
            },
            detached() {
              !O && kt.l();
            },
            onTap(t) {
              $t.j(),
                tt(t.detail.sourceEvent) &&
                  ((t = $t.B) => {
                    const e = $t.G,
                      n = [...P()];
                    let o = e ? n.indexOf(e) : 0,
                      i = n.indexOf(t);
                    -1 === o && (o = 0), o > i && ([o, i] = [i, o]);
                    for (let e = o; e <= i; e++) n[e].checked = t.checked;
                  })(t.target),
                kt.l();
            },
            onContextMenu(t) {
              $t.j(), _t(t), gt.ot(t.clientX, t.clientY);
            },
          };
          if ("function" == typeof Polymer) {
            Polymer(n);
            return;
          }
          customElements.define(
            t,
            class extends HTMLElement {
              constructor() {
                super();
                this.addEventListener("click", (t) => {
                  if (t.button !== 0) return;
                  this.toggle(t);
                });
                this.addEventListener("keydown", (t) => {
                  if (t.key === " " || t.key === "Enter") this.toggle(t);
                }, true);
                this.addEventListener("auxclick", (t) => {
                  if (t.button !== 1) return;
                  const link = this.closest(LK)?.querySelector(
                    'a[href*="/watch?v="], a[href^="/shorts/"]'
                  );
                  if (!link?.href) return;
                  t.preventDefault();
                  window.open(link.href, "_blank", "noopener,noreferrer");
                });
                this.addEventListener("contextmenu", (t) => {
                  this.firstElementChild?.focus();
                  n.onContextMenu(t);
                });
              }

              connectedCallback() {
                // Custom-element constructors cannot append children during parser creation.
                if (!this.firstElementChild) {
                  this.append(n._template().content.cloneNode(true));
                  const checkbox = this.firstElementChild;
                  checkbox.style.pointerEvents = "none";
                  checkbox.tabIndex = 0;
                  if (!customElements.get("tp-yt-paper-checkbox")) {
                    checkbox.setAttribute("role", "checkbox");
                    Object.defineProperty(checkbox, "checked", {
                      get() { return this.hasAttribute("checked"); },
                      set(value) {
                        this.toggleAttribute("checked", Boolean(value));
                        this.setAttribute("aria-checked", String(Boolean(value)));
                      },
                    });
                    checkbox.checked = !1;
                  }
                }
                n.attached.call(this);
              }

              disconnectedCallback() {
                n.detached.call(this);
              }

              toggle(event) {
                it(event);
                const checkbox = this.firstElementChild;
                checkbox.focus();
                checkbox.checked = !checkbox.checked;
                n.onTap({ detail: { sourceEvent: event }, target: checkbox });
              }
            }
          );
        },
        r = (t) => {
          const e = customElements.get(t)?.generatedFrom?._template;
          return "function" == typeof e ? e() : e;
        },
        a = (n, i) => {
          if (O) return;
          t[n] = i;
          const r = i?.content?.lastElementChild;
          r && ![...i.content.children].some((child) => child.localName === h) && r.after(o()),
            ((t) => {
              const n = e.querySelectorAll(t);
              n.length &&
                (n.length,
                n.forEach((t) => t.querySelector(":scope > " + h) || t.append(o())));
            })(n);
        };
      return {
        ct: i,
        tt(t) {
          i();
          const e = r(t);
          e
            ? a(t, e)
            : ht(t).then((e) => {
                const n = e.polymerController || e.inst;
                a(t, n?._template);
              });
        },
        st(e) {
          const n = t[e] || r(e);
          [...n?.content?.children || []].filter((child) => child.localName === h).forEach((wrapper) => wrapper.remove());
          delete t[e];
        },
        get yt() {
          return n;
        },
      };
    })(),
    It = (function () {
      const t = [
          "ytd-rich-grid-media",
          "ytd-rich-grid-slim-media",
          "ytd-video-renderer",
          "ytd-reel-item-renderer",
          "ytd-grid-video-renderer",
          "ytd-playlist-video-renderer",
          "ytd-compact-video-renderer",
          "ytmusic-responsive-list-item-renderer",
        ],
        n = [],
        o = (t) => Tt.st(t);
      let r, a;
      const sizes = new ResizeObserver(() => a || (a = requestAnimationFrame(c)));
      const measured = new Set();
      const fit = (row, wrapper) => {
        if (!row.matches(`${LK}, ytd-rich-grid-media, ytd-rich-grid-slim-media, ytd-grid-video-renderer, ytd-reel-item-renderer`)) return;
        const media = row.querySelector('yt-thumbnail-view-model, [class*="ThumbnailContainer"], [class*="ThumbnailParentContainer"], ytd-thumbnail, img');
        if (!media) return;
        for (const target of [row, media]) {
          if (!measured.has(target)) sizes.observe(target), measured.add(target);
        }
        const rect = media.getBoundingClientRect(), host = row.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        Object.assign(wrapper.style, {
          left: `${rect.left - host.left - row.clientLeft + row.scrollLeft}px`,
          top: `${rect.top - host.top - row.clientTop + row.scrollTop}px`,
          width: `${rect.width}px`, height: `${rect.height}px`,
        });
      };
      // Lockups are not Polymer elements, and YouTube's Polymer renderers no longer expose their
      // templates, so wrappers are inserted directly into whatever is on the page.
      const c = () => {
        a = 0;
        if (O) return;
        for (const target of measured) {
          if (!target.isConnected) sizes.unobserve(target), measured.delete(target);
        }
        Tt.ct();
        e.querySelectorAll(`${LK}, ${t.join(", ")}`).forEach((n) => {
          !n.querySelector(":scope > " + h) &&
            (n.matches(LK) ? lkId(n) : !0) &&
            n.append(el(h));
          const wrapper = n.querySelector(":scope > " + h);
          if (wrapper) fit(n, wrapper);
        });
        indexes.update(P());
      };
      return {
        refresh() {
          if (!O && !a) a = requestAnimationFrame(c);
        },
        tt() {
          t.forEach((t) =>
            customElements.whenDefined(t).then(() =>
              ((t) => {
                if (O) return;
                Tt.tt(t), n.push(t);
              })(t)
            )
          ),
            c(),
            (r = new MutationObserver(() => a || (a = requestAnimationFrame(c)))),
            r.observe(e.body, { childList: !0, subtree: !0, attributes: !0, attributeFilter: ['hidden', 'is-hidden', 'href'] });
        },
        st() {
          r?.disconnect(),
            indexes.clear(),
            sizes.disconnect(),
            measured.clear(),
            cancelAnimationFrame(a),
            n.forEach(o),
            (n.length = 0),
            e.querySelectorAll(h).forEach((t) => t.remove());
        },
      };
    })();
  function At() {
    if (G().length) {
      const e = bt.T.C;
      return bt.p(e), ct(), !z.preserveSelection;
    }
  }
  async function innertube(path, payload) {
    const cfg = t.ytcfg,
      origin = location.origin,
      cookie = (n) => (e.cookie.match(new RegExp(`(?:^|;\\s*)${n}=([^;]+)`)) || [])[1],
      sapisid = cookie("SAPISID") || cookie("__Secure-3PAPISID");
    if (!cfg || !sapisid)
      throw new Error(`missing session data (ytcfg: ${!!cfg}, SAPISID: ${!!sapisid})`);
    const ts = Math.floor(Date.now() / 1e3),
      sha1 = async (s) =>
        [...new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s)))]
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(""),
      auth = (
        await Promise.all(
          [
            ["SAPISIDHASH", sapisid],
            ["SAPISID1PHASH", cookie("__Secure-1PAPISID")],
            ["SAPISID3PHASH", cookie("__Secure-3PAPISID")],
          ]
            .filter(([, v]) => v)
            .map(async ([n, v]) => `${n} ${ts}_${await sha1(`${ts} ${v} ${origin}`)}`)
        )
      ).join(" "),
      baseContext = cfg.get("INNERTUBE_CONTEXT"),
      delegatedSessionId = cfg.get("DELEGATED_SESSION_ID"),
      context = delegatedSessionId
        ? {
            ...baseContext,
            user: { ...baseContext?.user, onBehalfOfUser: delegatedSessionId },
          }
        : baseContext,
      res = await fetch(
        `${path}?key=${cfg.get("INNERTUBE_API_KEY")}&prettyPrint=false`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            authorization: auth,
            "x-goog-authuser": String(cfg.get("SESSION_INDEX") ?? 0),
            "x-origin": origin,
            "x-youtube-client-name": String(cfg.get("INNERTUBE_CONTEXT_CLIENT_NAME") ?? 1),
            "x-youtube-client-version": cfg.get("INNERTUBE_CONTEXT_CLIENT_VERSION") ?? context?.client?.clientVersion,
          },
          body: JSON.stringify({ context, ...payload }),
        }
      ),
      body = await res.json();
    if (!res.ok || body.error || (body.status && "STATUS_SUCCEEDED" !== body.status))
      throw new Error(`HTTP ${res.status}: ${JSON.stringify(body.error || body.status || body).slice(0, 300)}`);
    return body;
  }
  // Replaces the removed ytd-app.sendServiceAjax_ for the endpoints this extension builds.
  async function serviceRequest(endpoint) {
    const cont = endpoint?.continuationCommand,
      edit = endpoint?.playlistEditEndpoint;
    if (cont)
      return innertube(
        endpoint.commandMetadata?.webCommandMetadata?.apiUrl || "/youtubei/v1/browse",
        { continuation: cont.token }
      ).then((r) => ({ ...r, actions: r.onResponseReceivedActions ?? r.actions }));
    if (edit) return innertube("/youtubei/v1/browse/edit_playlist", edit);
    if (endpoint?.feedbackEndpoint?.feedbackToken) return innertube('/youtubei/v1/feedback', { feedbackTokens: [endpoint.feedbackEndpoint.feedbackToken] });
    throw new Error("unsupported service endpoint");
  }
  function watchLaterRequest(ids) {
    if (!ids.length) return Promise.reject(new Error("no videos selected"));
    const chunkSize = 50;
    return ids.reduce(
      (request, _, index) =>
        index % chunkSize
          ? request
          : request.then(() =>
              innertube("/youtubei/v1/browse/edit_playlist", {
                playlistId: "WL",
                actions: ids
                  .slice(index, index + chunkSize)
                  .map((id) => ({ addedVideoId: id, action: o })),
              })
            ),
      Promise.resolve()
    );
  }
  function zt() {
    const ids = G();
    if (!ids.length) {
      Kt(L.messages.invalidData);
      return !1;
    }
    const fallback = bt.T.V;
    return (
      watchLaterRequest(ids)
        .then((res) => {
          console.info("[multi-select] Watch later saved:", ids, res);
          Kt(`✔️   ${L.messages.addToWatchLater} (${ids.length})`);
        })
        .catch((err) => {
          console.warn("[multi-select] Watch later request failed, falling back:", err);
          return bt.p(fallback).then(
            (ok) => ok && Kt(`✔️   ${L.messages.addToWatchLater} (${ids.length})`),
            (fallbackError) => {
              console.warn("[multi-select] Watch later fallback failed:", fallbackError);
              Kt("👎   " + L.messages.addToWatchLater);
            }
          );
        }),
      ct(),
      !z.preserveSelection
    );
  }
  async function likeVideos() {
    const ids = G().filter(Boolean);
    const label = L.messages.likeVideos || "Like selected videos";
    if (!ids.length) {
      Kt("👎   " + L.messages.invalidData);
      return;
    }
    let liked = 0;
    for (const videoId of ids) {
      try {
        await innertube("/youtubei/v1/like/like", { target: { videoId } });
        liked++;
      } catch (err) {
        console.warn("[multi-select] Like failed:", videoId, err);
      }
    }
    if (liked === ids.length) {
      Kt(`✔️   ${label} (${liked})`);
    } else {
      Kt(`👎   ${label} (${liked}/${ids.length})`);
    }
  }
  // YouTube no longer re-renders the list after a move, so mirror the server-side result in the DOM.
  function rowOf(el) {
    // Never climb based on the number of peers: a one-item list used to resolve to <html>.
    return el.matches(LK) ? el.closest('ytd-rich-item-renderer') || el : el;
  }
  // Same for removals: capture the rows now, drop them once the request has succeeded.
  function removeRows() {
    const playlist = J();
    const rows = [...S()].map((b) => b.parentElement.parentElement).filter(Boolean).map(rowOf);
    return (ok) => {
      if (!ok || O || J() !== playlist) return;
      rows.forEach((r) => r.remove());
      Kt(`✔️   ${L.messages.removeVideos} (${rows.length})`);
      softRefresh();
    };
  }
  // Re-fetches the playlist and hands it to YouTube's own browse element, which re-renders the list
  // in place (no navigation, no page load); falls back to a soft navigation.
  async function softRefresh(expectTop) {
    const y = t.scrollY,
      restore = () => setTimeout(() => t.scrollTo(0, y), 400);
    try {
      const list = J(),
        host = e.querySelector(b + '[page-subtype="playlist"]');
      if (!list || !host) throw new Error("playlist page not found");
      let fresh;
      // Liked Videos order lags behind a like by a moment; wait until the moved videos lead the list.
      for (let tries = 0; tries < 6; tries++) {
        const endpoint = playlistTab(q())?.endpoint?.browseEndpoint;
        fresh = await innertube("/youtubei/v1/browse", { browseId: "VL" + list, ...endpoint });
        if (O || J() !== list || !host.isConnected) return;
        if (!expectTop) break;
        const top = [...JSON.stringify(fresh).matchAll(/"contentId":"([\w-]{11})"/g)].map((m) => m[1]);
        if (expectTop.every((id, i) => top[i] === id)) break;
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      host.data = fresh;
      console.info("[multi-select] Playlist data refreshed in place");
    } catch (err) {
      console.warn("[multi-select] In-place refresh failed:", err);
      try {
        bt.$();
      } catch (navigationError) {
        console.warn("[multi-select] Playlist reload failed:", navigationError);
        Kt("👎   " + L.messages.invalidData);
      }
    }
    restore();
  }
  function moveRows(mode, anchor, expectTop) {
    const playlist = J();
    const isRow = (c) => c.localName === sample?.localName,
      anchorRow = anchor && rowOf(anchor),
      rows = [...S()]
        .map((b) => rowOf(b.parentElement.parentElement))
        .filter((r, i, all) => r !== anchorRow && all.indexOf(r) === i),
      sample = rows[0],
      parent = sample?.parentElement;
    console.info("[multi-select] move", mode, rows.length, "rows");
    return (ok) => {
      console.info("[multi-select] move result:", ok, "parent:", !!parent);
      if (!ok || !parent?.isConnected || O || J() !== playlist) return;
      Kt(`✔️   ${{ top: L.messages.moveToTop, bottom: L.messages.moveToBottom, after: L.messages.moveAfter }[mode]} (${rows.length})`);
      const frag = e.createDocumentFragment();
      frag.append(...rows);
      const siblings = [...parent.children].filter(isRow);
      if ("top" === mode) parent.insertBefore(frag, siblings[0] ?? null);
      else if ("bottom" === mode) parent.insertBefore(frag, siblings.at(-1)?.nextSibling ?? null);
      else if (anchorRow?.parentElement === parent) parent.insertBefore(frag, anchorRow.nextSibling);
      else parent.insertBefore(frag, siblings[0] ?? null);
      softRefresh(expectTop);
    };
  }
  function reorderSelected(order, message) {
    const playlist = J();
    const selected = [...S()],
      setVideoIds = selected.map(U),
      first = selected[0],
      anchor = first && rowOf(first.parentElement.parentElement),
      parent = anchor?.parentElement,
      rows = selected.map((checkbox) => rowOf(checkbox.parentElement.parentElement)),
      previous = parent && [...parent.children]
        .slice(0, [...parent.children].indexOf(anchor))
        .reverse()
        .find((child) => child.matches?.(LK) || child.querySelector?.(x));
    if (!setVideoIds.every(Boolean) || !parent || !rows.length || new Set(setVideoIds).size !== setVideoIds.length || rows.some((row) => row.parentElement !== parent)) {
      Kt("👎   " + L.messages.invalidData);
      return !1;
    }
    const actions = order
      .slice()
      .reverse()
      .map((setVideoId) => ({
        setVideoId,
        action: "ACTION_MOVE_VIDEO_AFTER",
        ...(previous ? { movedSetVideoIdPredecessor: U(previous.querySelector(x)) } : {}),
      }));
    const request = {
      commandMetadata: {
        webCommandMetadata: {
          sendPost: !0,
          apiUrl: "/youtubei/v1/browse/edit_playlist",
        },
      },
      playlistEditEndpoint: { playlistId: J(), params: "CAFAAQ%3D%3D", actions },
    };
    bt.p(request, void 0, !1)?.then((ok) => {
      if (!ok || O || J() !== playlist || !parent.isConnected || rows.some((row) => row.parentElement !== parent)) return;
      // The menu clears checkboxes before this async request finishes. Use captured rows.
      const marker = e.createComment("msfy-reorder");
      parent.insertBefore(marker, rows[0]);
      const fragment = e.createDocumentFragment();
      order.forEach((setVideoId) => {
        const index = setVideoIds.indexOf(setVideoId);
        const row = rows[index];
        row && fragment.appendChild(row);
      });
      marker.replaceWith(fragment);
      z.counts.move += order.length;
      ct();
      Kt(`✔️   ${message} (${order.length})`);
      softRefresh();
    });
    return !0;
  }
  function channelName(data) {
    return (
      data?.shortBylineText?.runs?.map((run) => run.text).join("") ||
      data?.longBylineText?.runs?.map((run) => run.text).join("") ||
      data?.ownerText?.runs?.map((run) => run.text).join("") ||
      ""
    );
  }
  function groupByChannel() {
    const selected = [...S()],
      order = selected
        .map((checkbox) => ({ setVideoId: U(checkbox), channel: channelName(j(checkbox).data) }))
        .reduce((groups, item) => {
          const group = groups.find((candidate) => candidate.channel === item.channel);
          (group || groups[groups.push({ channel: item.channel, items: [] }) - 1]).items.push(item);
          return groups;
        }, [])
        .flatMap((group) => group.items)
        .map((item) => item.setVideoId);
    return reorderSelected(order, L.messages.groupByChannel);
  }
  function sortSelected(field, direction) {
    const items = [...S()].map((checkbox) => ({ id: U(checkbox), data: j(checkbox).data, row: checkbox.parentElement.parentElement }));
    const { order, known } = sortedVideos(items, field, direction);
    if (!known) return Kt(L.messages.sortMissingData), !1;
    const key = field === "date" ? (direction === "asc" ? "sortDateAsc" : "sortDateDesc") : (direction === "asc" ? "sortDurationAsc" : "sortDurationDesc");
    return reorderSelected(order, L.messages[key]);
  }
  function flipSelected() {
    return reorderSelected([...S()].map(U).reverse(), L.messages.flipList);
  }
  function Lt() {
    if (!bt.T.M.every(Boolean)) return Kt("👎   " + L.messages.invalidData), !1;
    const t = bt.T.D,
      apply = moveRows("after", $t.B?.parentElement?.parentElement);
    return bt.p(t, void 0, !1)?.then(apply), ct(), !0;
  }
  function moveStep(direction) {
    const playlist = J();
    const checkboxes = [...P()], ids = checkboxes.map(U), selected = new Set([...S()].map(U));
    const rows = checkboxes.map((checkbox) => rowOf(checkbox.parentElement.parentElement));
    const parent = rows[0]?.parentElement;
    if (!parent || !ids.every(Boolean) || new Set(ids).size !== ids.length || rows.some((row) => row.parentElement !== parent)) {
      Kt("👎   " + L.messages.invalidData);
      return !1;
    }
    const { order, actions } = stepMove(ids, selected, direction);
    if (!actions.length) return !1;
    bt.p({ playlistEditEndpoint: { playlistId: J(), params: "CAFAAQ%3D%3D", actions } }, void 0, !1)?.then((ok) => {
      if (!ok || O || J() !== playlist || !parent.isConnected) return;
      // Placeholders preserve non-video children such as continuation and section controls.
      const slots = rows.map((row) => {
        const slot = e.createComment("msfy-row");
        row.replaceWith(slot);
        return slot;
      });
      order.forEach((id, index) => slots[index].replaceWith(rows[ids.indexOf(id)]));
      z.counts.move += actions.length;
      ct();
      Kt(`✔️   ${direction === "up" ? L.messages.moveUp : L.messages.moveDown} (${selected.size})`);
      softRefresh();
    });
    return !0;
  }
  // Liked Videos has no manual order (no setVideoIds); it is sorted by like time, so moving to the
  // top means un-liking and re-liking, last video first so the selection keeps its order.
  async function likeToTop(ids, apply) {
    const send = (path, videoId) => innertube(path, { target: { videoId } });
    let done = 0;
    try {
      for (const id of [...ids].reverse()) {
        await send("/youtubei/v1/like/removelike", id);
        try {
          await send("/youtubei/v1/like/like", id);
        } catch {
          await send("/youtubei/v1/like/like", id);
        }
        done++;
      }
    } catch (err) {
      console.warn("[multi-select] Liked videos move failed:", err);
      Kt("👎   " + (err?.message || L.messages.invalidData));
    }
    if (done === ids.length) apply(!0);
    else if (done) softRefresh();
  }
  function Mt() {
    if (W()) {
      const ids = G(),
        apply = moveRows("top", void 0, ids);
      return likeToTop(ids, apply), ct(), !0;
    }
    if (!bt.T.M.every(Boolean)) return Kt("👎   " + L.messages.invalidData), !1;
    const t = bt.T.P,
      apply = moveRows("top");
    return bt.p(t, void 0, !1)?.then(apply), ct(), !0;
  }
  function Ct() {
    if (!bt.T.M.every(Boolean)) return Kt("👎   " + L.messages.invalidData), !1;
    const t = bt.T.S,
      apply = moveRows("bottom");
    return bt.p(t, void 0, !1)?.then(apply), ct(), !0;
  }
  function Ot() {
    const t = G();
    if (t.length) {
      M = !0;
      innertube("/youtubei/v1/playlist/get_add_to_playlist", {
        videoIds: [t[0]],
        excludeWatchLater: !1,
      }).then((e) => {
        const n = e?.contents?.find?.(
          (t) => t.addToPlaylistRenderer
        )?.addToPlaylistRenderer;
        if (n) {
          const e = n.actions?.find?.(
            (t) => t.addToPlaylistCreateRenderer
          )?.addToPlaylistCreateRenderer;
          if (e) {
            const n = e.serviceEndpoint?.createPlaylistServiceEndpoint;
            n && (n.videoIds = t);
          }
          const r = t.map((t) => ({ action: o, addedVideoId: t })),
            a = t.map((t) => ({ action: i, removedVideoId: t }));
          n.playlists?.forEach((e) => {
            const n = e.playlistAddToOptionRenderer;
            if (n) {
              t.length > 1 && (n.containsSelectedVideos = "NONE");
              const e = n.addToPlaylistServiceEndpoint?.playlistEditEndpoint;
              e && (e.actions = r);
              const o =
                n.removeFromPlaylistServiceEndpoint?.playlistEditEndpoint;
              o && (o.actions = a);
            }
          });
          const c = {
            openPopupAction: {
              popupType: "DIALOG",
              popup: { addToPlaylistRenderer: n },
            },
          };
          bt.m("yt-open-popup-action", [c, bt.v]);
        } else {
          M = !1;
          Kt("👎   " + L.messages.invalidData);
        }
      }).catch((err) => {
        M = !1;
        console.warn("[multi-select] Save to playlist failed:", err);
        Kt("👎   " + L.messages.addToPlaylist);
      });
    }
  }
  function Dt() {
    const t = G();
    if (!t.length) return !1;
    V.t = t;
    z.counts.copy += t.length;
    ct();
    wt.U("copy");
    return !z.preserveSelection;
  }
  function Rt(t) {
    wt.U("paste");
    const e = t || V.t;
    if (!Array.isArray(e) || !e.length || e.some((id) => !/^[\w-]{11}$/.test(id))) {
      Kt("👎   " + L.messages.invalidData);
      return;
    }
    const n = bt.T.N(e);
    bt.h(n).then(
      (n) => {
        bt.$(), t && (V.t = t), (z.counts.paste += e.length), ct();
      },
      (t) => Kt("👎   " + (t.args?.[1]?.message || L.messages.invalidData))
    );
  }
  function Pt() {
    St(!0);
  }
  function St(t) {
    z.noRemovalConfirmation ? Nt(t) : xt.ot().then((e) => e && Nt(t));
  }
  async function removeHistory(cut) {
    const entries = [...S()].map((checkbox) => ({ row: rowOf(checkbox.parentElement.parentElement), data: j(checkbox).data }));
    if (cut) V.t = G();
    let removed = 0;
    for (const { row, data } of entries) {
      try {
        const menu = data?.menu?.menuRenderer;
        const endpoint = ft(menu?.topLevelButtons, ['buttonRenderer', 'serviceEndpoint', 'feedbackEndpoint']) ||
          ft(menu?.items, ['menuServiceItemRenderer', 'serviceEndpoint', 'feedbackEndpoint']);
        if (!endpoint) throw new Error(L.messages.invalidData);
        await serviceRequest({ feedbackEndpoint: endpoint });
        row.remove();
        removed++;
      } catch (error) {
        Kt('👎   ' + (error?.message || L.messages.invalidData));
        break;
      }
    }
    z.counts.cut += removed;
    ct();
    if (removed) Kt(`✔️   ${L.messages.removeVideos} (${removed})`);
  }
  // Liked Videos items are removed by un-liking; the lockup rows carry no menu data to read it from.
  async function unlikeVideos() {
    const entries = [...S()].map((b) => ({ id: F(b), row: rowOf(b.parentElement.parentElement) }));
    let removed = 0;
    for (const { id, row } of entries) {
      try {
        await innertube("/youtubei/v1/like/removelike", { target: { videoId: id } });
        row.remove();
        removed++;
      } catch (err) {
        console.warn("[multi-select] Un-like failed:", err);
        Kt("👎   " + (err?.message || L.messages.invalidData));
        break;
      }
    }
    removed && Kt(`✔️   ${L.messages.removeVideos} (${removed})`);
  }
  // Saved Shorts has no playlist edit API; each item carries its own "remove" feedback token.
  async function unsaveShorts() {
    const items = PL()?.[0]?.richGridRenderer?.contents ?? PL() ?? [],
      tokenOf = (id) => {
        const item = items.find((x) => {
          const json = JSON.stringify(x);
          return json.includes(`"videoId":"${id}"`) || json.includes(`"contentId":"${id}"`);
        });
        return item && JSON.stringify(item).match(/"imageName":"DELETE"[\s\S]*?"feedbackToken":"([^"]+)"/)?.[1];
      },
      entries = [...S()].map((b) => ({ id: F(b), row: rowOf(b.parentElement.parentElement) }));
    let removed = 0;
    for (const { id, row } of entries) {
      try {
        const token = tokenOf(id);
        if (!token) throw new Error(L.messages.invalidData);
        await innertube("/youtubei/v1/feedback", { feedbackTokens: [token] });
        row.remove();
        removed++;
      } catch (err) {
        console.warn("[multi-select] Remove from saved shorts failed:", err);
        Kt("👎   " + (err?.message || L.messages.invalidData));
        break;
      }
    }
    removed && Kt(`✔️   ${L.messages.removeVideos} (${removed})`);
  }
  function Nt(t) {
    t && wt.U("cut"),
      (D()
        ? (removeHistory(t), !0)
        : W()
        ? (function (t) {
            t && (V.t = G()), (z.counts.cut += S().length);
            return unlikeVideos(), ct(), !0;
          })(t)
        : SS()
        ? (function (t) {
            t && (V.t = G()), (z.counts.cut += S().length);
            return unsaveShorts(), ct(), !0;
          })(t)
        : (function (t) {
            const e = bt.T.O(t),
              apply = removeRows();
            return bt.p(e, void 0, !1)?.then(apply), ct(), !0;
          })(t)) && lt();
  }
  function Yt() {
    const t = z.findDuplicatesBackwards ? [...P()].reverse() : P(),
      e = {};
    let n = !1;
    for (let o = 0; o < t.length; o++) {
      const i = t[o],
        r = F(i);
      r && ((e[r] = (e[r] || 0) + 1), e[r] > 1 && ((i.checked = !0), (n = !0)));
    }
    !n && Kt("👍   " + L.messages.noDuplicatesFound), kt.l();
  }
  const Ht = (function () {
    const t = s + "-choose-format-" + c,
      n = !0;
    let o, i, r;
    const a = () =>
        +o?.querySelector(
          "section > label > input[type=radio][name=type]:checked"
        )?.value,
      d = (t) => {
        e.removeEventListener("keydown", r, n), o.close(t), i(t), (i = null);
      },
      l = () => {
        if (!o) {
          (o = e.createElement("dialog")),
            (o.id = t),
            (o.className = m),
            o.append(el('form', { method: 'dialog' }, el('header'),
              el('section', {}, ['JSON', 'TEXT', 'HTML'].map((label, index) => el('label', {}, el('input', { type: 'radio', name: 'type', value: index, checked: index === 0 }), label))),
              el('footer', {}, el('button', { type: 'button', id: 'cancel' }, L.messages.cancel), el('button', { type: 'button', id: 'submit' }, L.messages.save || 'Save'))));
          const n = o.querySelector("button#cancel"),
            i = o.querySelector("button#submit");
          n.addEventListener("click", (t) => d(-1)),
            i.addEventListener("click", (t) => d(a())),
            (r = (t) => {
              if (t.target.matches('input[type="radio"]') && [" ", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(t.key)) return;
              switch (t.key) {
                case "Escape":
                  d(-1);
                  break;
                case " ":
                case "Enter":
                  d(t.target === n ? -1 : a());
                  break;
                case "Tab":
                  if (t.shiftKey && t.target === n) o.querySelector('input:checked').focus();
                  else if (!t.shiftKey && t.target.matches('input[type="radio"]')) n.focus();
                  else if (!t.shiftKey && t.target === i) o.querySelector('input:checked').focus();
                  else (t.shiftKey ? n : i).focus();
                  break;
                case "ArrowLeft":
                case "ArrowRight":
                  t.target === n ? i.focus() : n.focus();
              }
              it(t);
            }),
            e.body.appendChild(o);
        }
      };
    return {
      ot() {
        if (!o?.open)
          return (
            !o && l(),
            (o.querySelector("header").textContent =
              L.messages.chooseOutputFormat),
            e.addEventListener("keydown", r, n),
            o.showModal(),
            new Promise((t) => (i = t))
          );
      },
      st() {
          o && (i && d(-1), e.removeEventListener("keydown", r, n), o.remove(), (o = null));
      },
      get dt() {
        return t;
      },
    };
  })();
  function jt() {
    function o(t) {
      switch (t) {
        case 0:
          return JSON.stringify(G());
        case 1:
          return G().join("\n");
        case 2:
          return selectionHtml([...S()].map((checkbox) => {
            const row = j(checkbox), data = row?.data;
            return {
              id: F(checkbox),
              thumbnail: data?.thumbnail?.thumbnails?.[0]?.url || row.querySelector('img')?.src,
              title: data?.title?.runs?.map((run) => run.text).join('') || data?.title?.simpleText || data?.headline?.simpleText,
            };
          }));
      }
    }
    Ht.ot().then((n) => {
      const i = A[n];
      if (i) {
        const r = o(n),
          a = new Blob([r], { type: i }),
          c = URL.createObjectURL(a),
          s = e.createElement("a");
        (s.href = c),
          (s.download = "youtube-links"),
          e.body.appendChild(s),
          s.click(),
          setTimeout(() => { s.remove(); t.URL.revokeObjectURL(c); }, 1000);
      }
    });
  }
  function Ft() {
    const t = e.createElement("input");
    (t.type = "file"),
      (t.accept = A.toString()),
      (t.onchange = (e) => {
        const n = e.target?.files?.[0];
        n &&
          (function (t) {
            if (t) {
              const e = new FileReader();
              (e.onload = (e) => {
                try {
                  const o = parseSelectionFile(e.target.result, t.type, t.name);
                  Rt(o);
                } catch (i) {
                  Kt("👎   " + L.messages.invalidData);
                }
              }),
                e.readAsText(t);
            }
          })(n),
          setTimeout(() => t.remove());
      }),
      e.body.appendChild(t),
      t.click();
  }
  const Ut = r
      ? (function () {
          function t(t) {
            te();
          }
          const n = s + "-disable-extension-detector";
          return {
            create() {
              if (e.body) {
                const o = Bt.style;
                if (o && !e.getElementById(n)) {
                  const i = e.createElement("div");
                  (i.id = n),
                    e.body.appendChild(i),
                    i.addEventListener("transitionrun", t),
                    o.sheet.insertRule(
                      `#${n} { position: absolute; height: 0; width: 0; color: black; transition: color 1ms; }`
                    );
                }
              }
            },
            remove() {
              const o = e.getElementById(n);
              o && (o.removeEventListener("transitionrun", t), o.remove());
            },
          };
        })()
      : null,
    Bt = (function () {
      const t = `${s}-${c}-polymer`;
      let n;
      return {
        gt: () => (
          n ||
            ((n = e.createElement("style")),
            (n.id = t),
            n.append(e.createTextNode(filterStyles)),
            e.head.appendChild(n),
            Ut?.create()),
          n
        ),
        xt() {
          n && (Ut?.remove(), n.remove(), (n = null));
        },
        vt() {
          if (n) {
            const t = 600,
              e = "24px",
              o = "0 4px 32px 0 rgba(0, 0, 0, 0.3)",
              i = `var(--${s}-popup-layer)`,
              r = "var(--paper-listbox-color, var(--primary-text-color))",
              a = "var(--yt-spec-10-percent-layer)",
              d = `1px solid ${a}`,
              l = 4,
              v = vt.dt,
              w = kt.dt,
              A = s + "-heartbeat-" + c,
              z = s + "-penalty-" + c,
              L = 40,
              M = 52,
              C = M / 2,
              O = [
                `html { --${s}-spec-20-percent-layer: rgba(0, 0, 0, 0.2); --${s}-popup-layer: #fff; }`,
                `html[dark] { --${s}-spec-20-percent-layer: rgba(255, 255, 255, 0.2); --${s}-popup-layer: #282828; }`,
                `@keyframes ${z} { 0%, 50% { transform: scale(1); } 25% { transform: scale(4); } }`,
                `#${f} { font-size: 64px; position: fixed; top: 50vh; left: 50vw; z-index: 10000; pointer-events: none; animation: ${z} linear 1s infinite; }`,
                `.${m} { font-size: 14px; border-radius: ${k}; border: ${d}; box-shadow: ${o}; background-color: ${i}; color: ${r}; padding: 0; user-select: none; }`,
                `.${m} > form > header { margin: 24px; font-size: 16px; letter-spacing: 0.1px; }`,
                `.${m} > form > section { margin: 24px; color: var(--yt-spec-text-secondary, #aaa); letter-spacing: 0.2px; }`,
                `.${m} > form > footer { display: flex; justify-content: flex-end; padding: 10px 24px; border-top: ${d}; }`,
                `.${m} > form > footer > button { display: flex; align-items: center; justify-content: center; background-color: transparent; padding: 0 14px; height: 36px; line-height: 36px; outline: none; border-color: transparent; border-style: solid; border-radius: 18px; font-family: inherit; font-size: inherit; font-weight: 500; cursor: pointer; }`,
                `.${m} > form > footer > button#cancel { color: var(--yt-spec-text-primary); }`,
                `.${m} > form > footer > button#cancel:hover { background-color: ${a}; }`,
                `.${m} > form > footer > button#cancel:focus:not(:hover) { border-color: var(--yt-spec-text-primary); }`,
                `.${m} > form > footer > button#submit { color: var(--yt-spec-call-to-action, #3ea6ff); }`,
                `.${m} > form > footer > button#submit:hover { background-color: var(--yt-spec-suggested-action, #263850); }`,
                `.${m} > form > footer > button#submit:focus:not(:hover) { border-color: var(--yt-spec-call-to-action, #3ea6ff); }`,
                `.${m}::backdrop { background: rgba(0, 0, 0, 0.3); opacity 0.3; transition: opacity 0.2s; }`,
                `#${xt.dt}:not([open]) { display: none; }`,
                `#${Ht.dt}:not([open]) { display: none; }`,
                `#${Ht.dt} > form > section { display: flex; justify-content: space-between; }`,
                `#${Ht.dt} > form > section > label { display: flex; align-items: center; cursor: pointer; }`,
                `#${Ht.dt} > form > section > label > input { margin: 0 7px 0 0; cursor: pointer; }`,
                `#${v} { position: relative; display: flex; align-items: center; justify-content: center; margin-right: 8px; color: ${r}; }`,
                `#${v} > #button { width: ${L}px; height: ${L}px; }`,
                `#${v} > #button:hover { border-radius: 50%; background-color: ${a}; }`,
                `@keyframes ${
                  T + "-fade-out"
                } { from { opacity: 1; } to { opacity: 0; } }`,
                `#${T} { width: min(320px, calc(100vw - 32px)); box-sizing: border-box; border-radius: 14px; border: 1px solid var(--yt-spec-10-percent-layer, rgba(255,255,255,.12)); padding: 14px; box-shadow: 0 8px 28px rgba(0,0,0,.35); background-color: var(--yt-spec-menu-background, #212121); color: ${r}; position: fixed; top: 64px; left: 50vw; transform: translateX(-50%); font-size: 14px; z-index: 10000; }`,
                `#${T} > header { display: flex; align-items: center; gap: 8px; padding-bottom: 10px; font-size: 14px; font-weight: 500; }`,
                `#${T} > header > #${I} { --yt-icon-button-icon-width: ${e}; --yt-icon-button-icon-height: ${e}; width: ${L}px; height: ${L}px; margin-left: 20px; }`,
                `#${T} > header > #${I}:hover { background-color: ${a}; border-radius: 50%; }`,
                `#${T} > #status { min-height: 18px; margin: 0 0 8px; color: var(--yt-spec-text-secondary, #aaa); font-size: 12px; }`,
                `#${T} > [role="progressbar"] { height: 28px; box-sizing: border-box; padding: 5px 8px; background-color: var(--yt-spec-call-to-action, #065fd4); color: #fff; text-align: center; border-radius: 8px; font-size: 12px; font-weight: 600; transition: width 120ms linear; }`,
                `#${w} { display: none; position: fixed; width: max-content; box-sizing: border-box; padding: 4px 6px; border-radius: ${k}; border: ${d}; box-shadow: ${o}; background-color: ${i}; color: ${r}; font-family: Roboto, Arial, sans-serif; font-size: 14px; max-width: min(${t}px, calc(100vw - 24px)); z-index: 2030; }`,
                `#${w}[position=center] { bottom: 30px; left: 50vw; transform: translateX(-50%); }`,
                `#${w}[position=left] { bottom: 30px; left: clamp(12px, calc(100vw - ${t}px), 50px); }`,
                `#${w}[position=custom] { left: clamp(0px, var(--x), calc(100vw - var(--right-offset))); top: clamp(1px, var(--y), calc(100vh - var(--bottom-offset))); }`,
                `#${w} > #drag-handle { visibility: hidden; position: absolute; top: 0; left: 50%; transform: translateX(-50%); cursor: move; padding: 3px 12px; width: 24px; }`,
                `#${w} > #drag-handle > hr { border: 0; height: 2px; border-radius: 1px; background-color: var(--yt-spec-text-secondary, #aaa); }`,
                `#${w} > #drag-handle > hr:first-child { margin: 0; }`,
                `#${w} > #drag-handle > hr:last-child { margin: 2px 0 0; }`,
                `#${w}[position=custom] > #drag-handle { visibility: visible; }`,
                `#${w} > #content { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 2px; outline: none; }`,
                `#${w} > #content > #selection { margin: 0 2px 0 4px; white-space: nowrap; pointer-events: none; font-weight: 500; font-variant-numeric: tabular-nums; }`,
                `#${w} > #content > .${s}-selection-label { pointer-events: none; margin: 0 4px 0 0; font-size: 12px; color: var(--yt-spec-text-secondary, #aaa); white-space: nowrap; }`,
                `#${w} > #content > yt-icon-button { --yt-icon-button-icon-width: ${e}; --yt-icon-button-icon-height: ${e}; width: ${L}px; height: ${L}px; flex: none; }`,
                `#${w} > #content > tp-yt-paper-tooltip:not(:defined) { display: none; }`,
                `#${w} > #content > yt-icon-button:hover { background-color: ${a}; border-radius: 50%; }`,
                `#${w} > #content > yt-icon-button[disabled] { pointer-events: none; cursor: auto; color: var(--paper-icon-button-disabled-text, var(--disabled-text-color)); }`,
                `.${s}-bar-menu { position: fixed; z-index: 2031; width: max-content; max-width: calc(100vw - 16px); }`,
                `.${s}-bar-menu > #msfy-menu-list { box-sizing: border-box; max-width: calc(100vw - 16px); overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; scrollbar-gutter: stable; touch-action: pan-y; }`,
                `.${s}-context-menu { position: absolute; z-index: 2030; transform: translateX(clamp(5vw, var(--x), calc(100vw - 100% - 40px))) translateY(clamp(5vh, var(--y), calc(100vh - 100% - 30px + var(--scroll-y)))); }`,
                `.${s}-context-menu > #msfy-menu-list { max-height: calc(100vh - 100px); overflow: auto; }`,
                `#msfy-menu-list.${$} { display: block; box-sizing: border-box; height: auto; min-height: 0; margin: 0; border-radius: ${k}; border: ${d}; padding: 8px 0px; font-family: Roboto, Arial, sans-serif; white-space: nowrap; box-shadow: ${o}; background-color: ${i}; color: ${r}; }`,
                `.${y} { display: block; box-sizing: border-box; height: auto; min-height: 0; margin: 0; padding: 0; flex: none; }`,
                `.${y} > div { box-sizing: border-box; height: 36px; max-height: 36px; margin: 0; line-height: 20px; flex: none; cursor: pointer; min-height: 36px; padding: 0 36px 0 16px; font-size: 14px; display: flex; align-items: center; }`,
                `.${y} > div:focus { background-color: ${a}; outline: 0; }`,
                `.${y} > div:hover { background-color: ${a}; }`,
                `.${y} > div:hover:focus { background-color: var(--${s}-spec-20-percent-layer); }`,
                `.${y} > div > yt-icon { pointer-events: none; flex: none; margin-right: 16px; color: var(--yt-spec-icon-inactive); }`,
                `.${y} > div > .${s}-menu-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`,
                `.${y} > .msfy-menu-pair { gap: 0; padding-right: 12px; cursor: default; font: 400 14px/20px Roboto, Arial, sans-serif; }`,
                `.msfy-menu-pair > .${s}-menu-label { flex: 1; margin-right: 8px; }`,
                `.msfy-menu-pair > button { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 32px; height: 32px; padding: 4px; border: 0; border-radius: 6px; background: transparent; color: inherit; font: inherit; cursor: pointer; }`,
                `.msfy-menu-pair > button:hover, .msfy-menu-pair > button:focus-visible { background: ${a}; outline: 1px solid currentColor; }`,
                `.msfy-menu-pair > button > yt-icon { width: 24px; height: 24px; pointer-events: none; }`,
                `.${y}[separator="top"]::before, .${y}[separator="bottom"]::after { content: ""; display: block; height: 1px; background-color: ${a}; margin: 8px 0; }`,
                `@keyframes ${wt.dt} { from { opacity: 1; } to { opacity: 0; transform: scale(2); } }`,
                `#${wt.dt} { background: ${_}; animation: ${wt.dt} 0.5s linear forwards; position: fixed; left: 50%; top: 50%; width: ${M}px; height: ${M}px; margin-left: -${C}px; margin-top: -${C}px; border-radius: ${C}px; z-index: 2030; pointer-events: none; display: none; }`,
                `#${wt.dt} #icon { width: 40px; height: 40px; margin: 6px; display: flex; align-items: center; justify-content: center; }`,
                `${x} { --paper-checkbox-size: 24px; --paper-checkbox-ink-size: 24px; --paper-checkbox-unchecked-color: transparent; --paper-checkbox-checked-color: var(--yt-spec-call-to-action, #3ea6ff); --paper-checkbox-checkmark-color: #fff; --paper-checkbox-checked-ink-color: transparent; border-radius: ${k}; width: 100%; height: 100%; display: flex; align-items: flex-start; justify-content: flex-start; }`,
                `${x} > #checkboxContainer { flex: none; box-sizing: border-box; width: 24px; height: 24px; margin: 8px 0 0 8px; }`,
                `${x} > #checkboxContainer > #checkbox { box-sizing: border-box; width: 24px; height: 24px; min-width: 24px; min-height: 24px; border-radius: 50%; border-width: 2px; border-color: #fff; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5); transition: none; }`,
                `${x} > #checkboxContainer > #checkbox > #checkmark { animation: checkmark-expand 40ms ease-out forwards; }`,
                `${x} > #checkboxLabel { display: none; }`,
                `${x}:not([checked]) > #checkboxContainer { display: none; }`,
                `${x}[checked] { background-color: rgba(62, 166, 255, 0.18); box-shadow: inset 0 0 0 3px var(--yt-spec-call-to-action, #3ea6ff); }`,
                `${x}:focus { outline: var(--yt-spec-text-primary, #fff) solid 2px; outline-offset: -2px }`,
                `${h} { border-radius: ${k}; position: absolute; width: 100%; height: 100%; top: 0; left: 0; z-index: 1; cursor: pointer; display: none; }`,
                `.${s}-playlist-index { position: absolute; z-index: 2; transform: translateX(-100%); min-width: 24px; height: 24px; box-sizing: border-box; padding: 2px 6px; border-radius: 6px; background: rgba(0,0,0,.8); color: #fff; font: 500 13px/20px Roboto, Arial, sans-serif; text-align: center; pointer-events: none; opacity: 0; visibility: hidden; }`,
                `[data-msfy-indexed]:hover > .${s}-playlist-index, [data-msfy-indexed]:focus-within > .${s}-playlist-index, [data-msfy-selecting] > .${s}-playlist-index { opacity: 1; visibility: visible; }`,
                `.${s}-index-description { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; pointer-events: none; }`,
                `ytd-grid-video-renderer[is-dismissed] > ${h}, ytd-video-renderer[is-hidden] > ${h}, ytd-video-renderer[is-dismissed] > ${h}, ytd-compact-video-renderer[is-dismissed] > ${h}, ytd-reel-item-renderer[is-dismissed] > ${h} { display: none; }`,
              ],
              V = n.sheet,
              D = V.cssRules.length;
            O.forEach((t, e) => V.insertRule(t, D + e));
          }
        },
        bt(t, e) {
          if (n) {
            const o = n.sheet,
              i = o.cssRules,
              r = e,
              a = [...i].findIndex((t) => t.cssText === r);
            t
              ? -1 === a && o.insertRule(r, i.length)
              : -1 !== a && o.deleteRule(a);
          }
        },
        get style() {
          return n;
        },
      };
    })(),
    Gt = (function () {
      let t;
      return {
        gt() {
          if (!t) {
            (t = e.createElement("iron-iconset-svg")),
              t.setAttribute("name", s),
              t.setAttribute("size", "24"),
              (t.style.display = "none");
            t.append(iconSet(s)),
              e.head.appendChild(t);
          }
        },
        xt() {
          t && (t.remove(), (t = null));
        },
      };
    })(),
    qt = (function () {
      let t;
      const n = (function () {
          let e;
          const originals = new WeakMap();
          const n = (t) => e.indexOf(t.playlistId),
            o = (t, e) =>
              (t.title?.simpleText || "").localeCompare(e.title?.simpleText),
            i = (t, e) => n(t) - n(e);
          return (n, r) => {
            if (!Array.isArray(n)) return;
            e = originals.get(n);
            n &&
              (t
                ? ((e ??= n.map((t) => t.playlistAddToOptionRenderer.playlistId)),
                  originals.set(n, e),
                  n.sort((t, e) =>
                    o(
                      t.playlistAddToOptionRenderer,
                      e.playlistAddToOptionRenderer
                    )
                  ),
                  r &&
                    [...r.children]
                      .sort((t, e) => o(t.data, e.data))
                      .forEach((t) => r.appendChild(t)))
                : e &&
                  (n.sort((t, e) =>
                    i(
                      t.playlistAddToOptionRenderer,
                      e.playlistAddToOptionRenderer
                    )
                  ),
                  r &&
                    [...r.children]
                      .sort((t, e) => i(t.data, e.data))
                      .forEach((t) => r.appendChild(t)),
                  originals.delete(n), (e = null)));
          };
        })(),
        o = (function () {
          let e;
          const originals = new WeakMap();
          const n = (t) => e.indexOf(t.entryData.guideEntryData.guideEntryId),
            o = (t, e) =>
              (t.formattedTitle?.simpleText || "").localeCompare(
                e.formattedTitle?.simpleText
              ),
            i = (t, e) => n(t) - n(e);
          return (n) => {
            const r = n.data?.expandableItems;
            if (r) {
              e = originals.get(r);
              const a = n.expandableItems;
              t
                ? ((e ??= r.map(
                    (t) =>
                      t.guideEntryRenderer.entryData.guideEntryData.guideEntryId
                  )), originals.set(r, e),
                  r.sort((t, e) =>
                    o(t.guideEntryRenderer, e.guideEntryRenderer)
                  ),
                  a &&
                    [...a.children]
                      .sort((t, e) => o(t.data, e.data))
                      .forEach((t) => a.appendChild(t)))
                : e &&
                  (r.sort((t, e) =>
                    i(t.guideEntryRenderer, e.guideEntryRenderer)
                  ),
                  a &&
                    [...a.children]
                      .sort((t, e) => i(t.data, e.data))
                      .forEach((t) => a.appendChild(t)),
                  originals.delete(r), (e = null));
            }
          };
        })();
      return {
        updateDialog: n,
        get enabled() {
          return t;
        },
        set enabled(i) {
          if (O) return;
          (t = i),
            ht(
              "ytd-guide-collapsible-entry-renderer",
              "ytd-app tp-yt-app-drawer"
            ).then(o);
          const r = e.querySelector(
            "ytd-add-to-playlist-renderer.ytd-popup-container"
          );
          r?.parentElement?.__data?.opened && n(r.data?.playlists, r.playlists);
        },
      };
    })(),
    Qt = (() => {
      const t = {
        showVideoIndex: `${b} ytd-playlist-video-renderer[can-reorder][is-editable]:hover #index.ytd-playlist-video-renderer, ${b} ytd-playlist-video-renderer[persistent-drag-handle] #index.ytd-playlist-video-renderer, ytd-app > ytd-playlist-video-renderer.dragging[can-reorder][is-editable]:hover #index.ytd-playlist-video-renderer { display: flex; }`,
      };
      return (e) => {
        for (const n in e) {
          const o = e[n],
            i = t[n];
          if (i) {
            "string" == typeof i ? Bt.bt(o, i) : i.forEach((t) => Bt.bt(o, t));
            if (n === 'showVideoIndex') z.showVideoIndex = Boolean(o), It.refresh();
          }
          else if (z.hasOwnProperty(n))
            switch (((z[n] = o), n)) {
              case "sortPlaylistNames":
                qt.enabled = o;
                break;
              case "positioning":
                kt.ut(), Zt.ut();
            }
        }
      };
    })(),
    Jt = (function () {
      const n = {
        "yt-open-popup-action": function (t) {
          const e = t.detail?.args?.[0]?.openPopupAction;
          if ("DIALOG" === e?.popupType) {
            const t = e.popup?.addToPlaylistRenderer?.playlists;
            t && qt.updateDialog(t);
          }
        },
      };
      const a = [
          {
            type: l,
            listener: function (t) {
              try {
                const { type: n, value: o } = JSON.parse(t.detail);
                switch (n) {
                  case "options-changed":
                    gt.et(),
                      Qt(o),
                      Xt.$t();
                    break;
                  case "command":
                    "toggleMultiSelectMode" === o
                      ? Et()
                      : "togglePlaylistGuide" === o &&
                        ((t) => {
                          const n = e.querySelector(
                            "ytd-guide-collapsible-entry-renderer.ytd-guide-collapsible-section-entry-renderer"
                          );
                          n &&
                            (n.hasAttribute("expanded")
                              ? n.onCollapserItemTapped(t)
                              : n.onExpanderItemTapped(t));
                        })({ preventDefault() {} });
                    break;
                  case "data":
                    (L = o), vt.tt(), It.refresh();
                    break;
                  case "destroy":
                    te(), (qt.enabled = !1);
                }
              } catch (t) {}
            },
            capture: !0,
          },
          {
            type: "yt-navigate-start",
            listener: function (t) {
              gt.et(), lt(), $t.H();
            },
          },
          {
            type: "yt-navigate-finish",
            listener: function (t) {
              lt(), $t.H(), kt.l(), xt.st(), It.refresh();
            },
          },
          {
            type: "yt-action",
            listener: function (t) {
              const e = t.detail?.actionName;
              e && n[e]?.(t);
            },
          },
          {
            type: "yt-popup-closed",
            listener: function (t) {
              M &&
                "YTD-ADD-TO-PLAYLIST-RENDERER" ===
                  t.detail?.popupRenderer?.nodeName &&
                (!z.preserveSelection && lt(), (M = !1), (C = null));
            },
          },
          {
            type: "yt-service-request-sent",
            listener: function (t) {
              M && (C = t.detail?.actions?.[0]?.action);
            },
          },
          {
            type: "yt-service-request-completed",
            listener: function (t) {
              if (M) {
                const n = t.detail?.data;
                if (n)
                  if (C === o) {
                    const t = n.playlistEditResults;
                    t && ((z.counts.copy += t.length), ct());
                  } else if (C === i) {
                    const t = n.actions;
                    if (t && "TOAST" === t?.[0]?.openPopupAction?.popupType) {
                      (z.counts.cut += t.length), ct();
                      const n = e.querySelectorAll(
                          "yt-notification-action-renderer"
                        ),
                        o = n[0]?.toastManager;
                      if (o) {
                        const t = o.currentToast;
                        t &&
                          ((o.queue = []),
                          setTimeout(
                            () => n.forEach((t) => t.remove()),
                            t.duration || 4e3
                          ));
                      }
                    }
                  }
              }
            },
          },
          {
            type: "yt-service-request-error",
            listener: function (t) {
              if (
                M &&
                "YTD-PLAYLIST-ADD-TO-OPTION-RENDERER" ===
                  t.detail?.params?.[0]?.nodeName
              ) {
                Kt(
                  "👎   " +
                    (t.detail.error?.args?.[1]?.message ||
                      "Maximum playlist size exceeded.")
                );
              }
            },
          },
        ],
        c = ({ type: n, listener: o, capture: i }) =>
          (i ? t : e).addEventListener(n, o, i),
        d = ({ type: n, listener: o, capture: i }) =>
          (i ? t : e).removeEventListener(n, o, i);
      return { wt: () => a.forEach(c), xt: () => a.forEach(d) };
    })(),
    Xt = (() => {
      let n, o, i;
      const c = s + "-callout",
        d = 320,
        l = 10,
        u = 12,
        f = (t) => {
          const e = t.querySelector(i.child),
            n = ((t, e) => {
              const n = t.getBoundingClientRect(),
                o = e.getBoundingClientRect(),
                i = o.top - n.top,
                r = o.left - n.left - d / 2 - l + o.width / 2;
              return { top: i, left: r };
            })(t, e);
          return `bottom: ${t.clientHeight + u - n.top}px; left: ${n.left}px;`;
        },
        h = "#" + kt.dt,
        m = [
          {
            parent: "#" + vt.dt,
            dir: "up",
            content: () =>
              L.messages.callout1,
            style: (t) => `top: ${t.clientHeight + u}px;`,
            callback: () => {
              const t = r
                ? "https://mzl.la/3Qwp5QQ"
                : (a ? "edge" : "chrome") + "://extensions/shortcuts";
              n.querySelector("#shortcuts").addEventListener("click", () =>
                at("url", t)
              );
            },
          },
          {
            parent: h,
            dir: "down",
            content: () => L.messages.callout2,
            style: (t) =>
              `bottom: ${t.clientHeight + u}px; left: ${
                t.clientWidth / 2 - d / 2 - l
              }px;`,
          },
          {
            parent: h,
            dir: "down",
            content: () => L.messages.callout3,
            style: f,
            child: `#${s}-close`,
          },
          {
            parent: h,
            dir: "down",
            content: () => L.messages.callout5,
            style: f,
            child: "#selection",
          },
          {
            parent: h,
            dir: "down",
            content: () => L.messages.callout6,
            style: f,
            child: "#select",
          },
          {
            parent: h,
            dir: "down",
            content: () => L.messages.callout7,
            style: f,
            child: "#unselect",
          },
          {
            parent: h,
            dir: "down",
            content: () => L.messages.callout8,
            style: f,
            child: "#menu",
          },
        ],
        b = () => {
          z.callout < m.length &&
            ((n.style.display = "none"), at("callout", z.callout + 1));
        };
      const p = () => {
        n.style.display = "none";
        at("callout", m.length);
      };
      function $(r) {
        if (O || !i || !r.isConnected) return;
        if ("none" !== t.getComputedStyle(r).display) {
          if (i.child) {
            const e = r.querySelector(i.child);
            if (!("none" !== t.getComputedStyle(e).display)) return void b();
          }
          z.callout,
            (function () {
              if (!n) {
                const t = "var(--yt-spec-menu-background, #212121)";
                [
                  `@keyframes ${c}-up { 0% { transform: translateY(0px); } 50% { transform: translateY(${u}px); } }`,
                  `@keyframes ${c}-down { 0% { transform: translateY(0px); } 50% { transform: translateY(-${u}px); } }`,
                  `#${c} { position: absolute; border-radius: 12px; width: min(${d}px, calc(100vw - 32px)); padding: 16px; box-sizing: border-box; background-color: var(--yt-spec-menu-background, #212121); border: 1px solid var(--yt-spec-10-percent-layer, rgba(255,255,255,.12)); box-shadow: 0 8px 32px rgba(0,0,0,.4); color: var(--yt-spec-text-primary, #f1f1f1); display: flex; justify-content: center; font-family: Roboto, Arial, sans-serif; font-size: 14px; line-height: 20px; z-index: 2030; user-select: none; }`,
                  `#${c}::after { position: absolute; border-width: ${u}px; border-color: transparent; border-style: solid; pointer-events: none; content: " "; }`,
                  `#${c}[dir=up]::after { top: -${
                    2 * u
                  }px; border-bottom-color: ${t}; animation: ${c}-up linear 1.2s infinite; }`,
                  `#${c}[dir=down]::after { bottom: -${
                    2 * u
                  }px; border-top-color: ${t}; animation: ${c}-down linear 1.2s infinite; }`,
                  `#${c} > div { width: 100%; }`,
                  `#${c} > div > #close { position: absolute; top: 10px; right: 10px; width: 28px; height: 28px; border: 0; border-radius: 50%; background: transparent; color: var(--yt-spec-text-primary, #f1f1f1); font-size: 22px; line-height: 22px; cursor: pointer; }`,
                  `#${c} > div > #close:hover { background: var(--yt-spec-10-percent-layer, rgba(255,255,255,.12)); }`,
                  `#${c} > div > #content { padding: 4px 34px 14px 0; }`,
                  `#${c} > div > #content > strong { display: block; margin-bottom: 4px; font-size: 15px; }`,
                  `#${c} > div > #content > p { margin: 0; }`,
                  `#${c} > div > #content > a { color: inherit; font-weight: 600; }`,
                  `#${c} > div > #actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; }`,
                  `#${c} > div > #actions > button { min-height: 32px; padding: 4px 12px; border: 1px solid var(--yt-spec-10-percent-layer, rgba(255,255,255,.2)); border-radius: 6px; background: transparent; color: var(--yt-spec-text-secondary, #aaa); cursor: pointer; font: inherit; }`,
                  `#${c} > div > #actions > button:hover { background: var(--yt-spec-10-percent-layer, rgba(255,255,255,.12)); color: var(--yt-spec-text-primary, #f1f1f1); }`,
                  `#${c} > div > #actions > #next { background: var(--yt-spec-call-to-action, #3ea6ff); color: #0f0f0f; border-color: transparent; font-weight: 500; }`,
                ].forEach((t) => Bt.bt(!0, t)),
                  (n = e.createElement("div")),
                  (n.id = c),
                  n.append(el('div', {}, el('yt-icon', { id: 'icon', icon: `${s}:${s}-info` }),
                    el('button', { id: 'close', type: 'button', 'aria-label': L.messages.close }, '×'),
                    el('div', { id: 'content' }),
                    el('div', { id: 'actions' }, el('button', { id: 'skip', type: 'button' }, L.messages.onboardingSkip),
                      el('button', { id: 'shortcuts', type: 'button' }, L.messages.onboardingShortcuts), el('button', { id: 'next', type: 'button' })))),
                  n
                    .querySelector("#close")
                    .addEventListener("click", (t) => (it(t), b())),
                  n
                    .querySelector("#skip")
                    .addEventListener("click", (t) => (it(t), p())),
                  n
                    .querySelector("#next")
                    .addEventListener("click", (t) => (it(t), b())),
                  (o = n.querySelector("#content"));
              }
            })(),
            o.replaceChildren(el('strong', {}, L.messages.onboardingTitle),
              el('p', {}, L.messages.onboardingStep.replace('$1', String(z.callout + 1)).replace('$2', String(m.length))),
              el('p', {}, i.content())),
            n.querySelector("#shortcuts").style.display = z.callout === 0 ? "" : "none",
            n.querySelector("#next").textContent =
              z.callout === m.length - 1
                ? L.messages.onboardingFinish
                : L.messages.onboardingNext,
            n.setAttribute("dir", i.dir),
            (n.style = i.style(r)),
            i.callback?.(),
            r.appendChild(n);
        }
      }
      return {
        $t() {
          (i = m[z.callout]), i && ht(i.parent).then($);
        },
        st() {
          n && (n.remove(), (n = null));
        },
      };
    })();
  function Wt(n, o, i) {
    if (n) {
      const r = n.querySelector("#drag-handle");
      if (r) {
        const a = z[o];
        let c, s, d, l;
        function p(e) {
          e.preventDefault();
          const o = Math.min(
              Math.max(n.offsetLeft + e.clientX - c, 0),
              t.innerWidth - d
            ),
            r = Math.min(
              Math.max(n.offsetTop + e.clientY - s, 1),
              t.innerHeight - l
            );
          (a.x = o),
            (a.y = r),
            i && i(),
            n.style.setProperty("--x", o + "px"),
            n.style.setProperty("--y", r + "px"),
            (c = e.clientX),
            (s = e.clientY);
        }
        function u(t) {
          t.preventDefault(),
            n.removeAttribute("dragging"),
            e.removeEventListener("mouseup", u, !0),
            e.removeEventListener("mousemove", p, !0),
            at(o, a);
        }
        function f(t) {
          t.preventDefault(),
            n.setAttribute("dragging", ""),
            (c = t.clientX),
            (s = t.clientY),
            e.addEventListener("mouseup", u, !0),
            e.addEventListener("mousemove", p, !0);
        }
        function h() {
          (d = n.clientWidth + 18),
            (l = n.clientHeight + 2),
            n.style.setProperty("--x", a.x + "px"),
            n.style.setProperty("--y", a.y + "px"),
            n.style.setProperty("--right-offset", d + "px"),
            n.style.setProperty("--bottom-offset", l + "px"),
            r.addEventListener("mousedown", f, !0);
        }
        function m() {
          r.removeEventListener("mousedown", f, !0),
            e.removeEventListener("mouseup", u, !0),
            e.removeEventListener("mousemove", p, !0),
            n.style.removeProperty("--x"),
            n.style.removeProperty("--y"),
            n.style.removeProperty("--right-offset"),
            n.style.removeProperty("--bottom-offset");
        }
        return h(), m;
      }
    }
  }
  const Zt = (() => {
    let panel, view, cleanup;
    function position() {
      cleanup?.();
      cleanup = null;
      if (pt(panel)) cleanup = Wt(panel, 'filterPosition');
    }
    function close() {
      if (!panel) return;
      cleanup?.();
      cleanup = null;
      gt.et();
      view.destroy();
      panel = null;
      view = null;
      kt.l();
      e.getElementById(kt.dt)?.querySelector('#menu')?.focus();
    }
    return {
      tt() {
        if (panel) return;
        view = createFilter({
          messages: L.messages, state: z.filter, checkboxes: P,
          data: (checkbox) => j(checkbox)?.data,
          onChange: () => kt.l(), onClose: close,
          onHelp: () => t.open('https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions/Cheatsheet', '_blank', 'noopener'),
          onError: () => Kt(L.messages.invalidFilter),
        });
        panel = view.root;
        e.body.append(panel);
        position();
        $t.j(view.input);
        kt.l();
      },
      st: close,
      U() { if (panel) panel.style.display = 'block'; },
      _t() { if (panel) panel.style.display = 'none'; },
      ut: position,
      get dt() { return 'msfy-select-filter'; },
      get lt() { return Boolean(panel); },
    };
  })();
  function Kt(t) {
    const container = e.querySelector("ytd-popup-container"),
      text = t.replace(/^[^\p{L}\p{N}]+/u, "").slice(0, 120);
    if (!container?.handleOpenPopupAction) {
      console.warn("[multi-select] Native YouTube toast unavailable:", text);
      return;
    }
    try {
      container.handleOpenPopupAction({
        openPopupAction: {
          popupType: "TOAST",
          popup: {
            notificationActionRenderer: {
              responseText: { simpleText: text },
            },
          },
        },
      });
    } catch (err) {
      console.warn("[multi-select] Native YouTube toast failed:", err);
    }
  }
  function te() {
    Et(!1),
      (O = !0),
      pendingObservers.forEach((observer) => observer.disconnect()),
      pendingObservers.clear(),
      e.querySelector("#" + T)?.remove(),
      Jt.xt(),
      Bt.xt(),
      Gt.xt(),
      It.st(),
      gt.et(),
      xt.st(),
      Ht.st(),
      vt.st(),
      kt.st(),
      wt.st(),
      Zt.st(),
      Xt.st();
  }
  Bt.gt(), Bt.vt(), Gt.gt(), It.tt(), Jt.wt();
})(window, document);
}
