import type { Rotes } from '@/types/main';
import toast from 'react-hot-toast';

export function formatTimeAgo(givenTime: string): string {
  const givenDate = new Date(givenTime);
  const currentDate = new Date();
  const timeDiff = currentDate.getTime() - givenDate.getTime();

  const seconds = Math.floor(timeDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) {
    return years === 1 ? '1年前' : `${years}年前`;
  } else if (months > 0) {
    return months === 1 ? '1个月前' : `${months}个月前`;
  } else if (days >= 7) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? '1周前' : `${weeks}周前`;
  } else if (days > 0) {
    return days === 1 ? '1天前' : `${days}天前`;
  } else if (hours > 0) {
    return hours === 1 ? '1小时前' : `${hours}小时前`;
  } else if (minutes > 0) {
    return minutes === 1 ? '1分钟前' : `${minutes}分钟前`;
  } else if (seconds > 10) {
    return `${seconds}秒前`;
  } else {
    return '刚刚';
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
  const registration = await navigator.serviceWorker.register('sw.js');

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
