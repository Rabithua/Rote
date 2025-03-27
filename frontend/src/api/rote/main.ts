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

export function apiGetSingleRote(id: any): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: "get",
      url: "/v1/api/oneRote",
      params: {
        id,
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

export function apiGetMyRote(data: any): Promise<any> {
  let { filter, ...params } = data;

  return new Promise((resolve, reject) => {
    instance({
      method: "post",
      url: "/v1/api/getMyRote",
      params,
      data: {
        filter: filter,
      },
    })
      .then(function (response) {
        resolve(response.data.data);
      })
      .catch((e: any) => {
        reject(e);
      });
  });
}

export function apiGetPublicRote(data: any): Promise<any> {
  let { filter, ...params } = data;
  // console.log(filter)
  return new Promise((resolve, reject) => {
    instance({
      method: "post",
      url: "/v1/api/getPublicRote",
      params,
      data: {
        filter: filter,
      },
    })
      .then(function (response) {
        resolve(response.data.data);
      })
      .catch((e: any) => {
        reject(e);
      });
  });
}

export function apiGetUserPublicRote(data: any): Promise<any> {
  let { filter, ...params } = data;
  // console.log(filter)
  return new Promise((resolve, reject) => {
    instance({
      method: "post",
      url: "/v1/api/getUserPublicRote",
      params,
      data: {
        filter: filter,
      },
    })
      .then(function (response) {
        resolve(response.data.data);
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

export function apiDeleteMyAttachment(data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: "delete",
      url: "/v1/api/deleteAttachment",
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
        resolve(response.data.data);
      })
      .catch((e: any) => {
        reject(e);
      });
  });
}

export function apiGetMySessions(): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: "get",
      url: "/v1/api/getsession",
    })
      .then(function (response) {
        resolve(response);
      })
      .catch((e: any) => {
        reject(e);
      });
  });
}

export function apiGetMyOpenKey(): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: "get",
      url: "/v1/api/openkey",
    })
      .then(function (response) {
        resolve(response);
      })
      .catch((e: any) => {
        reject(e);
      });
  });
}

export function apiGetRandomRote(): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: "get",
      url: "/v1/api/randomRote",
    })
      .then(function (response) {
        resolve(response.data.data);
      })
      .catch((e: any) => {
        reject(e);
      });
  });
}

export function apiGetStatistics(): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: "get",
      url: "/v1/api/statistics",
    })
      .then(function (response) {
        resolve(response);
      })
      .catch((e: any) => {
        reject(e);
      });
  });
}

export function apiGenerateOpenKey(): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: "get",
      url: "/v1/api/openkey/generate",
    })
      .then(function (response) {
        resolve(response);
      })
      .catch((e: any) => {
        reject(e);
      });
  });
}

export function apiDeleteOneMyOpenKey(id: string): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: "delete",
      url: "/v1/api/openkey",
      data: {
        id,
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

export function apiEditOneMyOpenKey(
  id: string,
  permissions: string[]
): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: "post",
      url: "/v1/api/openkey",
      data: {
        id,
        permissions,
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

export function apiUploadFiles(formData: any, roteid: any): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: "post",
      url: "/v1/api/upload",
      data: formData,
      params: {
        roteid,
      },
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

export function apiGetStatus(): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: "get",
      url: "/v1/api/status",
    })
      .then(function (response) {
        resolve(response.data.data);
      })
      .catch((e: any) => {
        reject(e);
      });
  });
}
