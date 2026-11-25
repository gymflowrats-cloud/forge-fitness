/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves from /<repo-name>/. Set BASE_PATH in CI (see .github/workflows/deploy.yml).
// Vercel / Cloudflare Pages / local use "/".
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Forge — Gym, Body & Nutrition',
        short_name: 'Forge',
        description: 'Personal gym, body and nutrition tracker',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#36493B',
        background_color: '#F5F4F0',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2,webmanifest}'],
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Meal-reminder push + notification-tap handling (public/push-sw.js).
        importScripts: ['push-sw.js'],
      },
    }),
  ],
  server: { host: false },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'push-worker/**/*.test.js'],
  },
});
