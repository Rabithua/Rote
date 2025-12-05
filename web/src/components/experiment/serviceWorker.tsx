import { Divider } from '@/components/ui/divider';
import { Switch } from '@/components/ui/switch';
import { API_POINT, del, post } from '@/utils/api';
import { checkPermission, registerSW, requestNotificationPermission } from '@/utils/main';
import { Bell, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { SoftBottom } from '../others/SoftBottom';
import { Button } from '../ui/button';
import SubList, { noticeTest } from './SubList';

export default function ServiceWorker() {
  const { t } = useTranslation('translation', {
    keyPrefix: 'pages.experiment.serviceWorker',
  });
  const [swReady, setSwReady] = useState(false);
  const [, setSwLoading] = useState(true);
  const [noticeId, setNoticeId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // 使用 useRef 保存事件监听器函数的引用，以便正确移除
  const messageHandlerRef = useRef<((event: MessageEvent) => Promise<void>) | null>(null);

  const initializeServiceWorker = async () => {
    if (!navigator.serviceWorker) {
      setSwLoading(false);
      return;
    }

    const registration = await navigator.serviceWorker.getRegistration();

    try {
      listenSw();

      if (registration && registration.active) {
        registration.active.postMessage({ method: 'subNotice' });
      } else {
        // Service Worker is not installed
      }
    } catch {
      // Error initializing Service Worker
    } finally {
      setSwLoading(false);
    }
  };

  function listenSw() {
    if (!navigator.serviceWorker) {
      return;
    }

    // 先移除旧的监听器（如果存在）
    if (messageHandlerRef.current) {
      navigator.serviceWorker.removeEventListener('message', messageHandlerRef.current);
    }

    // 创建新的事件处理函数
    const messageHandler = async (event: MessageEvent) => {
      switch (event.data?.method) {
        case 'subNoticeResponse':
          {
            try {
              const response = await post('/subscriptions', JSON.parse(event.data.payload));

              if (response.data?.id) {
                setSwLoading(false);
                setSwReady(true);
                setNoticeId(response.data.id);
              }
            } catch (error) {
              // 静默处理错误，避免影响用户体验
              // eslint-disable-next-line no-console
              console.error('Failed to handle subscription response:', error);
            }
          }
          break;

        default:
          // Unknown message from Service Worker
          break;
      }
    };

    // 保存引用并添加监听器
    messageHandlerRef.current = messageHandler;
    navigator.serviceWorker.addEventListener('message', messageHandler);
  }

  async function sub() {
    try {
      setSwLoading(true);
      checkPermission();
      await requestNotificationPermission();
      const registration = await registerSW();

      if (!registration.active) {
        toast.error(t('swNotActive'));
        return;
      }

      initializeServiceWorker();
    } catch (error: unknown) {
      const errorMessage =
        (error as any)?.response?.data?.message ||
        (error as any)?.message ||
        String(error);
      toast.error(errorMessage);
    }
  }
  async function unSub() {
    setSwLoading(true);
    try {
      await del('/subscriptions/' + noticeId);
      setSwLoading(false);
      setNoticeId(null);
      setSwReady(false);
    } catch {
      setSwLoading(false);
      // 静默处理错误，用户可以通过UI状态了解结果
    }
  }

  useEffect(() => {
    if (navigator.serviceWorker) {
      setSwLoading(true);
      initializeServiceWorker();
    } else {
      setSwLoading(false);
    }

    return () => {
      // 清理事件监听器
      if (navigator.serviceWorker && messageHandlerRef.current) {
        try {
          navigator.serviceWorker.removeEventListener('message', messageHandlerRef.current);
        } catch (error) {
          // 静默处理清理错误，避免影响组件卸载
          // eslint-disable-next-line no-console
          console.error('Failed to remove service worker message listener:', error);
        }
        messageHandlerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="noScrollBar relative w-full overflow-x-hidden overflow-y-scroll p-4 sm:aspect-square">
      <div className="text-2xl font-semibold">
        {t('title')} <br />
        <div className="text-info mt-2 text-sm font-normal">{t('description')}</div>
      </div>
      <Divider></Divider>
      <div className="flex items-center gap-2">
        <span className="font-semibold">{t('status')}</span>
        <Switch
          className="bg-foreground/3"
          checked={swReady}
          onClick={() => {
            if (!swReady) {
              sub();
            } else {
              unSub();
            }
          }}
        />
      </div>
      {noticeId && (
        <div className="text-info mt-2 flex items-center gap-2">
          <span className="shrink-0">{t('serviceId')}</span>
          <span className="truncate overflow-hidden">{noticeId}</span>
          <Button
            variant="secondary"
            disabled={sending}
            onClick={() => {
              if (!noticeId || sending) return;
              setSending(true);
              noticeTest(noticeId, '自在废物', '这是我的博客。')
                .then(() => {
                  toast.success(t('sendSuccess'));
                })
                .catch((error) => {
                  const errorMessage = error.response?.data?.message || t('sendFailed');
                  toast.error(`${t('sendFailed')}: ${errorMessage}`);
                })
                .finally(() => setSending(false));
            }}
          >
            {sending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Bell className="mr-2 size-4" />
            )}
            {sending ? t('sending') : t('notificationTest')}
          </Button>
        </div>
      )}
      {noticeId && (
        <div className="mt-2 flex flex-col gap-2">
          <div className="font-semibold">{t('example')}</div>
          <div className="bg-foreground/3 overflow-x-scroll rounded-xl p-3 font-mono whitespace-pre text-red-700 dark:text-red-400">
            {`curl --location --request POST '${API_POINT}/v2/api/subscriptions/${noticeId}/notify'
--header 'Content-Type: application/json'
--data '{
  "title": "自在废物",
  "body": "这是我的博客。",
  "image": "https://r2.rote.ink/others/logo.png",
  "data": {
  "type": "openUrl",
  "url": "https://rabithua.club"
  }
}'`}
          </div>
        </div>
      )}
      <Divider></Divider>
      <SubList />
      <SoftBottom className="translate-y-4" spacer />

      {!navigator.serviceWorker && (
        <div className="bg-background/90 absolute top-0 left-0 flex h-full w-full flex-col items-center justify-center gap-2 backdrop-blur-xl">
          <div className="text-2xl">🤕</div>
          <div>{t('notSupported')}</div>
        </div>
      )}
    </div>
  );
}
