import type { ApiGetRotesParams } from '@/types/main';
import { instance } from '../request';

/**
 * 添加笔记
 * @deprecated 请使用新的API调用方式: post('/notes', data)
 */
export function apiAddRote(data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: 'post',
      url: '/v1/api/addRote',
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

/**
 * 获取单个笔记
 * @deprecated 请使用新的API调用方式: get('/notes/' + id).then(res => res.data)
 */
export function apiGetSingleRote(id: any): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: 'get',
      url: '/v1/api/oneRote',
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

/**
 * 获取多个笔记
 * @deprecated 请根据 apiType 使用不同的新API:
 * - mine: get('/notes', params).then(res => res.data)
 * - public: get('/notes/public', params).then(res => res.data)
 * - userPublic: get('/notes/users/' + username, params).then(res => res.data)
 */
export function apiGetRotes(data: ApiGetRotesParams): Promise<any> {
  let { filter, apiType, params } = data;
  let url = '';
  switch (apiType) {
    case 'mine':
      url = '/v1/api/getMyRote';
      break;
    case 'public':
      url = '/v1/api/getPublicRote';
      break;
    case 'userPublic':
      url = '/v1/api/getUserPublicRote';
      break;
    default:
      throw new Error('Unknown rote type');
  }
  return new Promise((resolve, reject) => {
    instance({
      method: 'post',
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

/**
 * 编辑笔记
 * @deprecated 请使用新的API调用方式: put('/notes/' + data.id, data)
 */
export function apiEditMyRote(data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: 'post',
      url: '/v1/api/oneRote',
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

/**
 * 删除笔记
 * @deprecated 请使用新的API调用方式: del('/notes/' + id)
 */
export function apiDeleteMyRote(data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: 'delete',
      url: '/v1/api/oneRote',
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

/**
 * 批量删除附件
 * @deprecated 请使用新的API调用方式: del('/attachments', { data: { ids } })
 */
export function apiDeleteMyAttachments(data: {
  attachments: {
    id: string;
    key?: string;
  }[];
}): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: 'delete',
      url: '/v1/api/deleteAttachments',
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

/**
 * 删除单个附件
 * @deprecated 请使用新的API调用方式: del('/attachments/' + id)
 */
export function apiDeleteMyAttachment(data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: 'delete',
      url: '/v1/api/deleteAttachment',
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

/**
 * 获取我的标签
 * @deprecated 请使用新的API调用方式: get('/users/me/tags').then(res => res.data)
 */
export function apiGetMyTags(): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: 'get',
      url: '/v1/api/getMyTags',
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
 * 获取我的会话信息
 * @deprecated 请使用新的API调用方式: get('/users/me/sessions')
 */
export function apiGetMySessions(): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: 'get',
      url: '/v1/api/getsession',
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
 * 获取我的API密钥
 * @deprecated 请使用新的API调用方式: get('/api-keys')
 */
export function apiGetMyOpenKey(): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: 'get',
      url: '/v1/api/openkey',
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
 * 获取随机笔记
 * @deprecated 请使用新的API调用方式: get('/notes/random').then(res => res.data)
 */
export function apiGetRandomRote(): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: 'get',
      url: '/v1/api/randomRote',
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
 * 获取统计数据
 * @deprecated 请使用新的API调用方式: get('/users/me/statistics')
 */
export function apiGetStatistics(): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: 'get',
      url: '/v1/api/statistics',
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
 * 生成API密钥
 * @deprecated 请使用新的API调用方式: post('/api-keys')
 */
export function apiGenerateOpenKey(): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: 'get',
      url: '/v1/api/openkey/generate',
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
 * 删除API密钥
 * @deprecated 请使用新的API调用方式: del('/api-keys/' + id)
 */
export function apiDeleteOneMyOpenKey(id: string): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: 'delete',
      url: '/v1/api/openkey',
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

/**
 * 编辑API密钥权限
 * @deprecated 请使用新的API调用方式: put('/api-keys/' + id, { permissions })
 */
export function apiEditOneMyOpenKey(id: string, permissions: string[]): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: 'post',
      url: '/v1/api/openkey',
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

/**
 * 上传附件
 * @deprecated 请使用新的API调用方式: post('/attachments', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
 */
export function apiUploadFiles(formData: any, roteid: any): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: 'post',
      url: '/v1/api/upload',
      data: formData,
      params: {
        roteid,
      },
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
 * 获取后端状态
 * @deprecated 请使用新的API调用方式: get('/status').then(res => res.data)
 */
export function apiGetStatus(): Promise<any> {
  return new Promise((resolve, reject) => {
    instance({
      method: 'get',
      url: '/v1/api/status',
    })
      .then(function (response) {
        resolve(response.data.data);
      })
      .catch((e: any) => {
        reject(e);
      });
  });
}
