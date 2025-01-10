import { apiGetMyRote } from "@/api/rote/main";
import slogenImg from "@/assets/img/slogen.svg";
import Heatmap from "@/components/d3/heatmap";
import GoTop from "@/components/goTop";
import Logo from "@/components/logo";
import RandomRote from "@/components/randomRote";
import RoteInputSimple from "@/components/roteInputSimple";
import RoteList from "@/components/roteList";
import TagMap from "@/components/tagMap";
import { BarChartOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";

const Statistics = ({ t }: { t: (key: string) => string }) => {
  return (
    <div className="gap-4 hidden md:flex flex-col w-72 shrink-0 scrollContainer scroll-smooth overscroll-contain noScrollBar h-dvh overflow-y-visible overflow-x-hidden relative p-4">
      <div className="flex gap-2 text-lg font-semibold">
        <BarChartOutlined />
        {t("statistics")}
      </div>
      <Heatmap />
      <TagMap />
      <RandomRote />
    </div>
  );
};

function RotePage() {
  const { t } = useTranslation("translation", { keyPrefix: "pages.home" });

  return (
    <div className="flex w-full h-dvh">
      <div className="border-r border-opacityLight dark:border-opacityDark scrollContainer scroll-smooth overscroll-contain flex-1 noScrollBar h-dvh overflow-y-visible overflow-x-hidden relative">
        <div className="sticky top-0 z-10 cursor-pointer group rotypesNav border-y border-opacityLight dark:border-opacityDark flex items-center gap-2 text-gray-600 bg-bgLight dark:bg-bgDark font-light p-4 py-2">
          <Logo className=" w-24" color="#07C160" />
          <img
            className="group-hover:opacity-100 opacity-0 duration-300 mb-[2px] ml-2 text-green-600 h-4"
            src={slogenImg}
            alt="slogen"
          />
        </div>
        <RoteInputSimple />
        <RoteList
          api={apiGetMyRote}
          apiProps={{
            limit: 20,
            archived: false,
          }}
        />
        <GoTop scrollContainerName="scrollContainer" />
      </div>
      <Statistics t={t} />
    </div>
  );
}

export default RotePage;
