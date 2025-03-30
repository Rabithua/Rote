import { Rotes } from "@/types/main";
import { useAPIInfinite } from "@/utils/fetcher";

import Empty from "antd/es/empty";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { SWRConfiguration } from "swr";
import LoadingPlaceholder from "./loader";
import RoteItem from "./roteItem";

function RoteList(
  { api, apiProps, options }: {
    api: any;
    apiProps: any;
    options?: SWRConfiguration;
  },
) {
  const { t } = useTranslation("translation", {
    keyPrefix: "components.roteList",
  });

  const loaderRef = useRef<HTMLDivElement>(null);

  const getProps = (pageIndex: number, previousPageData: Rotes | null) => {
    if (previousPageData && !previousPageData.length) return null;
    return {
      limit: 20,
      skip: pageIndex * 20,
      ...apiProps,
    };
  };

  const { data, mutate, loadMore } = useAPIInfinite(getProps, api, {
    ...options,
    initialSize: 0,
    revalidateFirstPage: false,
  });

  const rotes: Rotes = data ? [].concat(...data) : [];
  const isEmpty = data?.[0]?.length === 0;
  const isReachingEnd = isEmpty ||
    (data && data[data.length - 1]?.length < apiProps.limit);

  useEffect(() => {
    const currentloaderRef = loaderRef.current;

    if (!currentloaderRef) {
      return;
    }

    const options = {
      root: null, // 使用视口作为根元素
      rootMargin: "0px", // 根元素的边距
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
    <div className=" flex flex-col w-full relative">
      {rotes.map((item: any) => {
        return <RoteItem rote={item} key={item.id} mutate={mutate} />;
      })}
      {isReachingEnd ? null : (
        <div
          ref={loaderRef}
        >
          <LoadingPlaceholder className=" py-8" size={6} />
        </div>
      )}
      {isReachingEnd && rotes.length === 0
        ? (
          <div className=" shrink-0 dark:border-opacityDark bg-bgLight dark:bg-bgDark py-4">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t("empty")}
            />
          </div>
        )
        : null}
    </div>
  );
}

export default RoteList;
