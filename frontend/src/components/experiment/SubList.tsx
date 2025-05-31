import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Subscription } from '@/types/main';
import { del, get, post } from '@/utils/api';
import { Bell, MoreVertical, Terminal, Trash2 } from 'lucide-react';
import moment from 'moment';
import toast from 'react-hot-toast';
import useSWR from 'swr';
import LoadingPlaceholder from '../LoadingPlaceholder';

export async function noticeTest(noticeId: string) {
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

export default function SubList() {
  const { data, isLoading, mutate } = useSWR('/v1/api/getSwSubScription', () =>
    get('/subscriptions').then((res) => res.data)
  );

  const handleTestAllEndpoints = async () => {
    const loadingToast = toast.loading('正在测试所有端点...');

    try {
      const response = await post('/subscriptions/test-all');
      const result = response.data;

      toast.success(`测试完成！成功: ${result.summary.success}, 失败: ${result.summary.failed}`, {
        id: loadingToast,
      });

      // 刷新订阅列表以显示更新后的状态
      mutate();
    } catch (error: any) {
      toast.error('测试失败: ' + (error.message || '未知错误'), { id: loadingToast });
    }
  };

  const handleDeleteSubscription = async (subscriptionId: string) => {
    const loadingToast = toast.loading('正在删除订阅...');

    try {
      await del(`/subscriptions/${subscriptionId}`);
      toast.success('订阅删除成功', { id: loadingToast });

      // 刷新订阅列表
      mutate();
    } catch (error: any) {
      toast.error('删除失败: ' + (error.message || '未知错误'), { id: loadingToast });
    }
  };

  return (
    <div className="divide-y-1">
      {isLoading ? (
        <LoadingPlaceholder className="py-8" size={6} />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-xl font-semibold">已订阅的通知端点</h1>
            <div className="bg-opacityLight dark:bg-opacityDark flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-sm">
              <Terminal onClick={handleTestAllEndpoints} className="size-3 opacity-50" />
              测试所有端点
            </div>
          </div>
          <div className="relative divide-y-1">
            {data?.map((item: Subscription) => (
              <div key={item.id} className="space-y-2 p-2">
                <div className="flex items-center gap-4">
                  <h2 className="grow truncate text-xl font-semibold">{item.id}</h2>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-xs ${
                      item.status === 'active'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}
                  >
                    {item.status === 'active' ? '正常' : '不可用'}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <div className="bg-bgLight flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 py-1 duration-300 active:scale-95">
                        <MoreVertical className="size-4" />
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          noticeTest(item.id).then(() => {
                            toast.success('测试通知已发送');
                          });
                        }}
                      >
                        <Bell className="mr-2 size-4" />
                        测试通知
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDeleteSubscription(item.id)}
                        className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                      >
                        <Trash2 className="mr-2 size-4" />
                        删除订阅
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <p className="font-mono text-xs break-words whitespace-break-spaces opacity-50">
                  {item.endpoint}
                </p>
                <div className="font-mono text-xs">
                  {moment(item.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
