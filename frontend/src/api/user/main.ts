import { instance } from '../request';

/**
 * @deprecated 请使用新的API调用方式: get(`/users/${username}/info`).then(res => res.data)
 */
export function apiGetUserInfoByUsername(username: string): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: 'get',
      url: '/v1/api/getUserInfo',
      params: {
        username,
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

/**
 * 获取个人资料
 * @deprecated 请使用新的API调用方式: get('/users/me/profile').then(res => res.data)
 */
export function getMyProfile(): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: 'get',
      url: '/v1/api/profile',
      withCredentials: true,
    })
      .then(function (response) {
        resolve(response.data.data);
      })
      .catch((e: any) => {
        reject(e);
      });
  });
}
/**
 * 上传头像
 * @deprecated 请使用新的API调用方式: post('/users/me/avatar', formData).then(res => res.data)
 */
export function apiUploadAvatar(formData: any): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: 'post',
      url: '/v1/api/upload',
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
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

/**
 * 保存个人资料
 * @deprecated 请使用新的API调用方式: post('/users/me/profile', data).then(res => res.data)
 */
export function apiSaveProfile(data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: 'post',
      url: '/v1/api/profile',
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
