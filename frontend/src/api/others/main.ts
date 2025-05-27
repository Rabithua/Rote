import { instance } from '../request';

/**
 * 获取个人热力图数据
 * @deprecated 请使用新的API调用方式: get('/users/me/heatmap', { startDate, endDate }).then(res => res.data)
 */
export function apiGetMyHeatMap(data: any): Promise<any> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (70 + startDate.getDay() || 7));

  return new Promise((resolve, reject) => {
    instance({
      method: 'post',
      url: '/v1/api/getMyHeatmap',
      data: {
        endDate: data.endDate || endDate,
        startDate: data.startDate || startDate,
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
