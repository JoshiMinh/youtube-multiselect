import { cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { defineConfig } from 'wxt';

export default defineConfig({
  publicDir: 'assets',
  suppressWarnings: {
    firefoxDataCollection: true,
  },
  hooks: {
    'build:before': async () => {
      await Promise.all([
        cp(path.resolve('src/polymer.js'), path.resolve('assets/polymer.js')),
        cp(path.resolve('src/_locales'), path.resolve('assets/_locales'), { recursive: true }),
      ]);
    },
    'build:done': async () => {
      await Promise.all([
        rm(path.resolve('assets/polymer.js'), { force: true }),
        rm(path.resolve('assets/_locales'), { recursive: true, force: true }),
      ]);
    },
  },
  manifest: ({ browser }) => ({
    name: '__MSG_extensionName__',
    description: '__MSG_extensionDescription__',
    default_locale: 'en',
    author: 'Joshi Minh',
    permissions: ['storage'],
    icons: { 24: 'icon_24.png', 48: 'icon_48.png', 96: 'icon_96.png', 128: 'icon_128.png' },
    action: { default_icon: { 24: 'icon_24.png', 48: 'icon_48.png' } },
    commands: {
      toggleMultiSelectMode: {
        description: '__MSG_toggleMultiSelectMode__',
        suggested_key: { default: 'Ctrl+Q' },
      },
      togglePlaylistGuide: {
        description: '__MSG_togglePlaylistGuide__',
        suggested_key: { default: 'Ctrl+I' },
      },
    },
    web_accessible_resources: [{
      resources: ['polymer.js'],
      matches: ['https://www.youtube.com/*', 'https://music.youtube.com/*'],
    }],
    ...(browser === 'firefox' && {
      browser_specific_settings: { gecko: { id: 'youtube-multiselect@local' } },
      data_collection_permissions: { required: ['none'] },
    }),
  }),
});
