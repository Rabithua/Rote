import { apiGetMyRote } from "@/api/rote/main";
import NavHeader from "@/components/navHeader";
import RoteList from "@/components/roteList";
import { Archive } from "lucide-react";
import { useTranslation } from "react-i18next";

function ArchivedPage() {
  const { t } = useTranslation();

  return (
    <div
      className={`flex-1 noScrollBar overflow-y-visible overflow-x-hidden relative`}
    >
      <NavHeader
        title={t("pages.archived.title")}
        icon={<Archive className="size-6" />}
      />
      <div id="top" className=" h-[1px]"></div>

      <RoteList
        api={apiGetMyRote}
        apiProps={{
          limit: 20,
          archived: true,
        }}
      />
    </div>
  );
}

export default ArchivedPage;
