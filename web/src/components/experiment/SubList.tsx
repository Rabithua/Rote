import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Subscription } from '@/types/main';
import { del, get, post } from '@/utils/api';
import { Bell, Loader, MoreVertical, Terminal, Trash2 } from 'lucide-react';
import moment from 'moment';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import useSWR from 'swr';
import LoadingPlaceholder from '../others/LoadingPlaceholder';

export async function noticeTest(noticeId: string, title: string, body: string) {
  try {
    await post('/subscriptions/' + noticeId + '/notify', {
      title,
      body,
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

export default function SubList() {
  const { t } = useTranslation('translation', {
    keyPrefix: 'pages.experiment.subscriptions',
  });

  const [isTestingAll, setIsTestingAll] = useState(false);

  const { data, isLoading, error, mutate } = useSWR(
    '/v1/api/getSwSubScription',
    async () => {
      try {
        const res = await get('/subscriptions');
        return res.data;
      } catch (err: any) {
        // 处理 404 或其他错误，不抛出异常，避免导致页面跳转
        if (err.response?.status === 404 || err.response?.status === 401) {
          // 404 或 401 时返回空数组，不抛出错误
          return [];
        }
        // 其他错误也返回空数组，避免影响页面
        // eslint-disable-next-line no-console
        console.error('Failed to fetch subscriptions:', err);
        return [];
      }
    },
    {
      // 禁用错误重试，避免多次请求
      shouldRetryOnError: false,
      // 404 和 401 不触发错误重试
      onErrorRetry: (error) => {
        if (error.response?.status === 404 || error.response?.status === 401) {
          return;
        }
      },
    }
  );

  const handleTestAllEndpoints = async () => {
    setIsTestingAll(true);
    const loadingToast = toast.loading(t('messages.testingAllEndpoints'));

    try {
      const response = await post('/subscriptions/test-all');
      const result = response.data;

      toast.success(
        t('messages.testCompleted', {
          success: result.summary.success,
          failed: result.summary.failed,
        }),
        {
          id: loadingToast,
        }
      );

      // 刷新订阅列表以显示更新后的状态
      mutate();
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';
      toast.error(t('messages.testFailed', { error: errorMessage }), {
        id: loadingToast,
      });
    } finally {
      setIsTestingAll(false);
    }
  };

  const handleDeleteSubscription = async (subscriptionId: string) => {
    if (!confirm(t('messages.confirmDelete'))) {
      return;
    }

    const loadingToast = toast.loading(t('messages.deletingSubscription'));

    try {
      await del(`/subscriptions/${subscriptionId}`);
      toast.success(t('messages.deleteSuccess'), { id: loadingToast });

      // 刷新订阅列表
      mutate();
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';
      toast.error(t('messages.deleteFailed', { error: errorMessage }), {
        id: loadingToast,
      });
    }
  };

  return (
    <div className="divide-y-1">
      {isLoading ? (
        <LoadingPlaceholder className="py-8" size={6} />
      ) : error ? (
        <div className="py-4 text-center text-gray-500">
          {error.response?.status === 404 || error.response?.status === 401
            ? t('noSubscriptions')
            : t('messages.loadFailed', {
                error: error?.response?.data?.message || error?.message || 'Unknown error',
              })}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="mx-2 flex items-center justify-between gap-2">
            <h1 className="text-lg font-semibold">{t('title')}</h1>
            <Button
              variant="secondary"
              size="sm"
              disabled={isTestingAll}
              onClick={handleTestAllEndpoints}
              className="flex cursor-pointer items-center gap-2"
            >
              {isTestingAll ? (
                <Loader className="size-3 animate-spin" />
              ) : (
                <Terminal className="size-3" />
              )}
              {t('testAllEndpoints')}
            </Button>
          </div>
          <div className="relative divide-y-1">
            {data && Array.isArray(data) && data.length > 0 ? (
              data.map((item: Subscription) => (
                <div key={item.id} className="space-y-2 p-2">
                  <div className="flex items-center gap-4">
                    <h2 className="grow truncate text-lg">{item.id}</h2>
                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-xs ${
                        item.status === 'active'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}
                    >
                      {item.status === 'active' ? t('statusActive') : t('statusInactive')}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <div className="bg-background flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 py-1 duration-300 active:scale-95">
                          <MoreVertical className="size-4" />
                        </div>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            noticeTest(
                              item.id,
                              t('testNotificationContent.title'),
                              t('testNotificationContent.body')
                            ).then(() => {
                              toast.success(t('messages.testNotificationSent'));
                            });
                          }}
                        >
                          <Bell className="text-primary size-4" />
                          {t('testNotification')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteSubscription(item.id)}
                          className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                        >
                          <Trash2 className="size-4 text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400" />
                          {t('deleteSubscription')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <p className="font-mono text-xs font-thin break-words whitespace-break-spaces opacity-50">
                    {item.endpoint}
                  </p>
                  <div className="font-mono text-xs">
                    {moment(item.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-4 text-center text-gray-500">{t('noSubscriptions')}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
