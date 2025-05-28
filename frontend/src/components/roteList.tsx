import type { Rotes } from '@/types/main';

import { MessageSquareDashed } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import LoadingPlaceholder from './LoadingPlaceholder';
import RoteItem from './roteItem';

import type { SWRInfiniteKeyedMutator } from 'swr/infinite';

function RoteList({
  data,
  loadMore,
  mutate,
}: {
  data?: Rotes[];
  loadMore: () => void;
  mutate: SWRInfiniteKeyedMutator<Rotes>;
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

  return (
    <div className="relative flex w-full flex-col divide-y-1">
      {rotes.map((item: any) => (
        <RoteItem rote={item} key={item.id} mutate={mutate} />
      ))}
      {isReachingEnd ? null : (
        <div ref={loaderRef}>
          <LoadingPlaceholder className="py-8" size={6} />
        </div>
      )}
      {isReachingEnd && rotes.length === 0 ? (
        <div className="bg-bgLight dark:bg-bgDark flex shrink-0 flex-col items-center justify-center gap-4 py-8">
          <MessageSquareDashed className="text-muted-foreground size-10" />
          <div className="text-textLight dark:text-textDark text-center">{t('empty')}</div>
        </div>
      ) : null}
    </div>
  );
}

export default RoteList;
