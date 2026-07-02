import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Auto-updates the SW on every deploy and prompts the user to reload.
      registerType: 'prompt',
      // Inject the manifest <link> into index.html automatically.
      injectRegister: 'auto',
      // Don't precache the dev server — only enable in build/preview.
      devOptions: { enabled: false },

      includeAssets: ['favicon.svg', 'icons.svg', 'apple-touch-icon.png'],

      manifest: {
        name: 'EduVerse — School Management',
        short_name: 'EduVerse',
        description:
          'Daily diary, attendance, fees, exam results and parent messaging — one place for the whole school.',
        theme_color: '#6366f1',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'en',
        categories: ['education', 'productivity'],
        icons: [
          // SVG works on all modern browsers and scales perfectly.
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          // PNG fallbacks for Android Play Store wrapper / iOS home screen.
          // Generate from favicon.svg with `npx pwa-asset-generator` (see README).
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        // Optional: app shortcuts shown when long-pressing the home-screen icon.
        shortcuts: [
          {
            name: 'Daily Diary',
            short_name: 'Diary',
            description: 'Open today\'s diary entries',
            url: '/student/diary',
            icons: [{ src: '/favicon.svg', sizes: 'any' }],
          },
          {
            name: 'Timetable',
            short_name: 'Timetable',
            description: 'View today\'s timetable',
            url: '/student/timetable',
            icons: [{ src: '/favicon.svg', sizes: 'any' }],
          },
        ],
      },

      workbox: {
        // Precache the built shell so the login screen loads instantly offline.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Don't precache source maps or huge assets.
        globIgnores: ['**/node_modules/**', 'sw.js', 'workbox-*.js'],
        // SPA fallback — any unknown route serves index.html (works offline too).
        navigateFallback: '/index.html',
        // Don't fall back for API calls or the docs page.
        navigateFallbackDenylist: [/^\/api\//, /^\/docs/, /^\/redoc/],
        // Runtime caching strategies.
        runtimeCaching: [
          // Google Fonts CSS — stale-while-revalidate so updates roll out quickly.
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          // Google Fonts files — cache-first, they're immutable.
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // School API — network-first with a short timeout so the app stays fresh
          // when online but still works if a flaky network drops a request.
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        // Increase the max precache file size for the JS bundle.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  server: {
    port: 5173,
    open: true,
  },
});
