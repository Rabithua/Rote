import { useTranslation } from "react-i18next";
import { Link, Outlet } from "react-router-dom";
import {
  ExperimentOutlined,
  InboxOutlined,
  GlobalOutlined,
  HomeOutlined,
  LoginOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useEffect, useState } from "react";
import { useProfile } from "@/state/profile";

function LayoutDashboard() {
  const profile = useProfile();
  const [ifshowLeftNav, setIfshowLeftNav] = useState(
    window.localStorage.getItem("ifshowLeftNav") === "false" ? false : true
  );
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
    window.localStorage.setItem("ifshowLeftNav", `${!ifshowLeftNav}`);
  }

  return (
    <div className=" bg-bgLight text-textLight w-full h-dvh dark:bg-bgDark dark:text-textDark">
      <div className=" max-w-[1440px] lg:w-[90%] font-sans flex mx-auto">
        {ifshowLeftNav ? (
          <div className=" sticky top-0 flex lg:w-[200px] px-1 sm:px-2 lg:px-4 shrink-0 border-r border-opacityLight dark:border-opacityDark flex-col gap-4 items-start justify-center">
            {icons.map((icon, index) => {
              return (
                <Link key={`leftLinks_${index}`} to={icon.link}>
                  <div
                    className={` hover:bg-[#00000010] dark:hover:bg-[#ffffff10] cursor-pointer duration-300 text-base flex gap-2 items-center justify-center px-3 p-2 rounded-full ${
                      window.location.pathname.includes(icon.link)
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
            <div
              className=" absolute bottom-8 flex cursor-pointer duration-300 sm:hidden gap-2 items-center justify-center px-3 p-1 rounded-full hover:bg-[#00000010] dark:hover:bg-[#ffffff10]"
              onClick={changeLeftNavVb}
            >
              <div className=" w-8 h-8 p-1 shrink-0 text-base">
                <MenuUnfoldOutlined />
              </div>
              <div className=" shrink-0 hidden tracking-widest lg:block">
                {t(`leftNavBar.fold`)}
              </div>
            </div>
          </div>
        ) : (
          <div
            className=" sm:hidden active:scale-95 z-10 fixed bottom-8 left-0 px-4 py-2 rounded-r-md bg-bgDark dark:bg-bgLight text-bgLight dark:text-bgDark"
            onClick={changeLeftNavVb}
          >
            <MenuUnfoldOutlined />
          </div>
        )}
        <div className=" flex-1 noScrollBar h-dvh noScrollBar overflow-y-visible overflow-x-hidden relative">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default LayoutDashboard;
