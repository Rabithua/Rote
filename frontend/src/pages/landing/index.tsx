import Logo from "@/components/logo";
import { useProfile } from "@/state/profile";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

function Landing() {
  const { t } = useTranslation("translation", { keyPrefix: "pages.landing" });
  const links = [
    {
      name: "login",
      href: "/login",
    },
    {
      name: "userGuide",
      href: "#",
    },
    {
      name: "github",
      href: "https://github.com/Rabithua/Rote",
    },
    {
      name: "blog",
      href: "https://rabithua.club",
    },
    // {
    //   name: "download",
    //   href: "/#",
    // },
    // {
    //   name: "donate",
    //   href: "/#",
    // },
  ];
  const [profile] = useProfile();

  return (
    <div className=" dark:text-white w-full min-h-dvh flex flex-col justify-center items-center">
      <div className=" w-[96%] max-w-[1080px] sm:w-[80%] mt-10 mb-4 h-full flex flex-col gap-5">
        {/* <LanguageSwitcher /> */}
        <div className=" flex items-center flex-wrap gap-6 px-5 z-10">
          <div className=" dark:invert">
            <Logo color="#07C160" />
          </div>
          <div className=" w-2 h-2 bg-[#ffca27] rounded-full"></div>
          <div className=" text-xl md:text-2xl">{t("poem")}</div>
        </div>
        <div className=" flex flex-col px-5 gap-2 md:gap-5 leading-relaxed z-10">
          <div className=" font-semibold flex flex-wrap items-center text-xl whitespace-pre-wrap">
            {t("types.0")} <span className=" px-2">/</span>
            {t("types.1")} <span className=" px-2">/</span>
            {t("types.2")} <span className=" px-2">/</span>
            {t("types.3")} <span className=" px-2">/</span>
            {t("types.4")}
          </div>
          <div className=" flex text-xl md:text-5xl font-semibold">
            {t("slogen")}
          </div>
          <div className=" flex text-xl md:text-4xl font-semibold">
            {t("openApi")}
          </div>
          <div className=" flex text-xl md:text-3xl font-semibold">
            {t("data")}
          </div>
          {/* <div className=" flex text-[#07c16020] text-3xl">RSS</div> */}
          <div className=" flex flex-wrap items-center font-semibold text-xl md:text-3xl whitespace-pre-wrap">
            <span className=" pr-2">{t("links")}</span>
            {links.map((item, index) => {
              return (
                <div key={item.name}>
                  <Link to={profile && item.href ? "/home" : item.href}>
                    <span className=" no-underline hover:text-[#07c160] active:scale-95 duration-300">
                      {profile && item.href === "/login"
                        ? t(`dashboard`)
                        : t(`linksItems.${index}`)}
                    </span>
                  </Link>
                  {index + 1 < links.length ? (
                    <span className=" px-2">/</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Landing;
