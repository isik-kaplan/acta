import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

import { version } from './package.json'

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    react(),
    VitePWA({
      // injectManifest, not the generated worker: a generated one can't listen for `push` or
      // `notificationclick`, and reminders are the reason this is a PWA at all. src/sw.ts is the
      // worker; workbox only injects the precache list into it.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'acta',
        short_name: 'acta',
        description: 'A small kanban board for the things you mean to do.',
        // The manifest can't use CSS custom properties, so this is a plain hex copy of the dark
        // --color-paper token - what an installed app shows at launch before useTheme runs.
        theme_color: '#0d121b',
        background_color: '#0d121b',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: {
        // Lets `npm run dev` register the worker too, so notifications can be tried without a build.
        enabled: true,
        type: 'module',
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  // `vite preview` doesn't inherit server.proxy - without its own copy every /api call 404s
  // against the static file server.
  preview: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  build: {
    outDir: 'dist',
  },
})
