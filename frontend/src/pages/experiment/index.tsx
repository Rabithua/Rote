import ExportData from "@/components/experiment/exportData";
import ImportData from "@/components/experiment/importData";
import ServiceWorker from "@/components/experiment/serviceWorker";
import NavHeader from "@/components/navHeader";
import { ExperimentOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";

export default function ExperimentPage() {
  const { t } = useTranslation("translation", {
    keyPrefix: "pages.experiment",
  });
  return (
    <div
      className={`flex-1 noScrollBar overflow-y-visible overflow-x-hidden relative`}
    >
      <NavHeader
        title={`${t("title")} / Experiment`}
        icon={<ExperimentOutlined />}
      />
      <div className=" flex flex-col w-full gap-1">
        <div className=" bg-opacityLight dark:bg-opacityDark m-2 py-3 px-4 rounded-lg">
          {t("description")}
        </div>
        <div className=" m-2 flex gap-2 flex-wrap">
          <ServiceWorker />
          <ExportData />
          <ImportData />
        </div>
      </div>
      <div id="top" className=" h-[1px]"></div>
    </div>
  );
}
