import { useTranslation } from "react-i18next";
import { Outlet, useNavigate } from "react-router-dom";
import {
  BellOutlined,
  HomeOutlined,
  MenuUnfoldOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { useState } from "react";

function LayoutDashboadrd() {
  const navigate = useNavigate();
  const [ifshowLeftNav, setIfshowLeftNav] = useState(true);
  const { t } = useTranslation("translation", { keyPrefix: "pages.mine" });
  const icons = [
    {
      svg: <HomeOutlined className=" text-xl" />,
      link: "/mine",
    },
    {
      svg: <BellOutlined className=" text-xl" />,
      link: "/#",
    },
    {
      svg: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
          <path
            d="M24 28C26.2091 28 28 26.2091 28 24C28 21.7909 26.2091 20 24 20C21.7909 20 20 21.7909 20 24C20 26.2091 21.7909 28 24 28Z"
            stroke="#171717"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M40 36C42.52 32.66 44 28.5 44 24C44 19.5 42.52 15.34 40 12"
            stroke="#171717"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M8 12C5.48 15.34 4 19.5 4 24C4 28.5 5.48 32.66 8 36"
            stroke="#171717"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M33.6 31.1998C35.1 29.1998 36 26.6998 36 23.9998C36 21.2998 35.1 18.7998 33.6 16.7998"
            stroke="#171717"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M14.4 16.7998C12.9 18.7998 12 21.2998 12 23.9998C12 26.6998 12.9 29.1998 14.4 31.1998"
            stroke="#171717"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
      link: "/#",
    },
    {
      svg: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
          <path
            d="M24 44C35.0457 44 44 35.0457 44 24C44 12.9543 35.0457 4 24 4C12.9543 4 4 12.9543 4 24C4 35.0457 12.9543 44 24 44Z"
            stroke="#171717"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M16 6H18C14.1 17.68 14.1 30.32 18 42H16"
            stroke="#171717"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M30 6C33.9 17.68 33.9 30.32 30 42"
            stroke="#171717"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M6 32V30C17.68 33.9 30.32 33.9 42 30V32"
            stroke="#171717"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M6 18.0002C17.68 14.1002 30.32 14.1002 42 18.0002"
            stroke="#171717"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
      link: "/#",
    },

    {
      svg: <SaveOutlined className=" text-xl" />,
      link: "/#",
    },
    {
      svg: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
          <path
            d="M38 18C38 20.9 37.14 23.56 35.66 25.78C33.5 28.98 30.08 31.24 26.1 31.82C25.42 31.94 24.72 32 24 32C23.28 32 22.58 31.94 21.9 31.82C17.92 31.24 14.5 28.98 12.34 25.78C10.86 23.56 10 20.9 10 18C10 10.26 16.26 4 24 4C31.74 4 38 10.26 38 18Z"
            stroke="#171717"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M42.5 36.9398L39.2 37.7198C38.46 37.8998 37.88 38.4598 37.72 39.1998L37.02 42.1398C36.64 43.7398 34.6 44.2198 33.54 42.9598L24 31.9998L14.46 42.9798C13.4 44.2398 11.36 43.7598 10.98 42.1598L10.28 39.2198C10.1 38.4798 9.52004 37.8998 8.80004 37.7398L5.50004 36.9598C3.98004 36.5998 3.44004 34.6998 4.54004 33.5998L12.34 25.7998C14.5 28.9998 17.92 31.2598 21.9 31.8398C22.58 31.9598 23.28 32.0198 24 32.0198C24.72 32.0198 25.42 31.9598 26.1 31.8398C30.08 31.2598 33.5 28.9998 35.66 25.7998L43.46 33.5998C44.56 34.6798 44.02 36.5798 42.5 36.9398Z"
            stroke="#171717"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M25.1599 11.96L26.3399 14.32C26.4999 14.64 26.9199 14.96 27.2999 15.02L29.4399 15.38C30.7999 15.6 31.1199 16.6 30.1399 17.58L28.4799 19.24C28.1999 19.52 28.0399 20.06 28.1399 20.46L28.6199 22.52C28.9999 24.14 28.1399 24.78 26.6999 23.92L24.6999 22.74C24.3399 22.52 23.7399 22.52 23.3799 22.74L21.3799 23.92C19.9399 24.76 19.0799 24.14 19.4599 22.52L19.9399 20.46C20.0199 20.08 19.8799 19.52 19.5999 19.24L17.9399 17.58C16.9599 16.6 17.2799 15.62 18.6399 15.38L20.7799 15.02C21.1399 14.96 21.5599 14.64 21.7199 14.32L22.8999 11.96C23.4799 10.68 24.5199 10.68 25.1599 11.96Z"
            stroke="#171717"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
      link: "/#",
    },
    {
      svg: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
          <path
            d="M24.2399 25.56C24.0999 25.54 23.9199 25.54 23.7599 25.56C20.2399 25.44 17.4399 22.56 17.4399 19.02C17.4399 15.4 20.3599 12.46 23.9999 12.46C27.6199 12.46 30.5599 15.4 30.5599 19.02C30.5399 22.56 27.7599 25.44 24.2399 25.56Z"
            stroke="#171717"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M37.48 38.7601C33.92 42.0201 29.2 44.0001 24 44.0001C18.8 44.0001 14.08 42.0201 10.52 38.7601C10.72 36.8801 11.92 35.0401 14.06 33.6001C19.54 29.9601 28.5 29.9601 33.94 33.6001C36.08 35.0401 37.28 36.8801 37.48 38.7601Z"
            stroke="#171717"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M24 44C35.0457 44 44 35.0457 44 24C44 12.9543 35.0457 4 24 4C12.9543 4 4 12.9543 4 24C4 35.0457 12.9543 44 24 44Z"
            stroke="#171717"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
      link: "/#",
    },
  ];

  function changeLeftNavVb() {
    setIfshowLeftNav(!ifshowLeftNav);
  }

  return (
    <div className=" bg-bgWhite dark:text-white dark:bg-bgDark w-full min-h-screen">
      <div className=" max-w-[1440px] lg:w-[90%] font-sans flex mx-auto">
        {ifshowLeftNav ? (
          <div className=" sticky top-0 duration-300 flex md:w-[150px] px-1 sm:px-2 md:px-5 shrink-0 border-r border-[#00000010] flex-col gap-4 items-center justify-center">
            {icons.map((icon, index) => {
              return (
                <div
                  className=" cursor-pointer duration-300 flex gap-2 items-center justify-center px-3 p-1 rounded-full hover:bg-[#00000010]"
                  key={`leftLinks_${index}`}
                  onClick={() => {
                    navigate(icon.link);
                  }}
                >
                  <div className=" w-8 h-8 p-1 shrink-0">{icon.svg}</div>
                  <div className=" shrink-0 hidden tracking-widest md:block">
                    {t(`leftNavBar.${index}`)}
                  </div>
                </div>
              );
            })}
            <div
              className=" absolute bottom-8 flex cursor-pointer duration-300 sm:hidden gap-2 items-center justify-center px-3 p-1 rounded-full hover:bg-[#00000010]"
              onClick={changeLeftNavVb}
            >
              <div className=" w-8 h-8 p-1 shrink-0">
                <MenuUnfoldOutlined className=" text-xl" />
              </div>
              <div className=" shrink-0 hidden tracking-widest md:block">
                {t(`leftNavBar.${icons.length}`)}
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
        <div className=" flex-1 noScrollBar h-screen overflow-y-visible overflow-x-hidden relative">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default LayoutDashboadrd;
