import { useEffect, useRef, useState } from "react";
import RoteItem from "./roteItem";
import Empty from "antd/es/empty";
import { LoadingOutlined } from "@ant-design/icons";

function RoteList({ rotesHook, rotesDispatchHook, api, apiProps }: any) {
  const rotes = rotesHook();

  const rotesDispatch = rotesDispatchHook();

  const [isLoadAll, setIsLoadAll] = useState(false);

  const countRef = useRef(rotes.length);

  const loadingRef = useRef(null);

  const observerRef = useRef(false);

  useEffect(() => {
    countRef.current = rotes.length;
  }, [rotes.length]);

  // 监听loadingRef显示事件，加载更多
  useEffect(() => {
    if (observerRef.current === true) {
      console.log("observerRef.current 已更新");
      return;
    }

    if (countRef.current > 0) {
      rotesDispatch({
        type: "freshAll",
        rotes: [],
      });
      countRef.current = 0;
    }

    const currentLoadingRef = loadingRef.current;

    if (!currentLoadingRef) {
      console.log("currentLoadingRef 未更新");
      return;
    }

    const options = {
      root: null, // 使用视口作为根元素
      rootMargin: "0px", // 根元素的边距
      threshold: 0.5, // 元素可见度的阈值
    };

    let observer: IntersectionObserver;

    function loadMore() {
      api({
        skip: countRef.current,
        ...apiProps,
      })
        .then((res: any) => {
          if (res.data.data.length !== 20) {
            setIsLoadAll(true);
          }

          rotesDispatch({
            type: "add",
            rotes: res.data.data,
          });

          if (currentLoadingRef) {
            observer.observe(currentLoadingRef);
          }
        })
        .catch(() => {});
    }

    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // 元素进入视口
          loadMore();
          observer.unobserve(currentLoadingRef);
        }
      });
    }, options);

    observer.observe(currentLoadingRef);
    observerRef.current = true;

    return () => {
      observerRef.current = false;
      observer.unobserve(currentLoadingRef);
    };
  }, [apiProps]);

  return (
    <div className=" flex flex-col w-full relative">
      {rotes.map((item: any, index: any) => {
        return <RoteItem rote_param={item} key={`Rote_${index}`}></RoteItem>;
      })}
      {isLoadAll ? null : (
        <div
          ref={loadingRef}
          className=" flex justify-center text-lg items-center py-8 gap-3 bg-bgLight dark:bg-bgDark"
        >
          <LoadingOutlined />
        </div>
      )}
      {isLoadAll && rotes.length === 0 ? (
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
