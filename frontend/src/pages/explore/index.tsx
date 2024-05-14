import { observeElementInViewport } from "@/utils/observeElementInViewport";
import { GlobalOutlined, LoadingOutlined, UpOutlined } from "@ant-design/icons";
import { Empty } from "antd";
import { useEffect, useRef, useState } from "react";
import Rote from "@/components/Rote";
import { apiGetMyRote, apiGetPublicRote } from "@/api/rote/main";
import { useExploreRotes, useExploreRotesDispatch } from "@/state/exploreRotes";

function ExplorePage() {
  const loadingRef = useRef(null);
  const [showscrollTop, setShowScrollTop] = useState(false);

  const [isLoadAll, setIsLoadAll] = useState(false);
  // const { t } = useTranslation("translation", { keyPrefix: "pages.mine" });

  const rotes = useExploreRotes();
  const rotesDispatch = useExploreRotesDispatch();

  const countRef = useRef(rotes.length);

  useEffect(() => {
    countRef.current = rotes.length;
  }, [rotes.length]);

  useEffect(() => {
    let topElement = document.getElementById("top") as any;
    if (!topElement) {
      return;
    }

    const stopOb = observeElementInViewport(topElement, (ifshow: boolean) => {
      setShowScrollTop(!ifshow);
    });

    return () => {
      rotesDispatch({
        type: "freshAll",
        rotes: [],
      });
      stopOb();
    };
  }, []);

  useEffect(() => {
    const options = {
      root: null, // 使用视口作为根元素
      rootMargin: "0px", // 根元素的边距
      threshold: 0.5, // 元素可见度的阈值
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // 元素进入视口
          apiGetPublicRote({
            limit: 20,
            skip: countRef.current,
            filter: {},
          })
            .then((res) => {
              if (res.data.data.length !== 20) {
                setIsLoadAll(true);
              }
              if (countRef.current > 0) {
                rotesDispatch({
                  type: "add",
                  rotes: res.data.data,
                });
              } else {
                rotesDispatch({
                  type: "freshAll",
                  rotes: res.data.data,
                });
              }
            })
            .catch((err) => {});
        }
      });
    }, options);

    if (loadingRef.current) {
      observer.observe(loadingRef.current);
    }

    return () => {
      if (loadingRef.current) {
        observer.unobserve(loadingRef.current);
      }
    };
  }, []);

  function goTop() {
    const containers = document.getElementsByClassName("scrollContainer");
    if (containers.length > 0) {
      const container = containers[0]; // 获取第一个匹配的元素
      container.scrollTop = 0; // 将该容器滚动到顶部
    }
  }

  return (
    <div
      className={` scrollContainer scroll-smooth overscroll-contain flex-1 noScrollBar h-dvh overflow-y-visible overflow-x-hidden relative`}
    >
      <div className=" sticky top-0 z-10">
        <div className=" flex gap-2 bg-white text-2xl font-semibold p-4">
          <GlobalOutlined />
          探索 / Explore
        </div>
      </div>
      <div id="top" className=" h-[1px]"></div>

      <div className="">
        {rotes.map((item: any, index: any) => {
          return <Rote rote_param={item} key={`Rote_${index}`}></Rote>;
        })}
        {isLoadAll ? null : (
          <div
            ref={loadingRef}
            className=" flex justify-center items-center py-8 gap-3 bg-white"
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
      {showscrollTop && (
        <div
          className=" animate-show duration-300 fixed self-end right-8 bottom-8 bg-black w-fit py-2 px-4 rounded-md text-white cursor-pointer hover:text-white"
          onClick={goTop}
        >
          <UpOutlined />
        </div>
      )}
    </div>
  );
}

export default ExplorePage;
