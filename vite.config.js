import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Orchard Track',
        short_name: 'OrchardTrack',
        description: 'Fleet tracking and orchard management for avocado picking crews',
        theme_color: '#2d6a2d',
        background_color: '#2d6a2d',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable any' },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /\/api\/gps\/latest/,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-positions', networkTimeoutSeconds: 5 },
          },
          {
            urlPattern: /\/api\/growers/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'api-growers' },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
