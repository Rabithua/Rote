import { useEffect, useRef, useState } from "react";
import Rote from "./Rote";
import Empty from "antd/es/empty";
import { LoadingOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

function RoteList({ rotesHook, rotesDispatchHook, api, apiProps }: any) {
  const rotes = rotesHook();
  const navigate = useNavigate();
  const rotesDispatch = rotesDispatchHook();

  const [isLoadAll, setIsLoadAll] = useState(false);

  const countRef = useRef(rotes.length);

  const loadingRef = useRef(null);

  useEffect(() => {
    countRef.current = rotes.length;
  }, [rotes.length]);

  // 监听loadingRef显示事件，加载更多
  useEffect(() => {
    setIsLoadAll(false);

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
        })
        .catch(() => {});
    }

    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // 元素进入视口
          loadMore();
        }
      });
    }, options);

    observer.observe(currentLoadingRef);

    return () => {
      observer.unobserve(currentLoadingRef);
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
