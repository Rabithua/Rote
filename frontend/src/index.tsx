import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { Toaster } from "react-hot-toast";
import reportWebVitals from "./reportWebVitals";
import "./utils/i18n";
import { App, ConfigProvider } from "antd";
import { GlobalContextProvider } from "./state";
import GlobalRouterProvider from "./route/main";
import themeJson from "@/json/theme.json";

const { theme } = themeJson;
const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <React.StrictMode>
    <App>
      <ConfigProvider theme={theme}>
        <GlobalContextProvider>
          <GlobalRouterProvider />
          <Toaster position="top-right" reverseOrder={false} />
        </GlobalContextProvider>
      </ConfigProvider>
    </App>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals(console.log);
