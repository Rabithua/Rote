import type { AdminHookEvent } from '../../types/config';
import en from './locales/en.json';
import ja from './locales/ja.json';
import zh from './locales/zh.json';

type AdminHookLocale = 'en' | 'ja' | 'zh';

const eventLabels: Record<AdminHookLocale, Record<AdminHookEvent, string>> = {
  en: en.events,
  ja: ja.events,
  zh: zh.events,
};

function resolveLocale(language?: string): AdminHookLocale {
  const languageCode = language?.trim().toLowerCase().split(/[-_]/)[0];
  if (languageCode === 'en' || languageCode === 'ja') return languageCode;
  return 'zh';
}

export function labelForAdminHookEvent(event: AdminHookEvent, language?: string) {
  return eventLabels[resolveLocale(language)][event];
}
