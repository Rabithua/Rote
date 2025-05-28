import i18next from 'i18next';

function LanguageSwitcher() {
  function switchLng() {
    const lngNow = i18next.language.slice(0, 2);
    i18next.changeLanguage(lngNow === 'zh' ? 'en' : 'zh');
  }
  return (
    <div
      onClick={switchLng}
      className="md:text-normal bg-bgLight dark:bg-bgDark fixed top-5 right-2 z-50 w-fit cursor-pointer rounded-xl px-3 py-2 text-sm font-semibold duration-300 select-none active:scale-95 md:top-16 md:right-20"
    >
      <span
        className={
          i18next.language.slice(0, 2) === 'zh'
            ? 'mx-2 rounded-md bg-[#07c160] px-2 py-1 text-white'
            : 'mx-2 text-black dark:text-white'
        }
      >
        中
      </span>
      /
      <span
        className={
          i18next.language.slice(0, 2) === 'en'
            ? 'mx-2 rounded-md bg-[#07c160] px-2 py-1 text-white'
            : 'mx-2'
        }
      >
        EN
      </span>
    </div>
  );
}

export default LanguageSwitcher;
