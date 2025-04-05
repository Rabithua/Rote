import { apiGetPublicRote } from "@/api/rote/main";
import FloatBtns from "@/components/FloatBtns";
import { SideContentLayout } from "@/components/layout/SideContentLayout";
import LoadingPlaceholder from "@/components/LoadingPlaceholder";
import NavHeader from "@/components/navHeader";
import RandomCat from "@/components/RandomCat";
import RoteList from "@/components/roteList";
import { formatTimeAgo } from "@/utils/main";
import { Drawer } from "antd";
import {
  Eye,
  GitFork,
  Github,
  Globe2,
  MessageCircleQuestionIcon,
  Star,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import useSWR from "swr";
const fetcher = (url: string) => fetch(url).then((res) => res.json());

function ExplorePage() {
  const { t } = useTranslation("translation", { keyPrefix: "pages.explore" });

  const [drawOpen, setDrawOpen] = useState(false);

  const SideBar = () => {
    const { data: roteGithubData, isLoading: isRoteGithubDataLoading } = useSWR(
      "https://api.github.com/repos/rabithua/rote",
      fetcher,
    );

    const dataRender = [
      {
        key: "stargazers_count",
        icon: <Star className="size-4" />,
        title: t("star"),
      },
      {
        key: "forks_count",
        icon: <GitFork className="size-4" />,
        title: t("fork"),
      },
      {
        key: "open_issues_count",
        icon: <MessageCircleQuestionIcon className="size-4" />,
        title: t("issues"),
      },
      {
        key: "watchers_count",
        icon: <Eye className="size-4" />,
        title: t("watch"),
      },
    ];

    return (
      <div className="gap-4 w-full flex flex-col">
        {isRoteGithubDataLoading
          ? (
            <LoadingPlaceholder
              className=" py-8"
              size={6}
            />
          )
          : (
            <Link
              target="_blank"
              to={roteGithubData.html_url}
              className=" flex flex-col gap-2"
            >
              <div className="text-sm font-thin">
                Rote 已在 Github 开源，欢迎 Star!
              </div>
              <div className=" grid grid-cols-2 justify-between gap-2 w-4/5">
                {dataRender.map((item) => (
                  <div
                    key={item.key}
                    className="flex gap-2 items-center"
                  >
                    {item.icon}
                    <div className="text-sm">
                      {roteGithubData[item.key]} {item.title}
                    </div>
                  </div>
                ))}
              </div>
              <div className="">
                上次推送时间：{formatTimeAgo(roteGithubData.pushed_at)}
              </div>
            </Link>
          )}

        <div className="font-semibold border-t pt-4">
          EveDayOneCat <br />
          <div className=" font-normal text-sm text-gray-500">
            <Link
              to={"http://motions.cat/index.html"}
              target="_blank"
            >
              From: http://motions.cat/index.html
            </Link>
          </div>
        </div>
        <RandomCat />
        <div>Click img to random one cat.</div>
      </div>
    );
  };

  return (
    <div className="flex w-full min-h-screen">
      <div
        className={`md:border-r border-opacityLight dark:border-opacityDark flex-1 noScrollBar overflow-y-visible overflow-x-hidden relative`}
      >
        <NavHeader title={t("title")} icon={<Globe2 className="size-6" />} />

        <RoteList
          api={apiGetPublicRote}
          apiProps={{
            limit: 20,
            filter: {},
          }}
        />
      </div>
      <FloatBtns>
        <div
          className="bg-bgDark dark:bg-bgLight w-fit py-2 px-4 rounded-md text-textDark dark:text-textLight cursor-pointer hover:scale-105 duration-300  md:hidden block"
          onClick={() => setDrawOpen(!drawOpen)}
        >
          <Globe2 className="size-4" />
        </div>
      </FloatBtns>
      <SideContentLayout>
        <div className="flex gap-2 text-lg mb-4 font-semibold items-center">
          <Github className="size-5" />
          {t("sideBarTitle")}
        </div>
        <SideBar />
      </SideContentLayout>

      <Drawer
        open={drawOpen}
        onClose={() => setDrawOpen(false)}
        placement="bottom"
        height={"80%"}
        title={t("sideBarTitle")}
      >
        <SideBar />
      </Drawer>
    </div>
  );
}

export default ExplorePage;
