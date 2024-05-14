import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LeftOutlined, UpOutlined } from "@ant-design/icons";
import { apiGetMyRote } from "@/api/rote/main";
import { useFilterRotes, useFilterRotesDispatch } from "@/state/filterRotes";
import RoteList from "@/components/roteList";
import GoTop from "@/components/goTop";

function MineFilter() {
  let location = useLocation();
  const navigate = useNavigate();
  // const { t } = useTranslation("translation", { keyPrefix: "pages.mine" });

  const rotes = useFilterRotes();
  const rotesDispatch = useFilterRotesDispatch();

  const countRef = useRef(rotes.length);
  const [roteListKey, setRoteListKey] = useState(1);

  useEffect(() => {
    countRef.current = rotes.length;
  }, [rotes.length]);

  const [apiProps, setApiProps] = useState({
    limit: 20,
    filter: {
      tags: {
        hasEvery: [],
      },
    },
  });

  function back() {
    const doesAnyHistoryEntryExist = location.key !== "default";
    if (doesAnyHistoryEntryExist) {
      navigate(-1);
    } else {
      navigate("/home");
    }
  }

  const [navHeight, setNavHeight] = useState(0);

  useEffect(() => {
    const element = document.getElementById("top") as HTMLElement;
    setNavHeight(element.offsetHeight || 0);

    return () => {};
  }, []);

  useEffect(() => {
    setApiProps({
      limit: 20,
      filter: {
        tags: {
          hasEvery: location.state?.tags || [],
        },
      },
    });
    rotesDispatch({
      type: "freshAll",
      rotes: [],
    });
    setRoteListKey((r) => r + 1);
  }, [location.state, rotesDispatch]);

  function relativeTags() {
    return [
      ...new Set(
        rotes.reduce((acc: string[], curr) => acc.concat(curr.tags), [])
      ),
    ];
  }

  function filterTagsChange(tag: string) {
    navigate("/filter", {
      state: {
        tags: [tag],
      },
    });
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
      className={` scrollContainer scroll-smooth overscroll-contain flex-1 noScrollBar h-dvh overflow-y-visible overflow-x-hidden relative`}
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
          {location.state?.tags.length > 0
            ? location.state?.tags.map((tag: any, index: any) => {
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
                    onClick={() => {
                      filterTagsChange(tag);
                    }}
                  >
                    {tag}
                  </div>
                );
              })
            : "NONE"}
        </div>
      </div>

      <RoteList
        key={roteListKey}
        rotes={rotes}
        rotesDispatch={rotesDispatch}
        api={apiGetMyRote}
        apiProps={apiProps}
      />

      <GoTop scrollContainerName="scrollContainer" />
    </div>
  );
}

export default MineFilter;
