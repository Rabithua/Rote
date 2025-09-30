import '@/styles/index.css';
import ReactDOM from 'react-dom/client';
import AppWrapper from './App';
import './utils/i18n';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(<AppWrapper />);

// 注册 Service Worker 并处理自动更新提示
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // 监听更新
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              // 有新版本，提示用户刷新
              if (navigator.serviceWorker.controller) {
                const shouldReload = confirm('发现新版本，是否立即更新？');
                if (shouldReload) {
                  newWorker.postMessage({ method: 'SKIP_WAITING' });
                  window.location.reload();
                }
              }
            }
          });
        });

        // 接收 SW 广播的 pushsubscriptionchange 结果
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data?.method === 'pushsubscriptionchange') {
            // 这里可以调用后端 API 同步新的订阅信息
            // fetch('/api/v2/notice/subscription', { method: 'POST', body: event.data.payload })
          }
        });
      })
      .catch(() => {
        // 忽略注册错误
      });
  });
}
