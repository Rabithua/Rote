import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Subscription } from '@/types/main';
import { get, post } from '@/utils/api';
import { Bell, MoreVertical } from 'lucide-react';
import toast from 'react-hot-toast';
import useSWR from 'swr';
import LoadingPlaceholder from '../LoadingPlaceholder';
import { Button } from '../ui/button';

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
          <Button>测试所有端点</Button>
          <div className="relative divide-y-1">
            {data?.map((item: Subscription) => (
              <div key={item.id} className="p-2">
                <div className="flex items-center gap-4">
                  <h2 className="grow truncate text-xl font-semibold">{item.id}</h2>
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
                    </DropdownMenuContent>
                  </DropdownMenu>
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
