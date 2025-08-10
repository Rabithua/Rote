import { Toaster } from '@/components/ui/sonner';
import { Helmet, HelmetProvider } from '@dr.pogodin/react-helmet';
import React, { useCallback, useEffect, useState } from 'react';
import { SWRConfig } from 'swr';
import { ThemeProvider } from './components/theme-provider';
import GlobalRouterProvider from './route/main';

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
          <title>Rote</title>
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <link rel="apple-touch-startup-image" href="/logo.png" />
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
            revalidateOnReconnect: false,
            revalidateIfStale: false,
          }}
        >
          <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
            <GlobalRouterProvider />
          </ThemeProvider>
          <Toaster position="top-right" />
        </SWRConfig>
      </HelmetProvider>
    </React.StrictMode>
  );
};

export default AppWrapper;
