import { useEffect, useRef, useState } from "react";
import RoteItem from "./roteItem";
import Empty from "antd/es/empty";
import { LoadingOutlined } from "@ant-design/icons";

function RoteList({ rotesHook, rotesDispatchHook, api, apiProps }: any) {
  const rotes = rotesHook();

  const rotesDispatch = rotesDispatchHook();

  const countRef = useRef<number>(0);
  const loading = useRef<boolean>(false);
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    countRef.current = rotes.length;
  }, [rotes.length]);

  // 监听loaderRef显示事件，加载更多
  useEffect(() => {
    const currentloaderRef = loaderRef.current;

    if (!currentloaderRef) {
      console.log("currentloaderRef 未更新");
      return;
    }

    const options = {
      root: null, // 使用视口作为根元素
      rootMargin: "0px", // 根元素的边距
      threshold: 0.5, // 元素可见度的阈值
    };

    let observer: IntersectionObserver;

    function loadMore() {
      if (loading.current === true || !hasMore) return;

      loading.current = true;

      api({
        skip: countRef.current,
        ...apiProps,
      })
        .then((res: any) => {
          if (res.data.data.length !== 20) {
            setHasMore(false);
          }

          rotesDispatch({
            type: "add",
            rotes: res.data.data,
          });

          countRef.current += res.data.data.length;
        })
        .catch(() => {})
        .finally(() => {
          loading.current = false;
        });
    }

    observer = new IntersectionObserver((entries) => {
      const target = entries[0];
      if (target.isIntersecting) {
        loadMore();
      }
    }, options);

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => {
      if (loaderRef.current) {
        observer.unobserve(loaderRef.current);
      }
    };
  }, []);

  return (
    <div className=" flex flex-col w-full relative">
      {rotes.map((item: any, index: any) => {
        return <RoteItem rote_param={item} key={`Rote_${index}`}></RoteItem>;
      })}
      {!hasMore ? null : (
        <div
          ref={loaderRef}
          className=" flex justify-center text-lg items-center py-8 gap-3 bg-bgLight dark:bg-bgDark"
        >
          <LoadingOutlined />
        </div>
      )}
      {!hasMore && rotes.length === 0 ? (
        <div className=" shrink-0 border-t-[1px] border-opacityLight dark:border-opacityDark bg-bgLight dark:bg-bgDark py-4">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={"这里什么也没有"}
          />
        </div>
      ) : null}
    </div>
  );
}

export default RoteList;
