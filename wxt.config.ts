import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: ({ browser }) => ({
    name: 'YouTube Multiselect',
    description: 'Select and export YouTube playlist entries in bulk. Read-only prototype.',
    permissions: ['storage'],
    // Same scope as the content script (no extra install warning); lets the
    // popup see whether the active tab is YouTube to explain missing status.
    host_permissions: ['https://www.youtube.com/*'],
    web_accessible_resources: [
      {
        resources: ['youtube-bridge.js'],
        matches: ['https://www.youtube.com/*'],
      },
    ],
    ...(browser === 'firefox' && {
      browser_specific_settings: { gecko: { id: 'youtube-multiselect@local' } },
    }),
  }),
});
