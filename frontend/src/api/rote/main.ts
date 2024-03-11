import { instance } from "../request";

export function apiAddRote(data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: "post",
      url: "/v1/api/addRote",
      data,
    })
      .then(function (response) {
        resolve(response);
      })
      .catch((e: any) => {
        reject(e);
      });
  });
}

export function apiGetMyRote(data: any): Promise<any> {
  let { filter, ...params } = data
  // console.log(filter)
  return new Promise((resolve, reject) => {
    instance({
      method: "post",
      url: "/v1/api/getMyRote",
      params,
      data: {
        filter: filter
      }
    })
      .then(function (response) {
        resolve(response);
      })
      .catch((e: any) => {
        reject(e);
      });
  });
}

export function apiEditMyRote(data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: "post",
      url: "/v1/api/oneRote",
      data,
    })
      .then(function (response) {
        resolve(response);
      })
      .catch((e: any) => {
        reject(e);
      });
  });
}

export function apiDeleteMyRote(data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: "delete",
      url: "/v1/api/oneRote",
      data,
    })
      .then(function (response) {
        resolve(response);
      })
      .catch((e: any) => {
        reject(e);
      });
  });
}

export function apiGetMyTags(): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: "get",
      url: "/v1/api/getMyTags",
    })
      .then(function (response) {
        resolve(response);
      })
      .catch((e: any) => {
        reject(e);
      });
  });
}