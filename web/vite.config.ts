import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import dotenv from 'dotenv';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
dotenv.config();
// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      devOptions: { enabled: true, type: 'module' },
      includeAssets: [
        'ico.ico',
        'ico.svg',
        'logo.png',
        'icon-180.png',
        'icon-192.png',
        'icon-512.png',
      ],
      manifest: false,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    'process.env': process.env, // 注入 process.env
  },
  preview: {
    host: true,
    port: 3001,
    allowedHosts: true,
  },
});
