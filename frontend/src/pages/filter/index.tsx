import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { apiGetMyRote } from "@/api/rote/main";
import { useFilterRotes, useFilterRotesDispatch } from "@/state/filterRotes";
import RoteList from "@/components/roteList";
import GoTop from "@/components/goTop";
import NavBar from "@/components/navBar";
import { useImmer } from "use-immer";
import { useTranslation } from "react-i18next";

function TagsBlock({ setLocationState }: any) {
  let location = useLocation();
  const { t } = useTranslation("translation", { keyPrefix: "pages.filter" });

  const rotes = useFilterRotes();

  function relativeTags() {
    return [
      ...new Set(
        rotes.reduce((acc: string[], curr) => acc.concat(curr.tags), [])
      ),
    ];
  }
  return (
    <div
      className=" bg-opacityLight dark:bg-opacityDark p-4 font-semibold"
      id="top"
    >
      <div className=" flex items-center flex-wrap gap-2 my-2">
        {t("includeTags")}
        {location.state?.tags.length > 0
          ? location.state?.tags.map((tag: any, index: any) => {
              return (
                <div
                  className=" cursor-pointer font-normal px-2 py-1 text-xs rounded-md bg-opacityLight dark:bg-opacityDark duration-300 hover:scale-95"
                  key={`tag_${index}`}
                >
                  {tag}
                </div>
              );
            })
          : t("none")}
      </div>
      <div className=" flex items-center flex-wrap gap-2 my-2 font-normal text-gray-500">
        {t("relatedTags")}
        {relativeTags().length > 0
          ? relativeTags().map((tag: any, index: any) => {
              return (
                <Link
                  key={`tag_${index}`}
                  to={"/filter"}
                  state={{
                    tags: [tag],
                  }}
                  onClick={() => {
                    setLocationState((pre: any) => {
                      pre.tags = [tag];
                    });
                  }}
                >
                  <div className=" cursor-pointer font-normal px-2 py-1 text-xs rounded-md border-[1px] dark:border-opacityDark duration-300 hover:scale-95">
                    {tag}
                  </div>
                </Link>
              );
            })
          : t("none")}
      </div>
    </div>
  );
}

function MineFilter() {
  const location = useLocation();
  const [locationState, setLocationState] = useImmer<any>(null);

  const [navHeight, setNavHeight] = useState(0);

  useEffect(() => {
    console.log("locations:" + location.state);
    setLocationState(location.state);
  }, [location]);

  // const [roteListKey, setRoteListKey] = useState(0);

  useEffect(() => {
    const element = document.getElementById("top") as HTMLElement;
    setNavHeight(element.offsetHeight || 0);

    return () => {};
  }, []);

  return (
    <div
      className={` scrollContainer scroll-smooth overscroll-contain flex-1 noScrollBar h-dvh overflow-y-visible overflow-x-hidden relative`}
      style={{ scrollPaddingTop: `${navHeight}px` }}
    >
      <NavBar />

      <TagsBlock setLocationState={setLocationState} />

      {locationState && (
        <RoteList
          // key={roteListKey}
          rotesHook={useFilterRotes}
          rotesDispatchHook={useFilterRotesDispatch}
          api={apiGetMyRote}
          apiProps={{
            limit: 20,
            filter: {
              tags: {
                hasEvery: locationState.tags || [],
              },
            },
          }}
        />
      )}

      <GoTop scrollContainerName="scrollContainer" />
    </div>
  );
}

export default MineFilter;
