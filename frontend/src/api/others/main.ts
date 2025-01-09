import { instance } from "../request";

export function apiGetMyHeatMap(data: any): Promise<any> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (70 + startDate.getDay() || 7));

  return new Promise((resolve, reject) => {
    instance({
      method: "post",
      url: "/v1/api/getMyHeatmap",
      data: {
        endDate: data.endDate || endDate,
        startDate: data.startDate || startDate,
      },
    })
      .then(function (response) {
        resolve(response.data);
      })
      .catch((e: any) => {
        reject(e);
      });
  });
}
