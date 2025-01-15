import { apiGetMyRote } from "@/api/rote/main";
import GoTop from "@/components/goTop";
import NavHeader from "@/components/navHeader";
import RoteList from "@/components/roteList";
import { InboxOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";

function ArchivedPage() {
  const { t } = useTranslation();

  return (
    <div
      className={`flex-1 noScrollBar overflow-y-visible overflow-x-hidden relative`}
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

      <GoTop />
    </div>
  );
}

export default ArchivedPage;
