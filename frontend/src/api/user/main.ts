import { instance } from "../request";

export function apiGetUserInfoById(userid: any): Promise<any> {
    return new Promise((resolve, reject) => {
        instance({
            method: "get",
            url: "/v1/api/getUserInfo",
            params: {
                userid,
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
