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
    <div className=" w-72 shrink-0 relative hidden md:block">
      <div className="p-4 h-dvh w-72 fixed top-0 overflow-y-scroll noScrollBar hidden md:block">
        <div className="gap-4 w-full sticky top-0 flex flex-col">
          <div className="flex gap-2 text-lg font-semibold">
            <BarChartOutlined />
            {t("statistics")}
          </div>
          <Heatmap />
          <TagMap />
          <RandomRote />
        </div>
      </div>
    </div>
  );
};

function RotePage() {
  const { t } = useTranslation("translation", { keyPrefix: "pages.home" });

  return (
    <div className="flex w-full">
      <div className="border-r border-opacityLight dark:border-opacityDark flex-1 overflow-x-hidden relative">
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
        <GoTop />
      </div>
      <Statistics t={t} />
    </div>
  );
}

export default RotePage;
