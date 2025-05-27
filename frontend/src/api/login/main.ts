import { instance } from '../request';

/**
 * 用户登录
 * @deprecated 请使用新的API调用方式: post('/auth/login', data)
 */
export function loginByPassword(data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: 'post',
      url: '/v1/api/login/password',
      data,
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

/**
 * 用户注册
 * @deprecated 请使用新的API调用方式: post('/auth/register', data)
 */
export function registerBypassword(data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: 'post',
      url: '/v1/api/register',
      data,
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

/**
 * 用户登出
 * @deprecated 请使用新的API调用方式: post('/auth/logout')
 */
export function logOut(): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: 'post',
      url: '/v1/api/logout',
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
