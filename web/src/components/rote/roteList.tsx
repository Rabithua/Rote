import type { Rote, Rotes } from '@/types/main';

import LoadingPlaceholder from '@/components/others/LoadingPlaceholder';
import CollapsedRoteGroup from '@/components/rote/CollapsedRoteGroup';
import RoteItem from '@/components/rote/roteItem';
import { AlertCircle, MessageSquareDashed } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { SWRInfiniteKeyedMutator } from 'swr/infinite';

function RoteList({
  data,
  loadMore,
  mutate,
  error,
  enableFolding = false,
  isValidating,
}: {
  data?: Rotes[];
  loadMore: () => void;
  mutate: SWRInfiniteKeyedMutator<Rotes>;
  error?: Error | null;
  enableFolding?: boolean;
  isValidating?: boolean;
}) {
  const { t } = useTranslation('translation', {
    keyPrefix: 'components.roteList',
  });

  const loaderRef = useRef<HTMLDivElement>(null);

  const rotes: Rotes = data ? ([] as Rotes).concat(...data) : [];
  const isEmpty = data?.[0]?.length === 0;
  // TODO:如何优雅处理limit字段的传输
  // const limit = getProps(0, []).limit || 20;
  const limit = 20;
  const isReachingEnd = isEmpty || (data && data[data.length - 1]?.length < limit);

  useEffect(() => {
    const currentloaderRef = loaderRef.current;

    if (!currentloaderRef) {
      return;
    }

    const options = {
      root: null, // 使用视口作为根元素
      rootMargin: '0px', // 根元素的边距
      threshold: 0.5, // 元素可见度的阈值
    };

    const observer = new IntersectionObserver((entries) => {
      const target = entries[0];
      if (target.isIntersecting) {
        loadMore();
      }
    }, options);

    // 使用之前保存的引用而不是直接访问 loaderRef.current
    observer.observe(currentloaderRef);

    return () => {
      // 在清理函数中使用相同的引用
      observer.unobserve(currentloaderRef);
    };
  }, [loadMore]);

  // 如果有错误，显示错误提示
  if (error) {
    const errorMessage =
      (error as any)?.response?.data?.message ||
      error?.message ||
      t('error', { defaultValue: '加载失败，请稍后重试' });
    return (
      <div className="bg-background flex shrink-0 flex-col items-center justify-center gap-4 py-8">
        <AlertCircle className="text-destructive size-10" />
        <div className="text-destructive text-center font-light">{errorMessage}</div>
      </div>
    );
  }

  const renderRotes = () => {
    if (!enableFolding) {
      return rotes.map((item: any) => <RoteItem rote={item} key={item.id} mutate={mutate} />);
    }

    const groups: Rote[][] = [];
    let currentGroup: Rote[] = [];

    rotes.forEach((rote, index) => {
      if (index === 0) {
        currentGroup.push(rote);
        return;
      }

      const prevRote = rotes[index - 1];
      const timeDiff = new Date(prevRote.createdAt).getTime() - new Date(rote.createdAt).getTime();
      const isSameAuthor =
        rote.authorid && prevRote.authorid && rote.authorid === prevRote.authorid;
      // 1 minute = 60 * 1000 ms
      const isWithinTime = Math.abs(timeDiff) < 60 * 1000;

      if (isSameAuthor && isWithinTime) {
        currentGroup.push(rote);
      } else {
        groups.push(currentGroup);
        currentGroup = [rote];
      }
    });

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups.map((group) => {
      if (group.length > 3) {
        // cast mutate to satisfy types if needed, though they should match
        return <CollapsedRoteGroup key={group[0].id} rotes={group} mutate={mutate as any} />;
      }
      return group.map((rote) => <RoteItem key={rote.id} rote={rote} mutate={mutate} />);
    });
  };

  return (
    <div className="relative flex w-full flex-col divide-y">
      {renderRotes()}
      {isReachingEnd ? null : (
        <div className="flex w-full flex-col">
          <div ref={loaderRef} className="h-4 w-full" />
          {(isValidating ?? true) && <LoadingPlaceholder className="py-8" size={6} />}
        </div>
      )}
      {isReachingEnd && rotes.length === 0 ? (
        <div className="bg-background flex shrink-0 flex-col items-center justify-center gap-4 py-8">
          <MessageSquareDashed className="text-theme/30 size-10" />
          <div className="text-info text-center font-light">{t('empty')}</div>
        </div>
      ) : null}
    </div>
  );
}

export default RoteList;
