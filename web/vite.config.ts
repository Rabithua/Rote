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
    // 只暴露必要的环境变量，避免安全风险
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // 确保所有 React 相关的库（包括依赖 React 的库）都在同一个 chunk
          // 这样可以避免加载顺序问题
          if (
            id.includes('node_modules') &&
            (id.includes('react') ||
              id.includes('react-dom') ||
              id.includes('react-router') ||
              id.includes('@radix-ui') ||
              id.includes('react-photo-view') ||
              id.includes('react-easy-crop') ||
              id.includes('react-i18next') ||
              id.includes('@dnd-kit') ||
              id.includes('swr') ||
              id.includes('jotai') ||
              id.includes('sonner') ||
              id.includes('linkify-react') ||
              id.includes('motion') ||
              id.includes('framer-motion'))
          ) {
            return 'react-vendor';
          }
          // 纯工具库（不依赖 React）
          if (
            id.includes('node_modules') &&
            (id.includes('lodash') ||
              id.includes('moment') ||
              id.includes('axios') ||
              id.includes('jwt-decode') ||
              id.includes('linkifyjs') ||
              id.includes('browser-image-compression'))
          ) {
            return 'utils-vendor';
          }
          // 国际化核心库（不依赖 React 的部分）
          if (
            id.includes('node_modules') &&
            id.includes('i18next') &&
            !id.includes('react-i18next')
          ) {
            return 'i18n-vendor';
          }
          // D3 相关（如果使用）
          if (id.includes('node_modules') && id.includes('d3')) {
            return 'd3-vendor';
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000, // 提高警告阈值到 1000KB，因为我们已经做了代码分割
  },
  preview: {
    host: true,
    port: 3001,
    allowedHosts: true,
  },
});
