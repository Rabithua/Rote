// i18n多语言翻译
import i18n from "i18next";
import en from ".././locales/en.json";
import zh from ".././locales/zh.json";
import { initReactI18next } from "react-i18next";

// 从localStorage获取已保存的语言设置，如果没有则使用浏览器语言
const savedLang = localStorage.getItem("userLanguage");
var userLang = savedLang || navigator.language.split("-")[0];

i18n.use(initReactI18next).init({
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

  // 如果检测到的语言不在支持列表中，默认使用英语
  lng: ["en", "zh"].includes(userLang) ? userLang : "en",

  // 添加语言变更回调，保存到localStorage
  react: {
    useSuspense: true,
    bindI18n: "languageChanged",
    bindI18nStore: "",
  },
});

// 监听语言变更事件
i18n.on("languageChanged", (lng) => {
  localStorage.setItem("userLanguage", lng);
});
