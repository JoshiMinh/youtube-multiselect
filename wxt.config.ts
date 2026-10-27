import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: ({ browser }) => ({
    name: '__MSG_extensionName__',
    description: '__MSG_extensionDescription__',
    default_locale: 'en',
    author: 'Joshi Minh',
    permissions: ['storage'],
    icons: { 24: 'icons/24.png', 48: 'icons/48.png', 96: 'icons/96.png', 128: 'icons/128.png' },
    action: { default_icon: { 24: 'icons/24.png', 48: 'icons/48.png' } },
    commands: {
      toggleMultiSelectMode: {
        description: '__MSG_toggleMultiSelectMode__',
        suggested_key: { default: 'Ctrl+Q' },
      },
      togglePlaylistGuide: {
        description: 'Playlist-Guide umschalten',
        suggested_key: { default: 'Ctrl+I' },
      },
    },
    web_accessible_resources: [{ resources: ['js/polymer.js'], matches: ['https://www.youtube.com/*'] }],
    ...(browser === 'firefox' && {
      browser_specific_settings: { gecko: { id: 'youtube-multiselect@local' } },
    }),
  }),
});
