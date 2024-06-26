// service worker 相关数据库操作

import { instance } from "../request";

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
