import { GlobalOutlined } from "@ant-design/icons";
import { apiGetPublicRote } from "@/api/rote/main";
import { useExploreRotes, useExploreRotesDispatch } from "@/state/exploreRotes";
import RoteList from "@/components/roteList";
import GoTop from "@/components/goTop";
import NavHeader from "@/components/navHeader";
import { useTranslation } from "react-i18next";

function ExplorePage() {
  const { t } = useTranslation("translation", { keyPrefix: "pages.explore" });

  return (
    <div
      className={` scrollContainer scroll-smooth overscroll-contain flex-1 noScrollBar h-dvh overflow-y-visible overflow-x-hidden relative`}
    >
      <NavHeader title={t("title")} icon={<GlobalOutlined />} />
      <div id="top" className=" h-[1px]"></div>

      <RoteList
        rotesHook={useExploreRotes}
        rotesDispatchHook={useExploreRotesDispatch}
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
