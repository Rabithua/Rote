import axios, { type AxiosRequestConfig } from 'axios';

// 创建axios实例
const api = axios.create({
  timeout: 60000,
  baseURL:
    process.env.NODE_ENV === 'production'
      ? process.env.REACT_APP_BASEURL_PRD
      : 'http://localhost:3000',
  withCredentials: true,
});

// API版本路径
const API_PATH = '/api/v2';

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 确保所有请求都使用v2 API路径
    if (config.url && !config.url.startsWith('http')) {
      config.url = `${API_PATH}${config.url.startsWith('/') ? config.url : `/${config.url}`}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    // 统一处理响应数据，直接返回data字段
    return response.data;
  },
  (error) => {
    // 处理401未授权错误
    if (error.response && error.response.status === 401) {
      if (localStorage.getItem('profile')) {
        localStorage.removeItem('profile');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// 导出请求方法
export const get = <T = any>(
  url: string,
  params?: any,
  data?: any,
  config?: AxiosRequestConfig
): Promise<T> => {
  return api.request({
    method: 'get',
    url,
    params,
    data,
    ...config,
  });
};

export const post = <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
  return api.post(url, data, config);
};

export const put = <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
  return api.put(url, data, config);
};

export const del = <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  return api.delete(url, config);
};

export default api;
