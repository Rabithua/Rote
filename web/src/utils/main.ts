import i18n from 'i18next';
import { jwtDecode } from 'jwt-decode';

import type { Rotes } from '@/types/main';
import { toast } from 'sonner';

type TranslationFunction = (key: string, options?: { count?: number }) => string;

export function formatTimeAgo(givenTime: string, t?: TranslationFunction): string {
  const givenDate = new Date(givenTime);
  const currentDate = new Date();
  const timeDiff = currentDate.getTime() - givenDate.getTime();

  const seconds = Math.floor(timeDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  // 使用提供的翻译函数，如果没有则使用 i18n.t（直接访问全局翻译）
  const translate = t || ((key: string, options?: { count?: number }) => i18n.t(key, options));

  if (years > 0) {
    return translate('common.timeAgo.yearsAgo', { count: years });
  } else if (months > 0) {
    return translate('common.timeAgo.monthsAgo', { count: months });
  } else if (days >= 7) {
    const weeks = Math.floor(days / 7);
    return translate('common.timeAgo.weeksAgo', { count: weeks });
  } else if (days > 0) {
    return translate('common.timeAgo.daysAgo', { count: days });
  } else if (hours > 0) {
    return translate('common.timeAgo.hoursAgo', { count: hours });
  } else if (minutes > 0) {
    return translate('common.timeAgo.minutesAgo', { count: minutes });
  } else if (seconds > 10) {
    return translate('common.timeAgo.secondsAgo', { count: seconds });
  } else {
    return translate('common.timeAgo.justNow');
  }
}

export function checkPermission() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('No support for service worker!');
  }

  if (!('Notification' in window)) {
    throw new Error('No support for notification API');
  }

  if (!('PushManager' in window)) {
    throw new Error('No support for Push API');
  }

  return;
}

export async function registerSW() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('No support for service worker!');
  }
  // 使用 vite-plugin-pwa 的注册结果：在入口处已调用 virtual:pwa-register
  // 这里等待已注册的 SW 就绪，避免在开发环境手动注册 /sw.js 引发 MIME 报错
  const registration = await navigator.serviceWorker.ready;
  if (registration.active) {
    toast.success('Service Worker registered successfully!');
  }
  return registration;
}

export async function requestNotificationPermission() {
  const permission = await Notification.requestPermission();

  if (permission !== 'granted') {
    toast.error('Notification permission denied. Please enable it in your browser settings.');
    throw new Error('Notification permission not granted');
  }

  return;
}

export function sortRotesByPinAndCreatedAt(objects: Rotes): Rotes {
  return objects.sort((a, b) => {
    if (a.pin === b.pin) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    } else {
      return a.pin ? -1 : 1;
    }
  });
}

export function isTokenValid() {
  const token = localStorage.getItem('rote_refresh_token');
  if (!token) {
    return false;
  }

  const payload = jwtDecode(token) as { exp: number };
  const isExpired = payload.exp * 1000 < Date.now();

  return !isExpired;
}

export function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
