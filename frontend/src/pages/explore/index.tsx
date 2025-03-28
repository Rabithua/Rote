import { apiGetPublicRote } from "@/api/rote/main";
import NavHeader from "@/components/navHeader";
import RoteList from "@/components/roteList";
import { formatTimeAgo } from "@/utils/main";
import {
  Eye,
  GitFork,
  Github,
  Globe2,
  Loader,
  MessageCircleQuestionIcon,
  Star,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import useSWR from "swr";
const fetcher = (url: string) => fetch(url).then((res) => res.json());

function ExplorePage() {
  const { t } = useTranslation("translation", { keyPrefix: "pages.explore" });

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
      <div className=" w-72 shrink-0 relative hidden md:block">
        <div className="p-4 h-dvh w-72 fixed top-0 overflow-y-scroll noScrollBar hidden md:block">
          <div className="gap-4 w-full sticky top-0 flex flex-col">
            <div className="flex gap-2 text-lg font-semibold items-center">
              <Github className="size-5" />
              {t("sideBarTitle")}
            </div>
            {isRoteGithubDataLoading
              ? (
                <div className=" flex justify-center text-lg items-center py-8 gap-3 bg-bgLight dark:bg-bgDark">
                  <Loader className="animate-spin size-6" />
                </div>
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
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex w-full min-h-screen">
      <div
        className={`md:border-r border-opacityLight dark:border-opacityDark flex-1 noScrollBar overflow-y-visible overflow-x-hidden relative`}
      >
        <NavHeader title={t("title")} icon={<Globe2 className="size-6" />} />
        <div id="top" className=" h-[1px]"></div>

        <RoteList
          api={apiGetPublicRote}
          apiProps={{
            limit: 20,
            filter: {},
          }}
        />
      </div>
      <SideBar />
    </div>
  );
}

export default ExplorePage;
