// i18n多语言翻译
import i18n from 'i18next';
import { initReactI18next } from 'node_modules/react-i18next';
import en from '../locales/en.json';
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
  },
  fallbackLng: userLang,
  supportedLngs: ['en', 'zh'],
  lng: ['en', 'zh'].includes(userLang) ? userLang : 'en',
  react: {
    useSuspense: true,
    bindI18n: 'languageChanged',
    bindI18nStore: '',
  },
});

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('userLanguage', lng);
});
