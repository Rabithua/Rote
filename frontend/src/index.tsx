import React, { useCallback, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { Toaster } from "react-hot-toast";
import "./utils/i18n";
import { App, ConfigProvider, theme } from "antd";
import { GlobalContextProvider } from "./state";
import GlobalRouterProvider from "./route/main";
import themeJson from "@/json/theme.json";
import { Helmet, HelmetProvider } from "react-helmet-async";

const { lightTheme, darkTheme } = themeJson;
const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

const AppWrapper = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const windowQuery = window.matchMedia("(prefers-color-scheme:dark)");

  const darkModeChange = useCallback((event: MediaQueryListEvent) => {
    console.log(event.matches ? true : false);
    setIsDarkMode(event.matches ? true : false);
  }, []);

  useEffect(() => {
    windowQuery.addEventListener("change", darkModeChange);
    return () => {
      windowQuery.removeEventListener("change", darkModeChange);
    };
  }, [windowQuery, darkModeChange]);

  useEffect(() => {
    console.log(windowQuery.matches ? true : false);
    setIsDarkMode(windowQuery.matches ? true : false);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDarkMode(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return (
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
          <ConfigProvider
            theme={
              isDarkMode
                ? { algorithm: theme.darkAlgorithm, ...darkTheme }
                : {
                    algorithm: theme.defaultAlgorithm,
                    ...lightTheme,
                  }
            }
          >
            <GlobalContextProvider>
              <GlobalRouterProvider />
              <Toaster position="top-right" reverseOrder={false} />
            </GlobalContextProvider>
          </ConfigProvider>
        </HelmetProvider>
      </App>
    </React.StrictMode>
  );
};

root.render(<AppWrapper />);
