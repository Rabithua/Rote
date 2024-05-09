import { useTranslation } from "react-i18next";
import { Outlet, useNavigate } from "react-router-dom";
import {
  ExperimentOutlined,
  GlobalOutlined,
  HomeOutlined,
  LoginOutlined,
  MenuUnfoldOutlined,
  SaveOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useEffect, useState } from "react";
import { useProfile } from "@/state/profile";

function LayoutDashboard() {
  const navigate = useNavigate();
  const profile = useProfile();
  const [ifshowLeftNav, setIfshowLeftNav] = useState(
    window.localStorage.getItem("ifshowLeftNav") === "false" ? false : true
  );
  const { t } = useTranslation("translation", { keyPrefix: "pages.mine" });
  const [icons, setIcons] = useState([
    {
      svg: <LoginOutlined />,
      link: "/login",
      disable: false,
      name: "login",
    },
  ]);

  useEffect(() => {
    if (profile) {
      setIcons([
        {
          svg: <HomeOutlined />,
          link: "/home",
          disable: false,
          name: "home",
        },
        // {
        //   svg: <BellOutlined />,
        //   link: "/#",
        //   disable: true,
        // },
        // {
        //   svg: <WifiOutlined />,
        //   link: "/#",
        //   disable: true,
        // },
        {
          svg: <GlobalOutlined />,
          link: "/explore",
          disable: false,
          name: "explore",
        },

        {
          svg: <SaveOutlined />,
          link: "/archived",
          disable: false,
          name: "archived",
        },
        // {
        //   svg: <ThunderboltOutlined />,
        //   link: "/#",
        //   disable: true,
        // },
        {
          svg: <UserOutlined />,
          link: "/profile",
          disable: false,
          name: "profile",
        },
        {
          svg: <ExperimentOutlined />,
          link: "/experiment",
          disable: false,
          name: "experiment",
        },
      ]);
    } else {
      setIcons([
        {
          svg: <LoginOutlined />,
          link: "/login",
          disable: false,
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
    <div className=" bg-white w-full h-dvh">
      <div className=" max-w-[1440px] lg:w-[90%] font-sans flex mx-auto">
        {ifshowLeftNav ? (
          <div className=" border-t sticky top-0 duration-300 flex md:w-[150px] px-1 sm:px-2 md:px-5 shrink-0 border-r border-[#00000010] flex-col gap-4 items-center justify-center">
            {icons.map((icon, index) => {
              return (
                <div
                  className={` duration-300 text-base flex gap-2 items-center justify-center px-3 p-2 rounded-full hover:bg-[#00000010] ${
                    icon.disable ? "cursor-not-allowed" : "cursor-pointer"
                  }`}
                  key={`leftLinks_${index}`}
                  onClick={() => {
                    if (icon.disable) {
                      return;
                    }
                    navigate(icon.link);
                  }}
                >
                  {icon.svg}
                  <div className=" shrink-0 hidden tracking-widest md:block">
                    {t(`leftNavBar.${icon.name}`)}
                  </div>
                </div>
              );
            })}
            <div
              className=" absolute bottom-8 flex cursor-pointer duration-300 sm:hidden gap-2 items-center justify-center px-3 p-1 rounded-full hover:bg-[#00000010]"
              onClick={changeLeftNavVb}
            >
              <div className=" w-8 h-8 p-1 shrink-0 text-xl">
                <MenuUnfoldOutlined />
              </div>
              <div className=" shrink-0 hidden tracking-widest md:block">
                {t(`leftNavBar.fold`)}
              </div>
            </div>
          </div>
        ) : (
          <div
            className=" sm:hidden active:scale-95 z-10 fixed bottom-8 left-0 px-4 py-2 rounded-r-md bg-[#ffffff90] backdrop-blur-3xl text-black"
            onClick={changeLeftNavVb}
          >
            <MenuUnfoldOutlined />
          </div>
        )}
        <div className=" flex-1 noScrollBar h-dvh overflow-y-visible overflow-x-hidden relative">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default LayoutDashboard;
