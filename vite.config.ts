import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Build 100% local: nenhum endpoint externo, nenhuma telemetria.
export default defineConfig({
  base: '/equivale/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: [
        'brand/favicon.svg',
        'brand/logo-completo.svg',
        'icons/favicon-32.png',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/maskable-512.png',
      ],
      manifest: {
        id: '/equivale/',
        name: 'Equivale — troque, mova, escolha',
        short_name: 'Equivale',
        description:
          'Organize e adapte uma dieta já prescrita: troque alimentos por equivalentes calóricos e mova blocos entre refeições. Tudo local, no seu aparelho.',
        lang: 'pt-BR',
        dir: 'ltr',
        start_url: '/equivale/',
        scope: '/equivale/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f5f3ee',
        theme_color: '#3e5368',
        categories: ['health', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          {
            name: 'Abrir Equivale',
            short_name: 'Início',
            url: '/equivale/',
            icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,json,webmanifest}'],
        navigateFallback: '/equivale/index.html',
        cleanupOutdatedCaches: true,
        // Sem runtimeCaching de rede: o app não faz requisições externas.
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});
