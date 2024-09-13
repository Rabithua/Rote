import { ExperimentOutlined } from "@ant-design/icons";
import NavHeader from "@/components/navHeader";
import ExportData from "@/components/experiment/exportData";
import ImportData from "@/components/experiment/importData";
import ServiceWorker from "@/components/experiment/serviceWorker";

export default function ExperimentPage() {
  return (
    <div
      className={` scrollContainer scroll-smooth overscroll-contain flex-1 noScrollBar h-dvh overflow-y-visible overflow-x-hidden relative`}
    >
      <NavHeader title="实验室 / Experimanet" icon={<ExperimentOutlined />} />
      <div className=" flex flex-col w-full gap-1">
        <div className=" bg-opacityLight dark:bg-opacityDark m-2 py-3 px-4 rounded-lg">
          实验性质小功能，有可能会让rote变得更好用🤩
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
