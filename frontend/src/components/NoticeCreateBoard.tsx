import type { Subscription } from '@/types/main';
import { get } from '@/utils/api';
import useSWR from 'swr';
import LoadingPlaceholder from './LoadingPlaceholder';
import { SoftBottom } from './ui/SoftBottom';

function NoticeCreateBoard() {
  const { data, isLoading } = useSWR('/v1/api/getSwSubScription', () =>
    get('/subscriptions').then((res) => res.data)
  );

  return (
    <div className="divide-y-1">
      <div className="flex flex-col items-center justify-center pb-4">
        <h1 className="text-2xl font-bold">通知订阅</h1>
        <p className="text-gray-500">开发中...</p>
      </div>
      {isLoading ? (
        <LoadingPlaceholder className="py-8" size={6} />
      ) : (
        <div className="relative max-h-[50dvh] overflow-scroll">
          {data?.map((item: Subscription) => (
            <div key={item.id} className="m-2 w-full rounded-lg p-4">
              <h2 className="text-xl font-bold">{item.id}</h2>
              <p className="text-xs break-words whitespace-break-spaces opacity-50">
                {item.endpoint}
              </p>
            </div>
          ))}
          <SoftBottom spacer />
        </div>
      )}
    </div>
  );
}

export default NoticeCreateBoard;
