import { apiGetMyRote } from "@/api/rote/main";
import GoTop from "@/components/goTop";
import NavBar from "@/components/navBar";
import RoteList from "@/components/roteList";
import { useTags } from "@/state/tags";
import { Tag } from "@/types/main";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";

function MineFilter() {
  const { t } = useTranslation("translation", { keyPrefix: "pages.filter" });

  const [tags, setTags] = useTags();
  const location = useLocation();
  const [filter, setFilter] = useState({
    tags: {
      hasEvery: location.state.tags || [],
    },
  });

  const [navHeight, setNavHeight] = useState(0);

  useEffect(() => {
    const element = document.getElementById("top") as HTMLElement;
    setNavHeight(element.offsetHeight || 0);

    return () => {};
  }, []);

  function TagsBlock() {
    const tagsClickHandler = (tag: string) => {
      setFilter((prevState) => {
        const newTags = prevState.tags.hasEvery.includes(tag)
          ? prevState.tags.hasEvery.filter((t: any) => t !== tag)
          : [...prevState.tags.hasEvery, tag];

        return {
          ...prevState,
          tags: {
            ...prevState.tags,
            hasEvery: newTags,
          },
        };
      });
    };

    return (
      <div
        className=" bg-opacityLight dark:bg-opacityDark p-4 font-semibold"
        id="top"
      >
        <div className=" flex items-center flex-wrap gap-2 my-2">
          {t("includeTags")}
          {filter.tags.hasEvery.length > 0
            ? filter.tags.hasEvery.map((tag: any, index: any) => {
                return (
                  <div
                    className=" cursor-pointer font-normal px-2 py-1 text-xs rounded-md bg-opacityLight dark:bg-opacityDark duration-300 hover:scale-95"
                    key={`tag-${index}`}
                    onClick={() => tagsClickHandler(tag)}
                  >
                    {tag}
                  </div>
                );
              })
            : t("none")}
        </div>
        <div className=" flex items-center flex-wrap max-h-[25vh] overflow-y-scroll gap-2 my-2 font-normal text-gray-500">
          {t("allTags")}
          {tags.length > 0
            ? tags.map((tag: Tag, index: any) => {
                return (
                  <div
                    key={`AllTags-${index}`}
                    onClick={() => tagsClickHandler(tag.value)}
                  >
                    <div className=" cursor-pointer font-normal px-2 py-1 text-xs rounded-md border-[1px] dark:border-opacityDark duration-300 hover:scale-95">
                      {tag.value}
                    </div>
                  </div>
                );
              })
            : t("none")}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex-1 noScrollBar overflow-y-visible overflow-x-hidden relative`}
      style={{ scrollPaddingTop: `${navHeight}px` }}
    >
      <NavBar />

      <TagsBlock />

      <RoteList
        api={apiGetMyRote}
        apiProps={{
          limit: 20,
          filter,
        }}
      />

      <GoTop />
    </div>
  );
}

export default MineFilter;
