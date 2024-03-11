import { instance } from "../request";

export function loginByPassword(data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: "post",
      url: "/v1/api/login/password",
      data,
      withCredentials: true
    })
      .then(function (response) {
        resolve(response);
      })
      .catch((e: any) => {
        reject(e);
      });
  });
}

export function registerBypassword(data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: "post",
      url: "/v1/api/register",
      data,
      withCredentials: true
    })
      .then(function (response) {
        resolve(response);
      })
      .catch((e: any) => {
        reject(e);
      });
  });
}

export function getUserProfile(): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: "get",
      url: "/v1/api/profile",
      withCredentials: true
    })
      .then(function (response) {
        resolve(response);
      })
      .catch((e: any) => {
        reject(e);
      });
  });
}

export function logOut(): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: "post",
      url: "/v1/api/logout",
      withCredentials: true
    })
      .then(function (response) {
        resolve(response);
      })
      .catch((e: any) => {
        reject(e);
      });
  });
}
