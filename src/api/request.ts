import axios from "axios";

export const instance = axios.create({
  baseURL:
    process.env.NODE_ENV === "development"
      ? process.env.REACT_APP_BASEURL_DEV
      : process.env.REACT_APP_BASEURL_PRD,
  timeout: 6000,
  headers: {},
});
