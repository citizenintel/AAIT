import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/AAIT/' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Basemap tiles, style JSON, glyphs and sprites.
            //
            // This was previously /^https:\/\/tiles\./ with CacheFirst, which
            // matched ONLY tiles.basemaps.cartocdn.com — the host serving the
            // vector tiles.json, glyphs and sprite for the Standard and Light
            // basemaps. Terrain (a.tile.opentopomap.org) and Satellite (ESRI)
            // did not match, so they kept working while Standard and Light
            // stayed blank. Under CacheFirst a single bad or partial response
            // is served from the service worker cache forever, surviving
            // reloads, rebuilds and redeploys.
            //
            // StaleWhileRevalidate still serves instantly from cache but always
            // refreshes in the background, so a bad entry self-heals. The
            // status filter means error responses are never cached at all.
            urlPattern: ({ url }: { url: URL }) =>
              /(^|\.)basemaps\.cartocdn\.com$/.test(url.hostname)
              || /(^|\.)tile\.opentopomap\.org$/.test(url.hostname)
              || /(^|\.)tiles\.openfreemap\.org$/.test(url.hostname)
              || /(^|\.)arcgisonline\.com$/.test(url.hostname),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
      manifest: {
        name: 'AAIT Incident Tracker',
        short_name: 'AAIT',
        theme_color: '#111113',
        background_color: '#111113',
        display: 'standalone',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'es2022',
  },
  esbuild: {
    target: 'es2022',
  },
  optimizeDeps: {
    exclude: ['@duckdb/duckdb-wasm', 'maplibre-gl'],
  },
  worker: {
    format: 'es',
  },
  server: {
    port: 5173,
    open: true,
  },
});
