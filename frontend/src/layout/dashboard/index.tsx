import { logOut } from "@/api/login/main";
import { getMyProfile } from "@/api/user/main";
import LoadingPlaceholder from "@/components/LoadingPlaceholder";
import { Profile } from "@/types/main";
import { useAPIGet } from "@/utils/fetcher";
import {
  Archive,
  Globe2,
  Home,
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
  const {
    data: profile,
    isLoading,
    mutate,
  } = useAPIGet<Profile>("profile", getMyProfile);

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
    return icon.link ? (
      <Link
        key={icon.link}
        to={icon.link}
        onClick={() => {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      >
        <div
          className={`flex cursor-pointer items-center justify-center gap-2 rounded-full p-2 px-3 text-base duration-300 hover:bg-[#00000010] dark:hover:bg-[#ffffff10] ${
            location.pathname === icon.link
              ? "bg-bgDark text-textDark hover:bg-bgDark dark:bg-bgLight dark:text-textLight dark:hover:bg-bgLight"
              : ""
          } `}
        >
          {icon.svg}
          <div className="hidden shrink-0 tracking-widest lg:block">
            {t(`leftNavBar.${icon.name}`)}
          </div>
        </div>
      </Link>
    ) : (
      <div
        key={icon.name}
        className={`flex cursor-pointer items-center justify-center gap-2 rounded-full p-2 px-3 text-base duration-300 hover:bg-[#00000010] dark:hover:bg-[#ffffff10] ${
          location.pathname === icon.link
            ? "bg-bgDark text-textDark hover:bg-bgDark dark:bg-bgLight dark:text-textLight dark:hover:bg-bgLight"
            : ""
        } ${
          icon.name === "logout" ? "hover:bg-red-600/10 hover:text-red-600" : ""
        } `}
        onClick={() => {
          icon.callback && icon.callback();
        }}
      >
        {icon.svg}
        <div className="hidden shrink-0 tracking-widest lg:block">
          {t(`leftNavBar.${icon.name}`)}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl bg-bgLight text-textLight dark:bg-bgDark dark:text-textDark">
      <div className="mx-auto flex max-w-[1440px] font-sans lg:w-[90%]">
        <div className="fixed bottom-0 z-10 flex w-full shrink-0 flex-row items-start justify-around border-r-0 border-t border-opacityLight bg-bgLight/90 px-1 py-2 pb-5 text-textLight backdrop-blur-2xl sm:sticky sm:top-0 sm:h-dvh sm:w-fit sm:flex-col sm:justify-center sm:gap-4 sm:border-r sm:border-t-0 sm:px-2 lg:w-[200px] lg:px-4 dark:border-opacityDark dark:bg-bgDark/90 dark:text-textDark">
          {isLoading ? (
            <LoadingPlaceholder className="py-8" size={6} />
          ) : profile ? (
            iconsData[0].map((icon) => {
              return IconRenderItem(icon);
            })
          ) : (
            iconsData[1].map((icon) => {
              return IconRenderItem(icon);
            })
          )}
        </div>

        <div className="relative flex-1 overflow-x-hidden">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default LayoutDashboard;
