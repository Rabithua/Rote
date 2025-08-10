import axios, { type AxiosRequestConfig } from 'axios';
import { authService } from './auth';

// API版本路径
const API_PATH = '/v2/api';

export const API_POINT =
  process.env.NODE_ENV === 'production'
    ? process.env.REACT_APP_BASEURL_PRD
    : 'http://localhost:3000';

export const API_URL = `${API_POINT}${API_PATH}`;

// 创建axios实例
const api = axios.create({
  timeout: 60000,
  baseURL: API_URL,
  withCredentials: true,
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 添加 JWT token
    const token = authService.getAccessToken();
    if (token && !authService.isTokenExpired(token)) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器
api.interceptors.response.use(
  (response) =>
    // 统一处理响应数据，直接返回data字段
    response.data,
  async (error) => {
    const originalRequest = error.config;

    // 处理401未授权错误
    if (error.response && error.response.status === 401) {
      // 如果是JWT认证失败，尝试刷新token
      if (authService.hasValidRefreshToken() && !originalRequest._retry) {
        if (isRefreshing) {
          // 如果正在刷新，等待刷新完成，并自动重试原请求
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              // 刷新完成后，自动为原请求补充新token并重试
              if (token) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              return api(originalRequest);
            })
            .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          // 刷新token
          const newToken = await refreshTokenRequest();
          processQueue(null, newToken);
          // 刷新成功后，自动为原请求补充新token并重试
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError);
          // 刷新失败，清除所有token并跳转到登录页
          authService.clearTokens();
          if (localStorage.getItem('profile')) {
            localStorage.removeItem('profile');
          }
          window.location.href = '/login';
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      } else {
        // 没有有效的refresh token或者是旧的session认证
        if (localStorage.getItem('profile')) {
          localStorage.removeItem('profile');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Token刷新功能
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (_value: any) => void;
  reject: (_error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });

  failedQueue = [];
};

const refreshTokenRequest = async (): Promise<string> => {
  const refreshTokenValue = authService.getRefreshToken();
  if (!refreshTokenValue) {
    throw new Error('No refresh token available');
  }

  const response = await axios.post(`${API_URL}/auth/refresh`, {
    refreshToken: refreshTokenValue,
  });

  const { accessToken, refreshToken: newRefreshToken } = response.data.data;
  authService.setTokens(accessToken, newRefreshToken);
  return accessToken;
};

// 导出请求方法
export const get = <T = any>(url: string, params?: any, config?: AxiosRequestConfig): Promise<T> =>
  api.request({
    method: 'get',
    url,
    params,
    ...config,
  });

export const post = <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> =>
  api.post(url, data, config);

export const put = <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> =>
  api.put(url, data, config);

export const del = <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> =>
  api.delete(url, config);

export default api;
