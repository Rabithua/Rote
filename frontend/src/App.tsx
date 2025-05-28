import React, { useState, useCallback, useEffect } from 'react';
import { HelmetProvider, Helmet } from '@dr.pogodin/react-helmet';
import { Toaster } from 'react-hot-toast';
import { SWRConfig } from 'swr';
import GlobalRouterProvider from './route/main';
import { ThemeProvider } from './components/theme-provider';

const AppWrapper = () => {
  const [, setIsDarkMode] = useState(false);
  const windowQuery = window.matchMedia('(prefers-color-scheme:dark)');

  const darkModeChange = useCallback((event: MediaQueryListEvent) => {
    setIsDarkMode(event.matches ? true : false);
  }, []);

  useEffect(() => {
    windowQuery.addEventListener('change', darkModeChange);
    return () => {
      windowQuery.removeEventListener('change', darkModeChange);
    };
  }, [windowQuery, darkModeChange]);

  useEffect(() => {
    setIsDarkMode(windowQuery.matches ? true : false);
  }, [windowQuery.matches]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return (
    <React.StrictMode>
      <HelmetProvider>
        <Helmet>
          <title>Rote - Personal note like twitter</title>
          <link rel="icon" href="https://r2.rote.ink/others/logo.png" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="description" content="Web site created using create-react-app" />
          <link rel="apple-touch-startup-image" href="https://r2.rote.ink/others/logo.png" />
        </Helmet>
        <SWRConfig
          value={{
            onErrorRetry: (error, key, _config, _revalidate, { retryCount }) => {
              // no retry
              if ([404, 401, 403].includes(error.status)) return;
              if (key === 'profile') return;
              if (retryCount >= 3) return;
            },
            refreshInterval: 0,
            revalidateOnFocus: false,
            revalidateOnReconnect: true,
          }}
        >
          <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
            <GlobalRouterProvider />
          </ThemeProvider>
          <Toaster position="top-right" reverseOrder={false} />
        </SWRConfig>
      </HelmetProvider>
    </React.StrictMode>
  );
};

export default AppWrapper;
