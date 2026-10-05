import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'notification-click.js'],
      workbox: {
        // Cache the app shell so it still loads with no network at all.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Opens/focuses the app when a reminder notification is clicked.
        importScripts: ['notification-click.js'],
        navigateFallbackDenylist: [/^\/api/]
      },
      manifest: {
        name: 'What To Do',
        short_name: 'What To Do',
        description: 'Todos, meetings and notes that sync everywhere',
        theme_color: '#1A6F58',
        background_color: '#07130F',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          }
        ]
      }
    })
  ],
})
