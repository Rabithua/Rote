import { apiGetMyRote } from "@/api/rote/main";
import GoTop from "@/components/goTop";
import NavHeader from "@/components/navHeader";
import RoteList from "@/components/roteList";
import { InboxOutlined } from "@ant-design/icons";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

function ArchivedPage() {
  const { t } = useTranslation();

  return (
    <div
      className={` scrollContainer scroll-smooth overscroll-contain flex-1 noScrollBar h-dvh overflow-y-visible overflow-x-hidden relative`}
    >
      <NavHeader title={t("pages.archived.title")} icon={<InboxOutlined />} />
      <div id="top" className=" h-[1px]"></div>

      <RoteList
        api={apiGetMyRote}
        apiProps={{
          limit: 20,
          archived: true,
        }}
      />

      <GoTop scrollContainerName="scrollContainer" />
    </div>
  );
}

export default ArchivedPage;
