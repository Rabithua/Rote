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
    // 优化构建配置，避免 chunk 过大警告
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // 手动分割代码块，优化加载性能
        // 注意：检查顺序很重要，先检查具体的库，再检查通用的
        manualChunks: (id) => {
          // 国际化库（先检查，避免被 react 匹配）
          if (id.includes('i18next') || id.includes('react-i18next')) {
            return 'i18n-vendor';
          }
          // 数据获取库
          if (id.includes('swr')) {
            return 'data-vendor';
          }
          // 工具库
          if (id.includes('lodash')) {
            return 'utils-vendor';
          }
          // 日期处理库（moment 较大，单独分割）
          if (id.includes('moment')) {
            return 'date-vendor';
          }
          // 动画库
          if (id.includes('motion') || id.includes('framer-motion')) {
            return 'animation-vendor';
          }
          // 图标库
          if (id.includes('lucide-react')) {
            return 'icons-vendor';
          }
          // 拖拽库
          if (id.includes('@dnd-kit')) {
            return 'dnd-vendor';
          }
          // Radix UI 组件库
          if (id.includes('@radix-ui')) {
            return 'ui-vendor';
          }
          // React 核心库（放在后面，避免匹配到其他 react-* 包）
          // 匹配 react、react-dom 和 react-router 系列
          if (
            (id.includes('node_modules/react/') && !id.includes('react-')) ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router')
          ) {
            return 'react-vendor';
          }
          // node_modules 中的其他依赖
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
  preview: {
    host: true,
    port: 3001,
    allowedHosts: true,
  },
});
