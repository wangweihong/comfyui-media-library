import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
  root: 'frontend', base: './',
  build: {outDir: '../web/dist', emptyOutDir: true, rollupOptions: {input: resolve(import.meta.dirname, 'frontend/gallery.html')}},
});
