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
      className=" fixed top-16 right-20 px-5 py-3 bg-white rounded-full font-semibold hover:bg-[#07c160] hover:text-white hover:scale-95 duration-300 cursor-pointer select-none"
    >
      <span
        className={
          i18next.language.slice(0, 2) === "zh"
            ? " bg-[#07c160] py-1 px-2 mx-2 rounded-md text-white"
            : " mx-2"
        }
      >
        中文
      </span>
      /
      <span
        className={
          i18next.language.slice(0, 2) === "en"
            ? " bg-[#07c160] py-1 px-2 mx-2 rounded-md text-white"
            : " mx-2"
        }
      >
        ENGLISH
      </span>
    </div>
  );
}

export default LanguageSwitcher;
