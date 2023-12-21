// i18n多语言翻译
import i18n from "i18next";
import en from ".././locales/en.json";
import zh from ".././locales/zh.json";
import { initReactI18next } from "react-i18next";

var userLang = navigator.language;

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: en,
      },
      zh: {
        translation: zh,
      },
    },
    fallbackLng: userLang,
    supportedLngs: ["en", "zh"],

    interpolation: {
      escapeValue: false, // react already safes from xss => https://www.i18next.com/translation-function/interpolation#unescape
    },
  });
