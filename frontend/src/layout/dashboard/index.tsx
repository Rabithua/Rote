import { logOut } from "@/api/login/main";
import { getMyProfile } from "@/api/user/main";
import { Profile } from "@/types/main";
import { useAPIGet } from "@/utils/fetcher";
import {
  Archive,
  Globe2,
  Home,
  Loader,
  LogIn,
  LogOut,
  Snail,
  User,
} from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Link, Outlet, useLocation } from "react-router-dom";

interface IconType {
  svg: JSX.Element;
  link?: string;
  name: string;
  callback?: () => void;
}

function LayoutDashboard() {
  const location = useLocation();
  const { data: profile, isLoading, mutate } = useAPIGet<Profile>(
    "profile",
    getMyProfile,
  );

  const { t } = useTranslation("translation", { keyPrefix: "pages.mine" });

  const iconsData: IconType[][] = [
    [
      {
        svg: <Home className="size-4" />,
        link: "/home",
        name: "home",
      },
      {
        svg: <Globe2 className="size-4" />,
        link: "/explore",
        name: "explore",
      },

      {
        svg: <Archive className="size-4" />,
        link: "/archived",
        name: "archived",
      },
      {
        svg: <User className="size-4" />,
        link: "/profile",

        name: "profile",
      },
      {
        svg: <Snail className="size-4" />,
        link: "/experiment",
        name: "experiment",
      },
      {
        svg: <LogOut className="size-4" />,
        name: "logout",
        callback: logOutFn,
      },
    ],
    [
      {
        svg: <LogIn className="size-4" />,
        link: "/login",
        name: "login",
      },
    ],
  ];

  function logOutFn() {
    const toastId = toast.loading(t("messages.loggingOut"));
    logOut()
      .then(() => {
        toast.success(t("messages.logoutSuccess"), {
          id: toastId,
        });

        mutate();
      })
      .catch((err) => {
        console.log(err);
        toast.error("err.response.data.data.msg", {
          id: toastId,
        });
      });
  }

  function IconRenderItem(icon: IconType) {
    return icon.link
      ? (
        <Link key={icon.link} to={icon.link}>
          <div
            className={` hover:bg-[#00000010] dark:hover:bg-[#ffffff10] cursor-pointer duration-300 text-base flex gap-2 items-center justify-center px-3 p-2 rounded-full ${
              location.pathname === icon.link
                ? " bg-bgDark text-textDark hover:bg-bgDark dark:hover:bg-bgLight dark:bg-bgLight dark:text-textLight"
                : ""
            } `}
          >
            {icon.svg}
            <div className=" shrink-0 hidden tracking-widest lg:block">
              {t(`leftNavBar.${icon.name}`)}
            </div>
          </div>
        </Link>
      )
      : (
        <div
          key={icon.name}
          className={` hover:bg-[#00000010] dark:hover:bg-[#ffffff10] cursor-pointer duration-300 text-base flex gap-2 items-center justify-center px-3 p-2 rounded-full ${
            location.pathname === icon.link
              ? " bg-bgDark text-textDark hover:bg-bgDark dark:hover:bg-bgLight dark:bg-bgLight dark:text-textLight"
              : ""
          } ${icon.name === "logout" ? "hover:text-red-600 hover:bg-red-600/10" : ""} `}
          onClick={() => {
            icon.callback && icon.callback();
          }}
        >
          {icon.svg}
          <div className=" shrink-0 hidden tracking-widest lg:block">
            {t(`leftNavBar.${icon.name}`)}
          </div>
        </div>
      );
  }

  return (
    <div className=" bg-bgLight mx-auto max-w-6xl w-full text-textLight w-full dark:bg-bgDark dark:text-textDark">
      <div className=" max-w-[1440px] lg:w-[90%] font-sans flex mx-auto ">
        <div className=" sm:sticky sm:top-0 fixed border-t border-r-0 sm:border-t-0 py-2 pb-5 z-10 bottom-0 w-full sm:w-fit bg-bgLight/90 text-textLight dark:bg-bgDark/90 dark:text-textDark flex-row justify-around sm:h-dvh flex lg:w-[200px] px-1 sm:px-2 lg:px-4 shrink-0 sm:border-r border-opacityLight dark:border-opacityDark sm:flex-col sm:gap-4 backdrop-blur-2xl items-start sm:justify-center">
          {isLoading
            ? (
              <div
                className={` cursor-pointer duration-300 text-base flex gap-2 items-center justify-center px-3 p-2 rounded-full`}
              >
                <Loader className="size-6 animate-spin" />
              </div>
            )
            : profile
            ? iconsData[0].map((icon) => {
              return IconRenderItem(icon);
            })
            : iconsData[1].map((icon) => {
              return IconRenderItem(icon);
            })}
        </div>

        <div className=" flex-1 overflow-x-hidden relative">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default LayoutDashboard;
