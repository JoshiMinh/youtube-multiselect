import { browser } from 'wxt/browser';
import { allowedExtensionUrl, validPagePreference } from '../../src/bridge';
import './style.css';

const PREFIX = 'msfy';
const TO_PAGE = `${PREFIX}-outer-message`;
const FROM_PAGE = `${PREFIX}-inner-message`;

const DEFAULTS: Record<string, unknown> = {
  showVideoIndex: false,
  preserveSelection: false,
  sortPlaylistNames: false,
  noRemovalConfirmation: false,
  findDuplicatesBackwards: false,
  positioning: 'center',
  callout: 0,
  barPosition: { x: 0, y: window.innerHeight - 72 },
  filterPosition: { x: 0, y: 1 },
};

const PAGE_PERSISTED = new Set(['callout', 'counts', 'barPosition', 'filterPosition']);

const MESSAGE_KEYS = [
  'addToPlaylist', 'addToQueue', 'addToWatchLater', 'addVideosFromFile',
  'callout1', 'callout2', 'callout3', 'callout5', 'callout6', 'callout7', 'callout8',
  'onboardingTitle', 'onboardingStep', 'onboardingNext', 'onboardingSkip',
  'onboardingFinish', 'onboardingShortcuts',
  'cancel', 'save', 'caseSensitive', 'channelName', 'chooseOutputFormat', 'clickToClose', 'close',
  'confirmRemoveContent', 'copy', 'cut', 'deselectAllVideos','downloadSelection',
  'extensionName', 'filterHelpTooltip', 'invalidData', 'invalidFilter', 'keys', 'playlistPosition',
  'filterApply', 'filterHelp', 'filterPattern', 'filterResult', 'filterSource', 'filterLoading',
  'reverseFilter', 'menuDuration', 'menuDate', 'menuFiles', 'menuMoveStep', 'menuMoveEnds',
  'loadEntirePlaylist', 'loadingEntirePlaylist', 'localeDir', 'moveAfter', 'moveToBottom',
  'moveToTop', 'moveUp', 'moveDown', 'groupByChannel', 'flipList', 'noDuplicatesFound', 'paste', 'reloadRequired', 'remove', 'removeVideos',
  'selectAllVideos', 'selectDuplicates', 'sortDurationAsc', 'sortDurationDesc', 'sortDateAsc', 'sortDateDesc', 'sortMissingData', 'selectWithFilter', 'likeVideos', 'selected', 'title', 'watched',
];

// Port of the original content script (document_end, YouTube and YouTube Music).
export default defineContentScript({
  matches: ['https://www.youtube.com/*', 'https://music.youtube.com/*'],
  excludeMatches: [
    'https://www.youtube.com/error?*',
    'https://www.youtube.com/howyoutubeworks/*',
    'https://www.youtube.com/intl/*',
    'https://www.youtube.com/kids/*',
    'https://www.youtube.com/live_chat?*',
    'https://www.youtube.com/pop-up-player/*',
  ],
  runAt: 'document_end',
  main(ctx) {
    if (document.title === '404 Not Found') return;
    if (!document.querySelector('ytd-app, ytmusic-app')) return;

    const send = (type: string, value?: unknown) =>
      window.dispatchEvent(new CustomEvent(TO_PAGE, { detail: JSON.stringify({ type, value }) }));

    const onPageMessage = (event: Event) => {
      try {
        const message = JSON.parse((event as CustomEvent<string>).detail);
        if (validPagePreference(message.type, message.value)) void browser.storage.local.set({ [message.type]: message.value }).catch(() => {});
        else if (message.type === 'url' && allowedExtensionUrl(message.value)) void browser.runtime.sendMessage(message).catch(() => {});
      } catch {
        // Malformed message from the page; ignore.
      }
    };

    const onRuntimeMessage = (message: { type?: string; value?: unknown }) => {
      if (message.type === 'command') send('command', message.value);
    };

    const pushOptions = (options: Record<string, unknown>) => {
      if (Object.keys(options).length) send('options-changed', options);
      return options;
    };

    const onStorageChanged = (changes: Record<string, { newValue?: unknown }>, areaName: string) => {
      if (areaName !== 'local') return;
      const options: Record<string, unknown> = {};
      for (const key of Object.keys(changes)) {
        if (key === 'counts' || !(key in DEFAULTS || PAGE_PERSISTED.has(key))) continue;
        options[key] = 'newValue' in changes[key]! ? changes[key]!.newValue : DEFAULTS[key];
      }
      pushOptions(options);
    };

    const destroy = () => {
      window.removeEventListener(FROM_PAGE, onPageMessage, true);
      browser.runtime.onMessage.removeListener(onRuntimeMessage);
      browser.storage.onChanged.removeListener(onStorageChanged);
      send('destroy');
    };
    ctx.onInvalidated(destroy);

    // Connecting tells the background worker to enable the toolbar button for this tab.
    // The page script survives worker reconnects; only content-script replacement tears it down.
    const connect = () => {
      if (ctx.isInvalid) return;
      const port = browser.runtime.connect();
      let removeInvalidationListener = () => {};
      const onDisconnect = () => {
        port.onDisconnect.removeListener(onDisconnect);
        removeInvalidationListener();
        ctx.setTimeout(connect, 100);
      };
      port.onDisconnect.addListener(onDisconnect);
      removeInvalidationListener = ctx.onInvalidated(() => {
        port.onDisconnect.removeListener(onDisconnect);
        port.disconnect();
      });
    };
    connect();

    window.addEventListener(FROM_PAGE, onPageMessage, true);
    browser.runtime.onMessage.addListener(onRuntimeMessage);
    browser.storage.onChanged.addListener(onStorageChanged as never);

    const sendMessages = () => {
      const messages: Record<string, string> = {};
      for (const key of MESSAGE_KEYS) messages[key] = browser.i18n.getMessage(key as never);
      send('data', { messages });
    };
    const syncTheme = async (options: Record<string, unknown>) => {
      const dark = document.documentElement.hasAttribute('dark');
      if (dark !== Boolean(options.dark)) await browser.storage.local.set({ dark });
    };

    const injectPageScript = () => {
      // Replace our own runtime on reinjection; YouTube's Cast marker is unrelated.
      send('destroy');
      const script = document.createElement('script');
      script.src = browser.runtime.getURL('/polymer.js' as never);
      script.onload = () => {
        script.remove();
        if (ctx.isInvalid) return;
        // Retired restrictions must not survive an update or reinjection.
        void browser.storage.local.remove(['blacklisted', 'handle']).catch(() => {}).then(() => browser.storage.local.get()).then((options) => {
          if (ctx.isInvalid) return;
          delete options.blacklisted;
          delete options.handle;
          pushOptions({ ...DEFAULTS, ...options });
          return syncTheme(options);
        }).catch(() => {});
        sendMessages();
      };
      ctx.onInvalidated(() => script.remove());
      document.documentElement.appendChild(script);
    };
    const theme = new MutationObserver(() => {
      if (!ctx.isInvalid) void browser.storage.local.set({ dark: document.documentElement.hasAttribute('dark') }).catch(() => {});
    });
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['dark'] });
    ctx.onInvalidated(() => theme.disconnect());
    injectPageScript();
  },
});
