import type { ApiGetRotesParams } from "@/types/main";
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
        resolve(response.data.data);
      })
      .catch((e: any) => {
        reject(e);
      });
  });
}

export function apiGetRotes(
  data: ApiGetRotesParams,
): Promise<any> {
  let { filter, apiType, params } = data;
  let url = "";
  switch (apiType) {
    case "mine":
      url = "/v1/api/getMyRote";
      break;
    case "public":
      url = "/v1/api/getPublicRote";
      break;
    case "userPublic":
      url = "/v1/api/getUserPublicRote";
      break;
    default:
      throw new Error("Unknown rote type");
  }
  return new Promise((resolve, reject) => {
    instance({
      method: "post",
      url,
      params,
      data: { filter },
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

export function apiDeleteMyAttachments(data: {
  attachments: {
    id: string;
    key?: string;
  }[];
}): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: "delete",
      url: "/v1/api/deleteAttachments",
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
  permissions: string[],
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
