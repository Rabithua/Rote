import '@/styles/index.css';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import AppWrapper from './App';
import './utils/i18n';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(<AppWrapper />);

// 使用 vite-plugin-pwa 的注册器，自动处理 sw 更新（开发/生产均启用）
registerSW({
  immediate: true,
  onNeedRefresh() {
    const shouldReload = confirm('发现新版本，是否立即更新？');
    if (shouldReload) location.reload();
  },
  onOfflineReady() {
    // 可选：提示“离线可用”
  },
});

// 接收 SW 广播的 pushsubscriptionchange 结果
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if ((event as any).data?.method === 'pushsubscriptionchange') {
      // 这里可以调用后端 API 同步新的订阅信息
      // fetch('/api/v2/notice/subscription', { method: 'POST', body: (event as any).data.payload })
    }
  });
}
