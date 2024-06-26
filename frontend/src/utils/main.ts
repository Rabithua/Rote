import { Rotes } from "@/types/main";
import toast from "react-hot-toast";

export function formatTimeAgo(givenTime: string): string {
  const givenDate = new Date(givenTime);
  const currentDate = new Date();
  const timeDiff = currentDate.getTime() - givenDate.getTime();

  const seconds = Math.floor(timeDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}天前`;
  } else if (hours > 0) {
    return `${hours}小时前`;
  } else if (minutes > 0) {
    return `${minutes}分钟前`;
  } else {
    return `${seconds}秒前`;
  }
}

export function checkPermission() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("No support for service worker!");
  }

  if (!("Notification" in window)) {
    throw new Error("No support for notification API");
  }

  if (!("PushManager" in window)) {
    throw new Error("No support for Push API");
  }

  toast.success("权限检查通过");

  return;
}

export async function registerSW() {
  const registration = await navigator.serviceWorker.register("sw.js");

  if (registration.active) {
    toast.success("ServiceWorker注册成功！");
  }

  return registration;
}

export async function requestNotificationPermission() {
  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error("Notification permission not granted");
  }

  toast.success("授权成功");
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
