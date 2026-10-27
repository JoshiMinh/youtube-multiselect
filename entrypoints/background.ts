import { browser } from 'wxt/browser';

// Port of the original service worker.
export default defineBackground(() => {
  const sendCommand = (tabId: number, command: string) => browser.tabs.sendMessage(tabId, { type: 'command', value: command });

  void browser.action.disable();

  // A content script connects once YouTube is ready; that enables the toolbar button for its tab.
  browser.runtime.onConnect.addListener((port) => {
    const tabId = port.sender?.tab?.id;
    if (tabId !== undefined) void browser.action.enable(tabId);
  });

  browser.runtime.onMessage.addListener((message) => {
    if (message?.type === 'url') void browser.tabs.create({ url: message.value, active: true });
  });

  browser.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
      await browser.storage.local.set({ installed: Date.now() });
      void browser.runtime.openOptionsPage();
    } else if (details.reason === 'update') {
      const previous = details.previousVersion ?? '';
      if (previous < '3.0') {
        await browser.storage.local.remove([
          'hideOnHome',
          'hideOnTrending',
          'hideOnSubscriptions',
          'hideOnLibrary',
          'hideOnHistory',
          'hideOnChannel',
          'hideOnPlaylist',
          'hideOnWatch',
          'hideOnResults',
          'transparentBackgroundColor',
          'showOnHover',
        ]);
      } else if (previous < '3.4') {
        await browser.storage.local.remove('blockAds');
        const { actionBarLeft } = await browser.storage.local.get('actionBarLeft');
        if (actionBarLeft) {
          await browser.storage.local.set({ positioning: 'left' });
          await browser.storage.local.remove('actionBarLeft');
        }
      }
      void browser.runtime.openOptionsPage();
    }
  });

  browser.commands.onCommand.addListener(async (command, tab) => {
    try {
      if (tab) {
        if (tab.id !== undefined && tab.id >= 0) await sendCommand(tab.id, command);
      } else {
        const [active] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
        if (active?.id !== undefined) await sendCommand(active.id, command);
      }
    } catch {
      // The tab has no content script (not YouTube); ignore.
    }
  });
});
