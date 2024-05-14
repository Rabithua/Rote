import { GlobalOutlined } from "@ant-design/icons";
import { apiGetPublicRote } from "@/api/rote/main";
import { useExploreRotes, useExploreRotesDispatch } from "@/state/exploreRotes";
import RoteList from "@/components/roteList";
import GoTop from "@/components/goTop";

function ExplorePage() {
  // const { t } = useTranslation("translation", { keyPrefix: "pages.mine" });

  const rotes = useExploreRotes();
  const rotesDispatch = useExploreRotesDispatch();

  
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

      <RoteList
        rotes={rotes}
        rotesDispatch={rotesDispatch}
        api={apiGetPublicRote}
        apiProps={{
          limit: 20,
          filter: {},
        }}
      />

      <GoTop scrollContainerName="scrollContainer" />
    </div>
  );
}

export default ExplorePage;
