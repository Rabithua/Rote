import EveCat from "@/components/experiment/EveCat";
import ExportData from "@/components/experiment/exportData";
import ImportData from "@/components/experiment/importData";
import ServiceWorker from "@/components/experiment/serviceWorker";
import NavHeader from "@/components/navHeader";
import { Snail } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function ExperimentPage() {
  const { t } = useTranslation("translation", {
    keyPrefix: "pages.experiment",
  });
  return (
    <div className="flex-1 noScrollBar overflow-y-visible overflow-x-hidden relative pb-20">
      <NavHeader
        title={`${t("title")} / Experiment`}
        icon={<Snail className="size-6" />}
      />
      <div className=" flex flex-col w-full gap-1">
        <div className=" py-3 px-4 border-b font-thin">
          {t("description")}
        </div>
        <div className=" flex flex-wrap">
          <ServiceWorker />
          <ExportData />
          <ImportData />
          <EveCat />
        </div>
      </div>
    </div>
  );
}
