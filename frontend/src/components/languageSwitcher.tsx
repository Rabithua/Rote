import i18next from "i18next";

function LanguageSwitcher() {
  function switchLng() {
    let lngNow = i18next.language.slice(0, 2);
    i18next.changeLanguage(lngNow === "zh" ? "en" : "zh").then((t) => {
      console.log(`Now language is ${i18next.language} `);
    });
  }
  return (
    <div
      onClick={switchLng}
      className=" z-50 text-sm md:text-normal fixed w-fit top-5 right-2 md:top-16 md:right-20 px-3 py-2 dark:bg-[#333333] bg-bgLight dark:bg-bgDark rounded-xl font-semibold active:scale-95 duration-300 cursor-pointer select-none"
    >
      <span
        className={
          i18next.language.slice(0, 2) === "zh"
            ? " bg-[#07c160] py-1 px-2 mx-2 rounded-md text-white"
            : " mx-2 text-black dark:text-white"
        }
      >
        中
      </span>
      /
      <span
        className={
          i18next.language.slice(0, 2) === "en"
            ? " bg-[#07c160] py-1 px-2 mx-2 rounded-md text-white"
            : " mx-2"
        }
      >
        EN
      </span>
    </div>
  );
}

export default LanguageSwitcher;
