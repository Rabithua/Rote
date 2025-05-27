import axios from "axios";

export const instance = axios.create({
  timeout: 60000,
  baseURL:
    process.env.NODE_ENV === "production"
      ? process.env.REACT_APP_BASEURL_PRD
      : "http://localhost:3000",
  withCredentials: true,
});

// 请求拦截器
instance.interceptors.request.use(
  (config) => {
    // 在请求发送前做一些处理
    return config;
  },
  (error) => {
    // 捕获请求错误，但不显示错误消息
    return Promise.reject(error);
  }
);

// 响应拦截器
instance.interceptors.response.use(
  (response) => {
    // 对响应数据做一些处理
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      if (localStorage.getItem("profile")) {
        localStorage.removeItem("profile");
        window.location.href = "/login";
      }
    }
    // 捕获响应错误，但不显示错误消息
    return Promise.reject(error);
  }
);
