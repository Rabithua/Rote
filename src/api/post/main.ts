import { instance } from "../request";

export function apiAddPost(data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: "post",
      url: "/addPost",
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
