import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/** 本番ビルドの index.html に注入。Google 連携・PWA（Service Worker）・Vite の bundle に合わせた最小許可 */
const PROD_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://sheets.googleapis.com https://oauth2.googleapis.com https://www.googleapis.com https://accounts.google.com",
  "frame-src https://accounts.google.com",
  "worker-src 'self'",
].join('; ')

// https://vite.dev/config/
// 開発: `npm run dev` は http://localhost:5173/ で動かす（base は '/'）
// 本番: GitHub Pages のプロジェクトサイト配下 `/work-manager/` で配信
// PWA は dev では無効化（Service Worker のキャッシュが古い index.html を返すと
// /src/main.tsx の 404 などを引き起こすため）。動作確認は `npm run build && npm run preview` で。
export default defineConfig(({ mode, command }) => {
  const isBuild = command === 'build'
  const base = isBuild ? '/work-manager/' : '/'

  return {
  base,
  server: {
    port: 5173,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        id: base,
        name: '仕事記録',
        short_name: '仕事記録',
        description: '勤務・作業の日時を記録するアプリ',
        theme_color: '#181c27',
        background_color: '#0f1117',
        display: 'standalone',
        display_override: ['standalone', 'browser'],
        orientation: 'any',
        start_url: base,
        scope: base,
        lang: 'ja',
        dir: 'ltr',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,png,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
      devOptions: {
        enabled: false,
        navigateFallback: 'index.html',
        suppressWarnings: true,
      },
    }),
    ...(mode === 'production'
      ? [
          {
            name: 'inject-csp-meta',
            transformIndexHtml(html: string) {
              return html.replace(
                '<head>',
                `<head>\n    <meta http-equiv="Content-Security-Policy" content="${PROD_CSP}" />\n`
              )
            },
          },
        ]
      : []),
  ],
  }
})
