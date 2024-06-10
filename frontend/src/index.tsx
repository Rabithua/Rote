import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { Toaster } from "react-hot-toast";
import "./utils/i18n";
import { App, ConfigProvider } from "antd";
import { GlobalContextProvider } from "./state";
import GlobalRouterProvider from "./route/main";
import themeJson from "@/json/theme.json";
import { Helmet, HelmetProvider } from "react-helmet-async";

const { theme } = themeJson;
const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <React.StrictMode>
    <App>
      <HelmetProvider>
        <Helmet>
          <title>Rote笔记</title>
          <link rel="icon" href="https://r2.rote.ink/others/logo.png" />
          <meta
            name="apple-mobile-web-app-status-bar-style"
            content="default"
          />
          <meta
            name="description"
            content="Web site created using create-react-app"
          />
          <link
            rel="apple-touch-icon"
            sizes="180x180"
            href="https://r2.rote.ink/others/logo512.png"
          />
          <link
            rel="apple-touch-startup-image"
            href="https://r2.rote.ink/others/logo.png"
          />
        </Helmet>
        <ConfigProvider theme={theme}>
          <GlobalContextProvider>
            <GlobalRouterProvider />
            <Toaster position="top-right" reverseOrder={false} />
          </GlobalContextProvider>
        </ConfigProvider>
      </HelmetProvider>
    </App>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals(console.log);
