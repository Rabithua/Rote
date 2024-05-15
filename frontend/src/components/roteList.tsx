import { useEffect, useRef, useState } from "react";
import Rote from "./Rote";
import Empty from "antd/es/empty";
import { LoadingOutlined } from "@ant-design/icons";

function RoteList({ rotes, rotesDispatch, api, apiProps }: any) {
  const [isLoadAll, setIsLoadAll] = useState(false);

  const countRef = useRef(rotes.length);
  const loadingRef = useRef(null);
  const observerRun = useRef(false);

  useEffect(() => {
    countRef.current = rotes.length;
  }, [rotes.length]);

  // 监听loadingRef显示事件，加载更多
  useEffect(() => {
    const currentLoadingRef = loadingRef.current;

    if (!currentLoadingRef) {
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
        })
        .catch(() => {});
    }

    if (!observerRun.current) {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // 元素进入视口
            loadMore();
          }
        });
      }, options);
      observer.observe(currentLoadingRef);
      observerRun.current = true;
    }

    return () => {
      if (currentLoadingRef && observerRun.current && observer) {
        observer.unobserve(currentLoadingRef);
        observerRun.current = false;
      }
    };
  }, [apiProps]);

  return (
    <div className=" flex flex-col w-full relative">
      {rotes.map((item: any, index: any) => {
        return <Rote rote_param={item} key={`Rote_${index}`}></Rote>;
      })}
      {isLoadAll ? null : (
        <div
          ref={loadingRef}
          className=" flex justify-center text-lg items-center py-8 gap-3 bg-white"
        >
          <LoadingOutlined />
          <div>加载中...</div>
        </div>
      )}
      {isLoadAll && rotes.length === 0 ? (
        <div className=" border-t-[1px] border-[#00000010] bg-white py-4">
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
