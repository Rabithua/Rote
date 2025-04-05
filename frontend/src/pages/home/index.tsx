import { apiGetMyRote } from "@/api/rote/main";
import slogenImg from "@/assets/img/slogen.svg";
import Heatmap from "@/components/d3/heatmap";
import FloatBtns from "@/components/FloatBtns";
import { SideContentLayout } from "@/components/layout/SideContentLayout";
import Logo from "@/components/logo";
import RandomRote from "@/components/randomRote";
import RoteInputSimple from "@/components/roteInputSimple";
import RoteList from "@/components/roteList";
import TagMap from "@/components/tagMap";
import { Drawer } from "antd";
import { ChartAreaIcon, ChartLine } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

const SideBar = () => {
  return (
    <div className="gap-4 w-full sticky top-0 flex flex-col">
      <Heatmap />
      <TagMap />
      <RandomRote />
    </div>
  );
};

function HomePage() {
  const { t } = useTranslation("translation", { keyPrefix: "pages.home" });
  const [drawOpen, setDrawOpen] = useState(false);

  return (
    <div className="flex w-full min-h-screen">
      <div className="md:border-r border-opacityLight dark:border-opacityDark flex-1 overflow-x-hidden relative pb-20 sm:pb-0">
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
      </div>

      <SideContentLayout>
        <div className="flex gap-2 text-lg mb-4 items-center font-semibold">
          <ChartAreaIcon className="size-5" />
          {t("statistics")}
        </div>
        <SideBar />
      </SideContentLayout>

      <FloatBtns>
        <div
          className="bg-bgDark dark:bg-bgLight w-fit py-2 px-4 rounded-md text-textDark dark:text-textLight cursor-pointer hover:scale-105 duration-300  md:hidden block"
          onClick={() => setDrawOpen(!drawOpen)}
        >
          <ChartLine className="size-4" />
        </div>
      </FloatBtns>

      <Drawer
        open={drawOpen}
        onClose={() => setDrawOpen(false)}
        placement="bottom"
        height={"80%"}
        title={t("statistics")}
      >
        <SideBar />
      </Drawer>
    </div>
  );
}

export default HomePage;
