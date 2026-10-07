import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// Rarely used document libraries: kept in their own chunks, loaded on demand, and cached the
// first time they are used instead of being downloaded with every install.
const ON_DEMAND_CHUNKS = ['docx', 'mammoth', 'jspdf']

// https://vite.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/node_modules[\\/](docx)[\\/]/.test(id)) return 'docx'
          if (/node_modules[\\/](mammoth|jszip|lop|bluebird|underscore|xmlbuilder|argparse|dingbat-to-unicode|@xmldom)[\\/]/.test(id)) return 'mammoth'
          if (/node_modules[\\/](jspdf|jspdf-autotable|html2canvas|canvg|dompurify|fflate|fast-png|iobuffer|core-js|pako|svg-pathdata|stackblur-canvas|rgbcolor|performance-now|raf|regenerator-runtime)[\\/]/.test(id)) return 'jspdf'
          if (/node_modules[\\/](apexcharts|vue3-apexcharts|@svgdotjs)[\\/]/.test(id)) return 'apexcharts'
          return undefined
        }
      }
    }
  },
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'notification-click.js'],
      workbox: {
        // Cache the app shell so it still loads with no network at all.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        globIgnores: [`**/assets/{${ON_DEMAND_CHUNKS.join(',')}}-*.js`],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => new RegExp(`/assets/(${ON_DEMAND_CHUNKS.join('|')})-[^/]+\\.js$`).test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'document-libs',
              expiration: { maxEntries: 6, maxAgeSeconds: 60 * 60 * 24 * 90 }
            }
          }
        ],
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
