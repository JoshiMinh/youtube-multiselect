import { browser } from 'wxt/browser';
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
};

const PAGE_PERSISTED = new Set(['blacklisted', 'callout', 'counts', 'handle', 'barPosition', 'filterPosition']);

const MESSAGE_KEYS = [
  'addToPlaylist', 'addToQueue', 'addToWatchLater', 'addVideosFromFile',
  'callout1', 'callout2', 'callout3', 'callout5', 'callout6', 'callout7', 'callout8',
  'cancel', 'caseSensitive', 'channelName', 'chooseOutputFormat', 'clickToClose', 'close',
  'confirmRemoveContent', 'copy', 'cut', 'deselectAllVideos','downloadSelection',
  'extensionName', 'filterHelpTooltip', 'invalidData', 'invalidFilter', 'keys',
  'loadEntirePlaylist', 'loadingEntirePlaylist', 'localeDir', 'moveAfter', 'moveToBottom',
  'moveToTop', 'noDuplicatesFound', 'paste', 'reloadRequired', 'remove', 'removeVideos',
  'selectAllVideos', 'selectDuplicates', 'selectWithFilter', 'selected', 'title', 'watched',
];

// Port of the original content script (document_end, youtube.com).
export default defineContentScript({
  matches: ['https://www.youtube.com/*'],
  excludeMatches: [
    'https://www.youtube.com/error?*',
    'https://www.youtube.com/howyoutubeworks/*',
    'https://www.youtube.com/intl/*',
    'https://www.youtube.com/kids/*',
    'https://www.youtube.com/live_chat?*',
    'https://www.youtube.com/pop-up-player/*',
  ],
  runAt: 'document_end',
  main() {
    if (document.title === '404 Not Found') return;
    if (!document.querySelector('ytd-app')) return;
    const isFirefox = navigator.userAgent.includes('Firefox');

    const send = (type: string, value?: unknown) =>
      window.dispatchEvent(new CustomEvent(TO_PAGE, { detail: JSON.stringify({ type, value }) }));

    const onPageMessage = (event: Event) => {
      try {
        const message = JSON.parse((event as CustomEvent<string>).detail);
        if (PAGE_PERSISTED.has(message.type)) void browser.storage.local.set({ [message.type]: message.value });
        else if (message.type === 'url') void browser.runtime.sendMessage(message);
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

    const onStorageChanged = (changes: Record<string, { newValue?: unknown }>) => {
      const options: Record<string, unknown> = {};
      for (const key of Object.keys(changes)) {
        if (key === 'dark' || key === 'counts') continue;
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

    // Firefox re-runs the script on updates, so clear the previous instance first.
    if (isFirefox) destroy();

    // Connecting tells the background worker to enable the toolbar button for this tab.
    const connect = () => {
      const port = browser.runtime.connect();
      if (!isFirefox) {
        const onDisconnect = () => {
          port.onDisconnect.removeListener(onDisconnect);
          setTimeout(() => (browser.runtime.id ? connect() : destroy()), 100);
        };
        port.onDisconnect.addListener(onDisconnect);
      }
    };
    connect();

    window.addEventListener(FROM_PAGE, onPageMessage, true);
    browser.runtime.onMessage.addListener(onRuntimeMessage);
    browser.storage.onChanged.addListener(onStorageChanged as never);

    if (document.querySelector('html[data-cast-api-enabled]')) return;

    const sendMessages = () => {
      const messages: Record<string, string> = {};
      for (const key of MESSAGE_KEYS) messages[key] = browser.i18n.getMessage(key as never);
      send('data', { messages });
    };
    const syncTheme = async (options: Record<string, unknown>) => {
      const dark = document.documentElement.hasAttribute('dark');
      if (dark !== Boolean(options.dark)) await browser.storage.local.set({ dark });
    };

    const script = document.createElement('script');
    script.src = browser.runtime.getURL('/js/polymer.js' as never);
    script.onload = () => {
      script.remove();
      void browser.storage.local.get().then(pushOptions).then(syncTheme);
      sendMessages();
    };
    document.documentElement.appendChild(script);
  },
});
