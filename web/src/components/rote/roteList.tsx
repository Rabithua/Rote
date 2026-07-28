import type { ReactNode } from 'react';
import type { Rote, Rotes } from '@/types/main';

import LoadingPlaceholder from '@/components/others/LoadingPlaceholder';
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
  isItemMuted,
  isValidating,
  itemActions,
  showAuthorActions = false,
}: {
  data?: Rotes[];
  loadMore?: () => void;
  mutate?: SWRInfiniteKeyedMutator<Rotes>;
  error?: Error | null;
  isItemMuted?: (rote: Rote, index: number) => boolean;
  isValidating?: boolean;
  itemActions?: (rote: Rote, index: number) => ReactNode;
  showAuthorActions?: boolean;
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
  const isStaticList = !loadMore;
  const isReachingEnd = isStaticList || isEmpty || (data && data[data.length - 1]?.length < limit);

  useEffect(() => {
    if (!loadMore) {
      return;
    }

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

  const renderRotes = () =>
    rotes.map((item: Rote, index) => {
      const actions = itemActions?.(item, index);
      const muted = isItemMuted?.(item, index);
      const roteItem = (
        <RoteItem
          rote={item}
          mutate={mutate}
          showReactions={!isStaticList}
          showAuthorActions={showAuthorActions}
        />
      );

      if (!actions && !muted) {
        return (
          <RoteItem
            rote={item}
            key={item.id || index}
            mutate={mutate}
            showReactions={!isStaticList}
            showAuthorActions={showAuthorActions}
          />
        );
      }

      return (
        <div key={item.id || index} className={`relative ${muted ? 'opacity-40' : ''}`}>
          {roteItem}
          {actions && <div className="absolute top-3 right-3 z-10">{actions}</div>}
        </div>
      );
    });

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
