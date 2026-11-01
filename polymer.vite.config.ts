import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve('src/polymer/entry.js'),
      formats: ['iife'],
      name: 'YoutubeMultiselectPage',
      fileName: () => 'polymer.js',
    },
    emptyOutDir: false,
    minify: false,
    outDir: path.resolve('assets'),
  },
});
