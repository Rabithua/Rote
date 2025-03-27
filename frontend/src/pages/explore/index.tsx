import { apiGetPublicRote } from "@/api/rote/main";
import GoTop from "@/components/goTop";
import NavHeader from "@/components/navHeader";
import RoteList from "@/components/roteList";
import { Globe2 } from "lucide-react";
import { useTranslation } from "react-i18next";

function ExplorePage() {
  const { t } = useTranslation("translation", { keyPrefix: "pages.explore" });

  return (
    <div
      className={`flex-1 noScrollBar overflow-y-visible overflow-x-hidden relative`}
    >
      <NavHeader title={t("title")} icon={<Globe2 className="size-6" />} />
      <div id="top" className=" h-[1px]"></div>

      <RoteList
        api={apiGetPublicRote}
        apiProps={{
          limit: 20,
          filter: {},
        }}
      />

      <GoTop />
    </div>
  );
}

export default ExplorePage;
