import { instance } from "../request";

export function saveSubscription(data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: "post",
      url: "/v1/api/savesubscription",
      data,
    })
      .then(function (response) {
        console.log(response.data);
        resolve(response);
      })
      .catch((e: any) => {
        reject(e);
      });
  });
}
