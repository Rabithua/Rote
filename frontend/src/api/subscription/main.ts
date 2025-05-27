// service worker 相关数据库操作

import { instance } from "../request";

export interface Subscription {
  keys: {
    auth: string;
    p256dh: string;
  };
  id: string;
  userid: string;
  endpoint: string;
  expirationTime: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * @deprecated 保存订阅信息到服务器
 * @param subscription 订阅对象
 * @returns Promise<any>
 */
export function saveSubscription(subscription: any): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: "post",
      url: "/v1/api/addSwSubScription",
      data: {
        subScription: subscription,
      },
    })
      .then(function (response) {
        resolve(response);
      })
      .catch((e: any) => {
        reject(e);
      });
  });
}

/**
 * @deprecated 删除指定的订阅
 * @param subId 订阅ID
 * @returns Promise<any>
 */
export function deleteSubscription(subId: any): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: "delete",
      url: "/v1/api/swSubScription",
      params: {
        subId,
      },
    })
      .then(function (response) {
        resolve(response);
      })
      .catch((e: any) => {
        reject(e);
      });
  });
}

/**
 * @deprecated 向指定订阅发送测试通知
 * @param subId 订阅ID
 * @returns Promise<any>
 */
export function sendNotificationTest(subId: any): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: "post",
      url: "/v1/api/sendSwSubScription",
      params: {
        subId,
      },
      data: {
        title: "自在废物",
        body: "这是我的博客。",
        image: `https://r2.rote.ink/others%2Flogo.png`,
        data: {
          type: "openUrl",
          url: "https://rabithua.club",
        },
      },
    })
      .then(function (response) {
        resolve(response);
      })
      .catch((e: any) => {
        reject(e);
      });
  });
}

/**
 * @deprecated 获取所有订阅列表
 * @returns Promise<Subscription[]>
 */
export function getSubscriptionList(): Promise<Subscription[]> {
  return new Promise((resolve, reject) => {
    instance({
      method: "get",
      url: "/v1/api/swSubScription",
    })
      .then(function (response) {
        resolve(response.data.data);
      })
      .catch((e: any) => {
        reject(e);
      });
  });
}
