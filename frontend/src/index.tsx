import themeJson from "@/json/theme.json";
import { App, ConfigProvider, theme } from "antd";
import React, { useCallback, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { Helmet, HelmetProvider } from "react-helmet-async";
import { Toaster } from "react-hot-toast";
import "./index.css";
import GlobalRouterProvider from "./route/main";
import "./utils/i18n";
import { SWRConfig } from "swr";

const { lightTheme, darkTheme } = themeJson;
const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
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
    setIsDarkMode(windowQuery.matches ? true : false);
  }, [windowQuery.matches]);

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
            <title>Rote - Personal note like twitter</title>
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
            theme={isDarkMode
              ? { algorithm: theme.darkAlgorithm, ...darkTheme }
              : {
                algorithm: theme.defaultAlgorithm,
                ...lightTheme,
              }}
          >
            <SWRConfig
              value={{
                onErrorRetry: (
                  error,
                  key,
                  _config,
                  _revalidate,
                  { retryCount },
                ) => {
                  // no retry
                  if ([404, 401, 403].includes(error.status)) return;
                  if (key === "profile") return;
                  if (retryCount >= 3) return;
                },
                revalidateOnFocus: false,
                refreshInterval: 0,
              }}
            >
              <GlobalRouterProvider />
              <Toaster position="top-right" reverseOrder={false} />
            </SWRConfig>
          </ConfigProvider>
        </HelmetProvider>
      </App>
    </React.StrictMode>
  );
};

root.render(<AppWrapper />);
