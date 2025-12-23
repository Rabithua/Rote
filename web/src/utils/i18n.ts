// i18n多语言翻译
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import ja from '../locales/ja.json';
import zh from '../locales/zh.json';

const savedLang = localStorage.getItem('userLanguage');
const userLang = savedLang || navigator.language.split('-')[0];

i18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: en,
    },
    zh: {
      translation: zh,
    },
    ja: {
      translation: ja,
    },
  },
  fallbackLng: userLang,
  supportedLngs: ['en', 'zh', 'ja'],
  lng: ['en', 'zh', 'ja'].includes(userLang) ? userLang : 'en',
  react: {
    useSuspense: true,
    bindI18n: 'languageChanged',
    bindI18nStore: '',
  },
});

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('userLanguage', lng);
});
