import { Divider } from '@/components/ui/divider';
import { Switch } from '@/components/ui/switch';
import type { Subscription } from '@/types/main';
import { del, get, post } from '@/utils/api';
import { checkPermission, registerSW, requestNotificationPermission } from '@/utils/main';
import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import LoadingPlaceholder from '../LoadingPlaceholder';
import { SoftBottom } from '../ui/SoftBottom';

async function noticeTest(noticeId: string) {
  try {
    await post('/subscriptions/' + noticeId + '/notify', {
      title: '自在废物',
      body: '这是我的博客。',
      image: `https://r2.rote.ink/others%2Flogo.png`,
      data: {
        type: 'openUrl',
        url: 'https://rabithua.club',
      },
    });
  } catch {
    // 忽略错误，只是测试功能
  }
}

function SubList() {
  const { data, isLoading } = useSWR('/v1/api/getSwSubScription', () =>
    get('/subscriptions').then((res) => res.data)
  );

  return (
    <div className="divide-y-1">
      {isLoading ? (
        <LoadingPlaceholder className="py-8" size={6} />
      ) : (
        <div className="space-y-4">
          <h1 className="text-xl font-semibold">已订阅的通知端点</h1>
          <div className="relative divide-y-1">
            {data?.map((item: Subscription) => (
              <div key={item.id} className="p-2">
                <div className="flex items-center gap-4">
                  <h2 className="grow truncate text-xl font-semibold">{item.id}</h2>
                  <Bell className="size-8 p-2" onClick={() => noticeTest(item.id)} />
                </div>
                <p className="text-xs break-words whitespace-break-spaces opacity-50">
                  {item.endpoint}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

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
    const toastId = toast.loading(t('permissionProcessing'));
    try {
      setSwLoading(true);
      checkPermission();
      await requestNotificationPermission();
      const registration = await registerSW();

      if (!registration.active) {
        return toast.error(t('swNotActive'), {
          id: toastId,
        });
      }

      initializeServiceWorker();
    } catch (error: unknown) {
      toast.error(String(error), {
        id: toastId,
      });
    }
  }
  async function unSub() {
    setSwLoading(true);
    del('/subscriptions/' + noticeId)
      .then(() => {
        setSwLoading(false);
        setNoticeId(null);
        setSwReady(false);
      })
      .catch(() => {
        setSwLoading(false);
        // Handle unsubscribe error
      });
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
        <div className="mt-2 text-sm font-normal text-gray-500">{t('description')}</div>
      </div>
      <Divider></Divider>
      <div className="flex items-center gap-2">
        <span className="font-semibold">{t('status')}</span>
        <Switch
          disabled={!navigator.serviceWorker}
          className="bg-opacityLight dark:bg-opacityDark"
          checked={swReady}
          onChange={(e) => {
            if (e) {
              sub();
            } else {
              unSub();
            }
          }}
        />
      </div>
      {noticeId && (
        <div className="mt-2 flex items-center gap-2 text-gray-500">
          <span className="shrink-0">{t('serviceId')}</span>
          <span className="overflow-hidden text-ellipsis">{noticeId}</span>
          <div
            className="bg-bgLight flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 py-1 duration-300 active:scale-95"
            onClick={() => {
              noticeTest(noticeId).then(() => {
                toast.success(t('notificationSent'));
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
          <div className="bg-opacityLight dark:bg-opacityDark overflow-x-scroll rounded-xl p-3 font-mono whitespace-pre text-red-700 dark:text-red-400">
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
        <div className="bg-bgLight/90 dark:bg-bgDark/90 dark:text-textDark absolute top-0 left-0 flex h-full w-full flex-col items-center justify-center gap-2 backdrop-blur-xl">
          <div className="text-2xl">🤕</div>
          <div>{t('notSupported')}</div>
        </div>
      )}
    </div>
  );
}
