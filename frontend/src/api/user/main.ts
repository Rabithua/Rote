import { instance } from "../request";

export function apiGetUserInfoByUsername(username: string): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: "get",
      url: "/v1/api/getUserInfo",
      params: {
        username,
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

export function getUserProfile(): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: "get",
      url: "/v1/api/profile",
      withCredentials: true,
    })
      .then(function (response) {
        resolve(response);
      })
      .catch((e: any) => {
        reject(e);
      });
  });
}

export function apiUploadAvatar(formData: any): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: "post",
      url: "/v1/api/upload",
      data: formData,
      headers: {
        "Content-Type": "multipart/form-data",
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

export function apiSaveProfile(data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: "post",
      url: "/v1/api/profile",
      data: data,
    })
      .then(function (response) {
        resolve(response);
      })
      .catch((e: any) => {
        reject(e);
      });
  });
}
