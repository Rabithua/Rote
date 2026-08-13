import axios, { type AxiosRequestConfig } from 'axios';
import { authService } from './auth';

// API版本路径
const API_PATH = '/v2/api';

// 全局对象扩展类型定义
declare global {
  interface Window {
    __ROTE_CONFIG__?: {
      VITE_API_BASE?: string;
    };
  }
}

/**
 * 获取 API 基础 URL
 * 优先级：运行时配置 > 构建时配置 > 默认值
 * 支持通过 window.__ROTE_CONFIG__ 在运行时注入配置
 * 注意：此函数每次调用时都会重新读取配置，确保使用最新的运行时配置
 */
export const getApiPoint = (): string => {
  const defaultValue = 'http://localhost:3000';

  // 优先读取运行时配置（从 window 对象，由容器启动脚本注入）
  const runtimeConfig = window.__ROTE_CONFIG__;
  if (runtimeConfig?.VITE_API_BASE) {
    const runtimeApiBase = String(runtimeConfig.VITE_API_BASE).trim();
    // 检查是否是占位符（配置注入失败的情况）
    if (
      runtimeApiBase &&
      runtimeApiBase !== 'undefined' &&
      runtimeApiBase !== 'null' &&
      runtimeApiBase !== '' &&
      runtimeApiBase !== '__VITE_API_BASE_PLACEHOLDER__'
    ) {
      return runtimeApiBase;
    }
  }

  // 其次读取构建时配置（Vite 环境变量）
  const apiBase = import.meta.env.VITE_API_BASE;
  if (apiBase) {
    const apiBaseStr = String(apiBase).trim();
    if (apiBaseStr !== 'undefined' && apiBaseStr !== 'null' && apiBaseStr !== '') {
      return apiBaseStr;
    }
  }

  // 如果都未设置或无效，使用默认值
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn('[api.ts] VITE_API_BASE is not set, using default:', defaultValue);
  }
  return defaultValue;
};

/**
 * 获取完整的 API URL（函数形式，确保每次调用都获取最新配置）
 */
export const getApiUrl = (): string => `${getApiPoint()}${API_PATH}`;

// 为了向后兼容，保留导出的常量（但会在首次访问时计算，可能不是最新值）
// 建议新代码使用 getApiPoint() 和 getApiUrl() 函数
export const API_POINT = getApiPoint();
export const API_URL = getApiUrl();

// 创建axios实例（不设置固定的 baseURL，在请求拦截器中动态设置）
const api = axios.create({
  timeout: 60000,
  withCredentials: true,
});

type ApiRequestConfig = AxiosRequestConfig & {
  skipAuthentication?: boolean;
};

function skipsAuthentication(config: unknown): boolean {
  return Boolean((config as ApiRequestConfig | undefined)?.skipAuthentication);
}

let refreshPromise: Promise<string> | null = null;

function clearExpiredSession() {
  authService.clearTokens();
  if (localStorage.getItem('profile')) {
    localStorage.removeItem('profile');
    window.location.href = '/login';
  }
}

function refreshAccessTokenOnce(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

// 请求拦截器
api.interceptors.request.use(
  async (config) => {
    // 动态设置 baseURL，确保每次请求都使用最新的配置
    // 这样可以避免在配置注入前就使用旧的 baseURL
    if (!config.baseURL) {
      config.baseURL = getApiUrl();
    }

    if (skipsAuthentication(config)) {
      return config;
    }

    let accessToken = authService.getAccessToken();

    // 可选鉴权接口不会为游客返回 401，因此 access token 过期时必须在请求前主动刷新。
    if (
      (!accessToken || authService.isTokenExpired(accessToken)) &&
      authService.hasValidRefreshToken()
    ) {
      try {
        accessToken = await refreshAccessTokenOnce();
      } catch (error) {
        clearExpiredSession();
        return Promise.reject(error);
      }
    }

    if (accessToken && !authService.isTokenExpired(accessToken)) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// 自定义错误接口
interface ApiError extends Error {
  response?: any;
  code?: number;
}

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    // 统一处理响应数据
    const responseData = response.data;

    // 检查后端返回的业务状态码，如果 code !== 0 表示业务错误
    if (responseData && typeof responseData === 'object' && 'code' in responseData) {
      if (responseData.code !== 0) {
        // 业务错误，抛出异常
        const error = new Error(responseData.message || 'Request failed') as ApiError;
        error.response = {
          ...response,
          data: responseData,
        };
        error.code = responseData.code;
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
    if (error.response && error.response.status === 401 && !skipsAuthentication(originalRequest)) {
      // 如果是JWT认证失败，尝试刷新token
      if (authService.hasValidRefreshToken() && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const newToken = await refreshAccessTokenOnce();
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          clearExpiredSession();
          return Promise.reject(refreshError);
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

export const refreshAccessToken = async (): Promise<string> => {
  const refreshTokenValue = authService.getRefreshToken();
  if (!refreshTokenValue) {
    throw new Error('No refresh token available');
  }

  // 使用动态获取的 API URL，确保使用最新配置
  const response = await axios.post(`${getApiUrl()}/auth/refresh`, {
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

// 系统初始化接口必须在安全配置和有效登录态都不存在时可用。
export const publicGet = <T = any>(
  url: string,
  params?: any,
  config?: AxiosRequestConfig
): Promise<T> =>
  api.request({
    method: 'get',
    url,
    params,
    ...config,
    skipAuthentication: true,
  } as ApiRequestConfig);

export const publicPost = <T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<T> =>
  api.request({
    method: 'post',
    url,
    data,
    ...config,
    skipAuthentication: true,
  } as ApiRequestConfig);

export default api;
