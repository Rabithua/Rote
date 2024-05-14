import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { apiGetMyRote } from "@/api/rote/main";
import { useFilterRotes, useFilterRotesDispatch } from "@/state/filterRotes";
import RoteList from "@/components/roteList";
import GoTop from "@/components/goTop";
import NavBar from "@/components/navBar";

function MineFilter() {
  let location = useLocation();
  // const { t } = useTranslation("translation", { keyPrefix: "pages.mine" });

  const rotes = useFilterRotes();
  const rotesDispatch = useFilterRotesDispatch();

  const [roteListKey, setRoteListKey] = useState(1);

  const [apiProps, setApiProps] = useState({
    limit: 20,
    filter: {
      tags: {
        hasEvery: location.state?.tags || [],
      },
    },
  });

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

  return (
    <div
      className={` scrollContainer scroll-smooth overscroll-contain flex-1 noScrollBar h-dvh overflow-y-visible overflow-x-hidden relative`}
      style={{ scrollPaddingTop: `${navHeight}px` }}
    >
      <NavBar />
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
                  <Link
                    className=" cursor-pointer font-normal px-2 py-1 text-xs rounded-md border-[1px] border-[#00000010] duration-300 hover:scale-95"
                    key={`tag_${index}`}
                    to={"/filter"}
                    state={{
                      tags: [tag],
                    }}
                  >
                    {tag}
                  </Link>
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
