import { Divider } from '@/components/ui/divider';
import { Switch } from '@/components/ui/switch';
import { del, post } from '@/utils/api';
import { checkPermission, registerSW, requestNotificationPermission } from '@/utils/main';
import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { SoftBottom } from '../others/SoftBottom';
import SubList, { noticeTest } from './SubList';

export default function ServiceWorker() {
  const { t } = useTranslation('translation', {
    keyPrefix: 'pages.experiment.serviceWorker',
  });
  const [swReady, setSwReady] = useState(false);
  const [, setSwLoading] = useState(true);
  const [noticeId, setNoticeId] = useState<string | null>(null);

  const initializeServiceWorker = async () => {
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
    navigator.serviceWorker.removeEventListener('message', async () => {});
    navigator.serviceWorker.addEventListener('message', async (event) => {
      switch (event.data.method) {
        case 'subNoticeResponse':
          {
            const response = await post('/subscriptions', JSON.parse(event.data.payload));

            if (response.data.id) {
              setSwLoading(false);
              setSwReady(true);
              setNoticeId(response.data.id);
            }
          }
          break;

        default:
          // Unknown message from Service Worker
          break;
      }
    });
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
      toast.error(String(error));
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
      navigator.serviceWorker.removeEventListener('message', listenSw);
    };
  }, []);

  return (
    <div className="noScrollBar relative aspect-square w-full overflow-x-hidden overflow-y-scroll p-4">
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
          <span className="overflow-hidden text-ellipsis">{noticeId}</span>
          <div
            className="bg-background flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 py-1 duration-300 active:scale-95"
            onClick={() => {
              noticeTest(noticeId, '自在废物', '这是我的博客。')
                .then(() => {
                  toast.success(t('sendSuccess'));
                })
                .catch((error) => {
                  const errorMessage = error.response?.data?.message || t('sendFailed');
                  toast.error(`${t('sendFailed')}: ${errorMessage}`);
                });
            }}
          >
            <Bell className="size-4" />
            {t('notificationTest')}
          </div>
        </div>
      )}
      {noticeId && (
        <div className="mt-2 flex flex-col gap-2">
          <div className="font-semibold">{t('example')}</div>
          <div className="bg-foreground/3 overflow-x-scroll rounded-xl p-3 font-mono whitespace-pre text-red-700 dark:text-red-400">
            {`curl --location '${process.env.REACT_APP_BASEURL_PRD}/v1/api/sendSwSubScription?subId=${noticeId}' 
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
