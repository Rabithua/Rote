import { Toaster } from '@/components/ui/sonner';
import { useSiteStatus } from '@/hooks/useSiteStatus';
import { Helmet, HelmetProvider } from '@dr.pogodin/react-helmet';
import React from 'react';
import { SWRConfig } from 'swr';
import { ThemeProvider } from './components/theme-provider';
import GlobalRouterProvider from './route/main';

const AppHelmet = () => {
  const { data: siteStatus } = useSiteStatus();
  const siteName = siteStatus?.site?.name || 'Rote';
  const siteDescription = siteStatus?.site?.description;

  return (
    <Helmet>
      <title>{siteName}</title>
      {siteDescription ? <meta name="description" content={siteDescription} /> : null}
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <link rel="apple-touch-startup-image" href="/logo.png" />
    </Helmet>
  );
};

const AppWrapper = () => (
  <React.StrictMode>
    <HelmetProvider>
      <AppHelmet />
      <SWRConfig
        value={{
          onErrorRetry: (error, key, _config, _revalidate, { retryCount }) => {
            if ([404, 401, 403].includes(error.status)) return;
            if (key === 'profile') return;
            if (retryCount >= 3) return;
          },
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

export default AppWrapper;
