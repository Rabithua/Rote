import { logOut } from "@/api/login/main";
import { useProfile } from "@/state/profile";
import { useShowLeftNav } from "@/state/showLeftNav";
import {
  ExperimentOutlined,
  GlobalOutlined,
  HomeOutlined,
  InboxOutlined,
  LoginOutlined,
  LogoutOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Link, Outlet, useLocation } from "react-router-dom";

function LayoutDashboard() {
  const location = useLocation();
  const [profile, setProfile] = useProfile();
  const [ifshowLeftNav, setIfshowLeftNav] = useShowLeftNav();

  const { t } = useTranslation("translation", { keyPrefix: "pages.mine" });

  const [icons, setIcons] = useState([
    {
      svg: <LoginOutlined />,
      link: "/login",

      name: "login",
    },
  ]);

  useEffect(() => {
    if (profile) {
      setIcons([
        {
          svg: <HomeOutlined />,
          link: "/home",

          name: "home",
        },
        {
          svg: <GlobalOutlined />,
          link: "/explore",

          name: "explore",
        },

        {
          svg: <InboxOutlined />,
          link: "/archived",

          name: "archived",
        },
        {
          svg: <UserOutlined />,
          link: "/profile",

          name: "profile",
        },
        {
          svg: <ExperimentOutlined />,
          link: "/experiment",

          name: "experiment",
        },
      ]);
    } else {
      setIcons([
        {
          svg: <LoginOutlined />,
          link: "/login",

          name: "login",
        },
      ]);
    }
  }, [profile]);

  function changeLeftNavVb() {
    setIfshowLeftNav(!ifshowLeftNav);
  }

  function logOutFn() {
    const toastId = toast.loading(t("messages.loggingOut"));
    logOut()
      .then(() => {
        toast.success(t("messages.logoutSuccess"), {
          id: toastId,
        });

        setProfile(null);
      })
      .catch((err) => {
        console.log(err);
        toast.error("err.response.data.data.msg", {
          id: toastId,
        });
      });
  }

  return (
    <div className=" bg-bgLight text-textLight w-full dark:bg-bgDark dark:text-textDark">
      <div className=" max-w-[1440px] lg:w-[90%] font-sans flex mx-auto">
        <div className=" sm:sticky sm:top-0 fixed border-t border-r-0 sm:border-t-0 py-2 z-10 bottom-0 w-full sm:w-fit bg-bgLight text-textLight dark:bg-bgDark dark:text-textDark flex-row justify-around sm:h-dvh flex lg:w-[200px] px-1 sm:px-2 lg:px-4 shrink-0 sm:border-r border-opacityLight dark:border-opacityDark sm:flex-col sm:gap-4 items-start sm:justify-center">
          {icons.map((icon, index) => {
            return (
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
            );
          })}

          {profile && (
            <div
              className={` hover:bg-[#00000010] dark:hover:bg-[#ffffff10] cursor-pointer duration-300 text-base flex gap-2 items-center justify-center px-3 p-2 rounded-full`}
              onClick={logOutFn}
            >
              <LogoutOutlined />
              <div className=" shrink-0 hidden tracking-widest lg:block">
                {t(`leftNavBar.logout`)}
              </div>
            </div>
          )}
        </div>

        <div className=" flex-1 noScrollBar overflow-y-visible overflow-x-hidden relative">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default LayoutDashboard;
