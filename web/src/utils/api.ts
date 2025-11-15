import axios, { type AxiosRequestConfig } from 'axios';
import { authService } from './auth';

// API版本路径
const API_PATH = '/v2/api';

/**
 * 获取 API 基础 URL
 * 处理构建时可能为 undefined 的情况，确保始终返回有效的 URL
 */
const getApiPoint = (): string => {
  // Vite 使用 import.meta.env 访问环境变量（以 VITE_ 开头的变量会自动暴露）
  const apiBase = import.meta.env.VITE_API_BASE;
  const defaultValue = 'http://localhost:3000';

  // 如果 VITE_API_BASE 未设置或无效，使用默认值
  if (!apiBase) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[api.ts] VITE_API_BASE is not set, using default:', defaultValue);
    }
    return defaultValue;
  }

  // 确保 apiBase 是字符串类型并验证有效性
  const apiBaseStr = String(apiBase).trim();

  if (apiBaseStr === 'undefined' || apiBaseStr === 'null' || apiBaseStr === '') {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[api.ts] VITE_API_BASE is invalid, using default:', defaultValue);
    }
    return defaultValue;
  }

  return apiBaseStr;
};

export const API_POINT = getApiPoint();
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
  (response) => {
    // 统一处理响应数据
    const responseData = response.data;

    // 检查后端返回的业务状态码，如果 code !== 0 表示业务错误
    if (responseData && typeof responseData === 'object' && 'code' in responseData) {
      if (responseData.code !== 0) {
        // 业务错误，抛出异常
        const error = new Error(responseData.message || 'Request failed');
        (error as any).response = {
          ...response,
          data: responseData,
        };
        (error as any).code = responseData.code;
        return Promise.reject(error);
      }
    }

    // 返回整个响应对象（包含 code, message, data）
    // 注意：调用方需要访问 response.data 来获取实际数据
    return responseData;
  },
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
