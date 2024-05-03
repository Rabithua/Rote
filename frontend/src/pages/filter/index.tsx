import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LeftOutlined, LoadingOutlined, UpOutlined } from "@ant-design/icons";
import Rote from "@/components/Rote";
import { apiGetMyRote } from "@/api/rote/main";
import { Empty } from "antd";
import { useProfile } from "@/state/profile";
import { useFilterRotes, useFilterRotesDispatch } from "@/state/filterRotes";
import { observeElementInViewport } from "@/utils/observeElementInViewport";

function MineFilter() {
  let location = useLocation();
  const navigate = useNavigate();
  const loadingRef = useRef(null);
  const [isLoadAll, setIsLoadAll] = useState(false);
  // const { t } = useTranslation("translation", { keyPrefix: "pages.mine" });

  const rotes = useFilterRotes();
  const rotesDispatch = useFilterRotesDispatch();

  const countRef = useRef(rotes.length);

  useEffect(() => {
    countRef.current = rotes.length;
  }, [rotes.length]);

  const [filter, setFilter] = useState<any>({
    tags: location.state?.tags || [],
    keywords: [],
    time: [],
    userid: "",
    others: [],
  });

  function back() {
    const doesAnyHistoryEntryExist = location.key !== "default";
    if (doesAnyHistoryEntryExist) {
      navigate(-1);
    } else {
      navigate("/home");
    }
  }

  const [showscrollTop, setShowScrollTop] = useState(false);
  const [navHeight, setNavHeight] = useState(0);
  useEffect(() => {
    let topElement = document.getElementById("top") as any;
    if (!topElement) {
      return;
    }
    observeElementInViewport(topElement, (ifshow: boolean) => {
      setShowScrollTop(!ifshow);
    });

    const element = document.getElementById("top") as HTMLElement;
    setNavHeight(element.offsetHeight || 0);
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
          apiGetMyRote({
            limit: 20,
            skip: countRef.current,
            filter: {
              tags: {
                hasEvery: filter.tags,
              },
            },
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

  useEffect(() => {
    // 监听state的变化
    setFilter({
      tags: location.state?.tags || [],
      keywords: [],
      time: [],
      userid: "",
      others: [],
    });
    rotesDispatch({
      type: "freshAll",
      rotes: [],
    });
    setIsLoadAll(false);
  }, [location.state]); // 当state发生变化时执行

  function relativeTags() {
    return [
      ...new Set(
        rotes.reduce((acc: string[], curr) => acc.concat(curr.tags), [])
      ),
    ];
  }

  function goTop() {
    const containers = document.getElementsByClassName("scrollContainer");
    if (containers.length > 0) {
      const container = containers[0]; // 获取第一个匹配的元素
      container.scrollTop = 0; // 将该容器滚动到顶部
    }
  }

  return (
    <div
      className={` scrollContainer scroll-smooth overscroll-contain flex-1 noScrollBar h-lvh overflow-y-visible overflow-x-hidden relative`}
      style={{ scrollPaddingTop: `${navHeight}px` }}
    >
      {window.history.state && window.history.state.idx > 0 && (
        <div className=" duration-300 sticky top-0 z-10 w-full flex overflow-x-scroll noScrollBar items-center bg-[#ffffff99] backdrop-blur-xl">
          <LeftOutlined className=" p-4 cursor-pointer" onClick={back} />
          <div className=" font-semibold cursor-pointer" onClick={back}>
            返回
          </div>
        </div>
      )}
      <div className=" p-4 ml-4 font-semibold" id="top">
        <div className=" flex items-center flex-wrap gap-2 my-2">
          包含标签：
          {filter.tags.length > 0
            ? filter.tags.map((tag: any, index: any) => {
                return (
                  <div
                    className=" cursor-pointer font-normal px-2 py-1 text-xs rounded-md bg-[#00000010] duration-300 hover:scale-95"
                    key={`tag_${index}`}
                  >
                    {tag}
                  </div>
                );
              })
            : "NONE"}
        </div>
        <div className=" flex items-center flex-wrap gap-2 my-2 font-normal text-gray-500">
          相关标签：
          {relativeTags().length > 0
            ? relativeTags().map((tag: any, index: any) => {
                return (
                  <div
                    className=" cursor-pointer font-normal px-2 py-1 text-xs rounded-md border-[1px] border-[#00000010] duration-300 hover:scale-95"
                    key={`tag_${index}`}
                  >
                    {tag}
                  </div>
                );
              })
            : "NONE"}
        </div>
      </div>
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
          <div className=" py-4">
            <Empty description={false} />
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

export default MineFilter;
