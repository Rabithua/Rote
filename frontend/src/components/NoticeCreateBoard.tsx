import { getSubscriptionList, type Subscription } from '@/api/subscription/main';
import useSWR from 'swr';
import LoadingPlaceholder from './LoadingPlaceholder';

function NoticeCreateBoard() {
  const { data, isLoading } = useSWR('/v1/api/getSwSubScription', getSubscriptionList);

  return (
    <div className="divide-y-1">
      <div className="flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold">通知订阅</h1>
        <p className="text-gray-500">开发中...</p>
      </div>
      {isLoading ? (
        <LoadingPlaceholder className="py-8" size={6} />
      ) : (
        <div className="relative flex flex-col items-center justify-center">
          {data?.map((item: Subscription) => (
            <div key={item.id} className="m-2 w-full rounded-lg p-4">
              <h2 className="text-xl font-bold">{item.id}</h2>
              <p>{item.endpoint}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default NoticeCreateBoard;
